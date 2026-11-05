"""Optional real-provider smoke test. Requires explicit opt-in and OPENAI_API_KEY."""
import os
import sys
from pathlib import Path

from llm_service import LLMConfigurationError, generate_reply, load_env

env_file = Path(__file__).with_name(".env")
print(f"backend/.env found: {env_file.is_file()}")
load_env(env_file)

if os.getenv("RUN_LIVE_LLM_TEST") != "1":
    print("NOT RUN: set RUN_LIVE_LLM_TEST=1 to explicitly make a live LLM API request.")
    sys.exit(2)

if not os.getenv("OPENAI_API_KEY", "").strip():
    print("FAILED: OPENAI_API_KEY is empty. Copy .env.example to .env, paste the key after OPENAI_API_KEY=, save, retry.")
    sys.exit(1)

try:
    answer = generate_reply(
        "Reply with the exact phrase: Finora live LLM connection verified.",
        [],
        {"demo_only": True, "note": "This is a fictional portfolio test."},
    )
except LLMConfigurationError as exc:
    print(f"FAILED: LLM configuration issue: {exc}")
    sys.exit(1)
except Exception as exc:
    print(f"FAILED: live LLM request failed ({type(exc).__name__}). Check the server log lines above for the provider's reason.")
    sys.exit(1)

if not isinstance(answer, str) or not answer.strip():
    print("FAILED: provider returned no text.")
    sys.exit(1)

print("PASSED: a real provider request returned a non-empty response.")
print(f"Response preview: {answer[:180]}")
