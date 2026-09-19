"""Boundary and runtime-contract tests; no Ollama server or model download."""

import asyncio
from contextlib import redirect_stderr, redirect_stdout
from http.client import HTTPConnection
import io
import importlib.util
import json
import threading
from types import SimpleNamespace
import unittest

from agents.server import (
    MAX_BODY_BYTES, Settings, StrandsInterpreter, Understanding,
    create_server, parse_request, validate_ollama_host,
)


def output():
    return {
        "intent": "CIVIC_ISSUE", "category": "STREETLIGHT", "language": "ta",
        "entities": {"issue": None, "location": None, "duration": "இரண்டு வாரமாக", "landmark": None},
        "needsClarification": False, "confidence": 0.9,
    }


class ValidationTests(unittest.TestCase):
    def test_only_loopback_ollama_urls_are_allowed(self):
        for host in ("http://127.0.0.1:11434", "http://localhost:11434/", "http://[::1]:11434"):
            self.assertEqual(validate_ollama_host(host), host.rstrip("/"))
        for host in ("https://ollama.com", "http://192.168.1.2:11434", "http://0.0.0.0:11434",
                     "http://localhost.example:11434", "http://127.0.0.1@evil.example",
                     "http://user:password@localhost:11434", "http://localhost:11434/proxy",
                     "http://localhost:11434?remote=yes", "http://localhost:11434/#fragment",
                     "http://localhost:0", "http://localhost:99999", "localhost:11434", None):
            with self.subTest(host=host), self.assertRaises(ValueError):
                validate_ollama_host(host)

    def test_settings_reject_cloud_models_and_unbounded_timeouts(self):
        self.assertEqual(Settings.from_env({}).model, "qwen3:4b")
        for env in ({"OLLAMA_MODEL": "qwen3:cloud"}, {"OLLAMA_MODEL": "https://remote/model"},
                    {"STRANDS_PORT": "0"}, {"STRANDS_TIMEOUT_SECONDS": "nan"},
                    {"STRANDS_TIMEOUT_SECONDS": "46"}, {"OLLAMA_HOST": "http://ollama:11434"}):
            with self.subTest(env=env), self.assertRaises(ValueError):
                Settings.from_env(env)

    def test_request_preserves_exact_multilingual_text(self):
        data = {"system": "Classify only.", "text": "  எங்க தெருவில் இரண்டு வாரமாக தெருவிளக்கு எரியவில்லை.  "}
        self.assertEqual(parse_request(json.dumps(data, ensure_ascii=False).encode()), data)

    def test_invalid_and_oversized_requests_are_rejected(self):
        invalid = [b"{", b"[]", b"null", b'{}', b'\xff',
                   b'{"system":"x","text":"one","text":"two"}',
                   b'{"system":"x","text":NaN}']
        for data in ({"system": "x", "text": ""}, {"system": "x", "text": " "},
                     {"system": [], "text": "x"}, {"system": "x", "text": 12},
                     {"system": "x", "text": "x" * 2001},
                     {"system": "x", "text": "x", "tools": ["shell"]}):
            invalid.append(json.dumps(data).encode())
        invalid.append(b"x" * (MAX_BODY_BYTES + 1))
        for body in invalid:
            with self.subTest(body_length=len(body)), self.assertRaises(ValueError):
                parse_request(body)

    def test_output_schema_disallows_service_facts_and_invalid_confidence(self):
        self.assertEqual(Understanding.model_validate(output()).model_dump(), output())
        for change in ({"officialPortal": "https://invented.example"}, {"confidence": 2},
                       {"confidence": float("nan")}, {"needsClarification": "false"},
                       {"intent": "INVENTED"}, {"entities": {"location": "invented"}}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                Understanding.model_validate({**output(), **change})


class RuntimeTests(unittest.TestCase):
    @unittest.skipUnless(importlib.util.find_spec("strands") and importlib.util.find_spec("ollama"),
                         "Optional Strands/Ollama dependencies are not installed")
    def test_real_sdk_constructors_accept_the_runtime_configuration_without_inference(self):
        real_runtime = StrandsInterpreter(Settings())
        Agent, OllamaModel = real_runtime.agent_factory, real_runtime.model_factory

        constructed = []

        def factory(**kwargs):
            agent = Agent(**kwargs)
            constructed.append(agent)

            async def no_inference(*_args, **_kwargs):
                return SimpleNamespace(structured_output=Understanding.model_validate(output()))

            agent.invoke_async = no_inference
            return agent

        runner = StrandsInterpreter(Settings(), agent_factory=factory, model_factory=OllamaModel)
        self.assertEqual(runner("Test catalog", "Test request"), output())
        self.assertEqual(constructed[0].model.get_config()["model_id"], "qwen3:4b")
        self.assertEqual(constructed[0].messages, [])

    def test_each_call_gets_a_fresh_tool_free_agent_and_structured_schema(self):
        agents, models, prompts = [], [], []

        class FakeAgent:
            def __init__(self, **kwargs):
                self.kwargs = kwargs
                agents.append(self)

            async def invoke_async(self, text, **kwargs):
                prompts.append((text, kwargs))
                return SimpleNamespace(structured_output=Understanding.model_validate(output()))

        def model_factory(**kwargs):
            models.append(kwargs)
            return object()

        runner = StrandsInterpreter(Settings(), agent_factory=FakeAgent, model_factory=model_factory)
        for text in ("first citizen request", "second citizen request"):
            self.assertEqual(runner("trusted catalog", text), output())
        self.assertEqual(len(agents), 2)
        self.assertIsNot(agents[0], agents[1])
        for agent in agents:
            self.assertEqual(agent.kwargs["tools"], [])
            self.assertIsNone(agent.kwargs["callback_handler"])
            self.assertIsNone(agent.kwargs["session_manager"])
            self.assertIsNone(agent.kwargs["memory_manager"])
            self.assertIsNone(agent.kwargs["storage"])
            self.assertEqual(agent.kwargs["plugins"], [])
            self.assertFalse(agent.kwargs["context_manager"])
            self.assertFalse(agent.kwargs["load_tools_from_directory"])
            self.assertFalse(agent.kwargs["background_tasks"])
        self.assertEqual([text for text, _ in prompts], ["first citizen request", "second citizen request"])
        self.assertTrue(all(params["structured_output_model"] is Understanding for _, params in prompts))
        self.assertFalse(models[0]["ollama_client_args"]["trust_env"])
        self.assertFalse(models[0]["ollama_client_args"]["follow_redirects"])
        self.assertEqual(models[0]["additional_args"], {"think": False})

    def test_total_inference_timeout_cancels_the_model_invocation(self):
        cancelled = []

        class SlowAgent:
            def __init__(self, **_kwargs):
                pass

            async def invoke_async(self, *_args, **_kwargs):
                try:
                    await asyncio.sleep(1)
                finally:
                    cancelled.append(True)

        runner = StrandsInterpreter(Settings(timeout_seconds=0.01), agent_factory=SlowAgent,
                                    model_factory=lambda **_kwargs: object())
        with self.assertRaises(TimeoutError):
            runner("classify", "citizen request")
        self.assertEqual(cancelled, [True])


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.requests = []

        def interpret(system, text):
            self.requests.append((system, text))
            return output()

        self.interpret = interpret
        self.server = create_server(Settings(), lambda *args: self.interpret(*args), port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def request(self, method="POST", path="/understand", body=None, headers=None):
        if body is None:
            body = json.dumps({"system": "trusted catalog", "text": "citizen text"}).encode()
        connection = HTTPConnection("127.0.0.1", self.port, timeout=3)
        connection.request(method, path, body=body,
                           headers={"Content-Type": "application/json", **(headers or {})})
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), json.loads(response.read())
        connection.close()
        return result

    def test_contract_returns_only_validated_structured_output(self):
        status, headers, body = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(body, {"output": output()})
        self.assertEqual(self.requests, [("trusted catalog", "citizen text")])
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_browser_origins_and_rebinding_hosts_never_reach_model(self):
        for headers in ({"Origin": "http://localhost:3000"}, {"Origin": "null"},
                        {"Sec-Fetch-Site": "same-origin"}, {"Host": "evil.example"}):
            with self.subTest(headers=headers):
                self.assertEqual(self.request(headers=headers)[0], 403)
        self.assertEqual(self.request(method="OPTIONS")[0], 403)
        self.assertEqual(self.requests, [])

    def test_invalid_media_payload_and_routes_never_reach_model(self):
        self.assertEqual(self.request(headers={"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.request(body=b"{")[0], 400)
        self.assertEqual(self.request(body=b"x" * (MAX_BODY_BYTES + 1))[0], 413)
        self.assertEqual(self.request(headers={"Transfer-Encoding": "chunked"})[0], 400)
        self.assertEqual(self.request(path="/understand?text=private")[0], 404)
        self.assertEqual(self.requests, [])

    def test_health_checks_do_not_call_the_model(self):
        status, _, body = self.request(method="GET", path="/health", body=b"")
        self.assertEqual(status, 200)
        self.assertEqual(body, {"status": "ok", "service": "strands-ollama"})
        self.assertEqual(self.requests, [])

    def test_failures_do_not_log_or_return_private_request_or_model_text(self):
        secret = "private citizen address and model details"

        def failing(*_args):
            raise RuntimeError(secret)

        self.interpret = failing
        captured = io.StringIO()
        with redirect_stdout(captured), redirect_stderr(captured):
            status, _, body = self.request(body=json.dumps({"system": secret, "text": secret}).encode())
        self.assertEqual(status, 503)
        self.assertEqual(body, {"error": "MODEL_UNAVAILABLE"})
        self.assertNotIn(secret, captured.getvalue())
        self.interpret = lambda *_args: {**output(), "contactEmail": secret}
        self.assertEqual(self.request()[0], 503)

    def test_timeout_has_a_sanitized_failure_response(self):
        def timeout(*_args):
            raise TimeoutError("private inference details")

        self.interpret = timeout
        self.assertEqual(self.request()[::2], (504, {"error": "MODEL_TIMEOUT"}))


if __name__ == "__main__":
    unittest.main()
