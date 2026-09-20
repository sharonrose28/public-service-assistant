#!/usr/bin/env python3
"""Validate a read-only GetAccountPlanState response without making AWS calls."""

import json
import re
import sys
from datetime import datetime, timezone
from decimal import Decimal


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON field")
        result[key] = value
    return result


def reject_constant(_value):
    raise ValueError("Non-standard JSON number")


def verified_free_plan(state, expected_account):
    if not isinstance(state, dict) or state.get("accountId") != expected_account:
        return False
    if state.get("accountPlanType") != "FREE" or state.get("accountPlanStatus") != "ACTIVE":
        return False
    credits = state.get("accountPlanRemainingCredits")
    if not isinstance(credits, dict) or credits.get("unit") != "USD":
        return False
    amount = credits.get("amount")
    # Parse JSON numbers as Decimal: booleans and numeric strings are not credits.
    if not isinstance(amount, Decimal) or not amount.is_finite() or amount <= 0:
        return False
    expiry = state.get("accountPlanExpirationDate")
    if not isinstance(expiry, str) or not re.fullmatch(
        r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})",
        expiry,
    ):
        return False
    expires_at = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
    return expires_at.utcoffset() is not None and expires_at > datetime.now(timezone.utc)


def main():
    try:
        if len(sys.argv) != 2 or not re.fullmatch(r"[0-9]{12}", sys.argv[1]):
            raise ValueError("Expected one account identifier")
        raw = sys.stdin.read(65537)
        if len(raw) > 65536:
            raise ValueError("Response too large")
        state = json.loads(
            raw,
            parse_int=Decimal,
            parse_float=Decimal,
            parse_constant=reject_constant,
            object_pairs_hook=unique_object,
        )
        if not verified_free_plan(state, sys.argv[1]):
            raise ValueError("Account plan is not eligible")
    except Exception:
        # Never print account identifiers, supplied JSON, credentials, or tracebacks.
        print("Deployment blocked: an active AWS Free plan with positive USD credits and a future expiry could not be verified.", file=sys.stderr)
        return 2
    print("Active AWS Free plan, available credits, and expiry verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
