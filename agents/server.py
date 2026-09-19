"""Optional local interpretation service. No tools, storage, or request logging."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
import logging
import os
import re
import threading
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field

MAX_BODY_BYTES = 20 * 1024


class Entities(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    issue: str | None = Field(max_length=2000)
    location: str | None = Field(max_length=180)
    duration: str | None = Field(max_length=180)
    landmark: str | None = Field(max_length=180)


class Understanding(BaseModel):
    """Interpret the request; never provide service facts or contact details."""

    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    intent: Literal["CIVIC_ISSUE", "GOVERNMENT_SERVICE", "CLARIFICATION_NEEDED"]
    category: str | None = Field(max_length=40)
    language: str = Field(pattern=r"^[a-z]{2,3}$")
    entities: Entities
    needsClarification: bool
    confidence: float = Field(ge=0, le=1)


@dataclass(frozen=True)
class Settings:
    ollama_host: str = "http://127.0.0.1:11434"
    model: str = "qwen3:1.7b"
    port: int = 8001
    timeout_seconds: float = 45

    @classmethod
    def from_env(cls, env=None):
        env = os.environ if env is None else env
        host = validate_ollama_host(env.get("OLLAMA_HOST", cls.ollama_host))
        model = env.get("OLLAMA_MODEL", cls.model)
        # Local model identifiers only. This service never pulls a model.
        if not isinstance(model, str) or not re.fullmatch(r"[\w./:@-]{1,150}", model):
            raise ValueError("INVALID_OLLAMA_MODEL")
        if "://" in model or "cloud" in model.lower():
            raise ValueError("LOCAL_MODEL_REQUIRED")
        try:
            port = int(env.get("STRANDS_PORT", cls.port))
            timeout = float(env.get("STRANDS_TIMEOUT_SECONDS", cls.timeout_seconds))
        except (ValueError, TypeError):
            raise ValueError("INVALID_SERVER_SETTINGS") from None
        if not 1 <= port <= 65535 or not 1 <= timeout <= 45:
            raise ValueError("INVALID_SERVER_SETTINGS")
        return cls(host, model, port, timeout)


def validate_ollama_host(value):
    """Reject credentials, remote hosts, proxy paths, and ambiguous URLs."""
    if not isinstance(value, str) or any(c.isspace() for c in value):
        raise ValueError("OLLAMA_HOST_MUST_BE_LOOPBACK")
    try:
        parsed = urlsplit(value)
        port = parsed.port
        hostname = parsed.hostname
        local = hostname == "localhost" or ipaddress.ip_address(hostname).is_loopback
    except (ValueError, TypeError):
        raise ValueError("OLLAMA_HOST_MUST_BE_LOOPBACK") from None
    if (parsed.scheme != "http" or not local or parsed.username is not None
            or parsed.password is not None or parsed.query or parsed.fragment
            or parsed.path not in ("", "/") or port == 0):
        raise ValueError("OLLAMA_HOST_MUST_BE_LOOPBACK")
    return value.rstrip("/")


def disable_request_telemetry():
    # The process is dedicated to this private sidecar; opt out before SDK import.
    logging.disable(logging.CRITICAL)
    os.environ["OTEL_SDK_DISABLED"] = "true"
    for kind in ("TRACES", "METRICS", "LOGS"):
        os.environ[f"OTEL_{kind}_EXPORTER"] = "none"
    for name in tuple(os.environ):
        if name.startswith("OTEL_EXPORTER_"):
            os.environ.pop(name, None)


class StrandsInterpreter:
    def __init__(self, settings, *, agent_factory=None, model_factory=None):
        disable_request_telemetry()
        if agent_factory is None or model_factory is None:
            from strands import Agent
            from strands.models.ollama import OllamaModel
            agent_factory, model_factory = Agent, OllamaModel
        self.settings = settings
        self.agent_factory = agent_factory
        self.model_factory = model_factory

    def __call__(self, system, text):
        config = self.settings
        model = self.model_factory(
            host=config.ollama_host,
            model_id=config.model,
            temperature=0,
            max_tokens=900,
            # Ollama does not support forced tool_choice. Native schema-constrained
            # JSON avoids a second tool-call round and works with small local models.
            additional_args={
                "format": Understanding.model_json_schema(),
                **({"think": False} if config.model.split("/")[-1].startswith("qwen3") else {}),
            },
            ollama_client_args={
                "timeout": config.timeout_seconds,
                "trust_env": False,
                "follow_redirects": False,
            },
        )
        # No shared conversation, plugins, memories, directory tools, or callbacks.
        agent = self.agent_factory(
            model=model, system_prompt=system, tools=[], callback_handler=None,
            context_manager=False, session_manager=None, memory_manager=None,
            storage=None, plugins=[], hooks=[],
            load_tools_from_directory=False, checkpointing=False,
            background_tasks=False, retry_strategy=None,
        )

        async def invoke():
            return await asyncio.wait_for(
                agent.invoke_async(text),
                timeout=config.timeout_seconds,
            )

        result = asyncio.run(invoke())
        # The Node backend additionally checks its current catalog and evidence.
        return Understanding.model_validate_json(str(result)).model_dump(mode="json")


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("INVALID_REQUEST")
        result[key] = value
    return result


def _invalid_constant(_value):
    raise ValueError("INVALID_REQUEST")


def parse_request(body):
    if len(body) > MAX_BODY_BYTES:
        raise ValueError("BODY_TOO_LARGE")
    try:
        data = json.loads(body.decode("utf-8"), object_pairs_hook=_unique_object,
                          parse_constant=_invalid_constant)
    except (UnicodeDecodeError, ValueError, RecursionError):
        raise ValueError("INVALID_REQUEST") from None
    if not isinstance(data, dict) or set(data) != {"system", "text"}:
        raise ValueError("INVALID_REQUEST")
    for field, limit in (("system", 15000), ("text", 2000)):
        value = data[field]
        if not isinstance(value, str) or not value.strip() or len(value) > limit:
            raise ValueError("INVALID_REQUEST")
    return data


class LocalServer(ThreadingHTTPServer):
    daemon_threads = True
    block_on_close = False

    def handle_error(self, request, client_address):
        # Tracebacks may contain citizen text or model output.
        pass


def create_server(settings, interpreter, *, port=None):
    slots = threading.BoundedSemaphore(2)

    class Handler(BaseHTTPRequestHandler):
        server_version = "PublicServiceLocalAgent"
        sys_version = ""

        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, *_args):
            pass

        def send_error(self, code, message=None, explain=None):
            self.respond(code, {"error": "INVALID_HTTP_REQUEST"})

        def respond(self, status, payload):
            body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True
            self.wfile.write(body)

        def allow_server_client(self):
            host = self.headers.get("Host", "")
            port = self.server.server_port
            if (len(self.headers.get_all("Host", [])) != 1 or
                    host not in {f"127.0.0.1:{port}", f"localhost:{port}"}):
                self.respond(403, {"error": "LOCAL_SERVER_CLIENT_REQUIRED"})
                return False
            if "Origin" in self.headers or "Sec-Fetch-Site" in self.headers:
                self.respond(403, {"error": "BROWSER_CLIENTS_DENIED"})
                return False
            return True

        def do_GET(self):
            if not self.allow_server_client():
                return
            if self.path == "/health":
                self.respond(200, {"status": "ok", "service": "strands-ollama",
                                   "model": settings.model, "requestTimeoutSeconds": settings.timeout_seconds,
                                   "processId": os.getpid()})
            else:
                self.respond(404, {"error": "NOT_FOUND"})

        def do_OPTIONS(self):
            self.respond(403, {"error": "BROWSER_CLIENTS_DENIED"})

        def do_POST(self):
            if not self.allow_server_client():
                return
            if self.path != "/understand":
                self.respond(404, {"error": "NOT_FOUND"})
                return
            if self.headers.get_content_type() != "application/json":
                self.respond(415, {"error": "JSON_REQUIRED"})
                return
            if "Transfer-Encoding" in self.headers:
                self.respond(400, {"error": "INVALID_REQUEST"})
                return
            lengths = self.headers.get_all("Content-Length", [])
            if not lengths:
                self.respond(411, {"error": "CONTENT_LENGTH_REQUIRED"})
                return
            if len(lengths) != 1 or not re.fullmatch(r"[0-9]{1,10}", lengths[0]):
                self.respond(400, {"error": "INVALID_REQUEST"})
                return
            length = int(lengths[0])
            if length > MAX_BODY_BYTES:
                self.respond(413, {"error": "BODY_TOO_LARGE"})
                return
            try:
                body = self.rfile.read(length)
                if len(body) != length:
                    raise ValueError("INVALID_REQUEST")
                data = parse_request(body)
            except (ValueError, TimeoutError, OSError):
                self.respond(400, {"error": "INVALID_REQUEST"})
                return
            if not slots.acquire(blocking=False):
                self.respond(429, {"error": "MODEL_BUSY"})
                return
            try:
                output = interpreter(data["system"], data["text"])
                output = Understanding.model_validate(output).model_dump(mode="json")
                self.respond(200, {"output": output})
            except TimeoutError:
                self.respond(504, {"error": "MODEL_TIMEOUT"})
            except Exception:
                self.respond(503, {"error": "MODEL_UNAVAILABLE"})
            finally:
                slots.release()

    return LocalServer(("127.0.0.1", settings.port if port is None else port), Handler)


def main():
    try:
        settings = Settings.from_env()
        interpreter = StrandsInterpreter(settings)
        server = create_server(settings, interpreter)
    except (ImportError, ValueError, OSError):
        raise SystemExit("Local agent could not start. Check agents/README.md, dependencies and local settings.") from None
    print(f"Local Strands agent listening on http://127.0.0.1:{settings.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
