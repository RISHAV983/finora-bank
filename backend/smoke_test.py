"""Live smoke checks for a running Finora demo API (stdlib only).

Run from the project root while Flask is running:
    python backend/smoke_test.py
Override API_BASE_URL to target another local/test deployment.
"""
import json
import os
import sys
import urllib.error
import urllib.request

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:5000/api").rstrip("/")
TIMEOUT_SECONDS = float(os.getenv("SMOKE_TIMEOUT_SECONDS", "4"))


AUTH_TOKEN = ""

def request_json(path, method="GET", payload=None, expected_status=200):
    url = f"{BASE_URL}{path}"
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Accept": "application/json"}
    if AUTH_TOKEN and path not in ("/auth/register", "/auth/login"):
        headers["Authorization"] = f"Bearer {AUTH_TOKEN}"
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            status = response.status
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        status = error.code
        body = error.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise AssertionError(f"Cannot reach {url}: {error}. Is Flask running?") from error

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as error:
        raise AssertionError(f"{method} {path} returned non-JSON content (HTTP {status}).") from error
    expected_statuses = expected_status if isinstance(expected_status, tuple) else (expected_status,)
    if status not in expected_statuses:
        raise AssertionError(f"{method} {path}: expected HTTP {expected_statuses}, got {status}: {parsed}")
    return parsed


def main():
    checks = []

    def check(name, fn):
        fn()
        checks.append(name)
        print(f"PASS  {name}")

    check("health endpoint reports demo status", lambda: _assert_health(request_json("/health")))
    global AUTH_TOKEN
    import uuid
    auth = request_json("/auth/register", "POST", {"name":"Smoke Test", "email":f"smoke-{uuid.uuid4().hex}@example.test", "password":"smoke-test-password"}, 201)
    AUTH_TOKEN = auth["token"]
    conversation = request_json("/conversations", "POST", {"title":"Smoke test chat"}, 201)["id"]
    check("accounts endpoint returns a non-empty list", lambda: _assert_list(request_json("/accounts"), "accounts"))
    check("transactions endpoint returns a list", lambda: _assert_list(request_json("/transactions"), "transactions"))
    check("beneficiaries endpoint returns a list", lambda: _assert_list(request_json("/beneficiaries"), "beneficiaries"))
    check("cards endpoint returns a list", lambda: _assert_list(request_json("/cards"), "cards"))
    check("notifications endpoint returns a list", lambda: _assert_list(request_json("/notifications"), "notifications"))
    check("chat endpoint either generates an AI reply or clearly reports missing configuration", lambda: _assert_chat(request_json("/chat", "POST", {"message": "What is my balance?", "conversationId": conversation}, (200, 503))))
    check("transfer endpoint validates owned resources or denies unowned seed data", lambda: _assert_transfer(request_json(
        "/transfers", "POST", {"sourceAccount": "CHK-001", "beneficiaryId": "ben-1", "amount": 1.25}, (201, 404)
    )))
    check("bill-payment endpoint validates and marks operation simulated", lambda: _assert_simulated(request_json(
        "/bill-payments", "POST", {"provider": "Demo Utilities", "customer": "CUS-TEST", "amount": 1.25}, 201
    )))
    check("invalid transfer amount is rejected", lambda: _assert_error(request_json(
        "/transfers", "POST", {"sourceAccount": "CHK-001", "beneficiaryId": "ben-1", "amount": float("inf")}, 400
    )))

    print(f"\n{len(checks)} live API smoke checks passed against {BASE_URL}.")


def _assert_health(data):
    assert data.get("status") == "ok" and data.get("demo") is True, data


def _assert_list(data, label):
    assert isinstance(data, list), f"Expected {label} to be a JSON list, got {type(data).__name__}"


def _assert_chat(data):
    if data.get("code") == "llm_not_configured":
        assert isinstance(data.get("error"), str) and "OPENAI_API_KEY" in data["error"], data
        return
    assert isinstance(data.get("reply"), str) and data["reply"].strip(), data
    assert data.get("simulated") is True, data
    assert data.get("aiGenerated") is True or data.get("testProvider") is True, data


def _assert_transfer(data):
    if data.get("status") == "simulated":
        _assert_simulated(data)
    else:
        _assert_error(data)

def _assert_simulated(data):
    assert data.get("status") == "simulated", data
    assert data.get("reference", "").startswith("DEMO-"), data
    assert "no " in data.get("message", "").lower(), data


def _assert_error(data):
    assert isinstance(data.get("error"), str) and data["error"], data


if __name__ == "__main__":
    try:
        main()
    except AssertionError as error:
        print(f"FAIL  {error}", file=sys.stderr)
        sys.exit(1)
