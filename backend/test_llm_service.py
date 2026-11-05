import os
import sys
import types
import unittest
from unittest.mock import MagicMock, patch

import tempfile
from pathlib import Path

from llm_service import (
    LLMAuthError,
    LLMConfigurationError,
    LLMQuotaError,
    LLMRateLimitError,
    generate_reply,
    load_env,
)


def fake_openai(create):
    """Build a stand-in ``openai`` module whose chat call runs ``create``."""
    module = types.ModuleType("openai")
    client = MagicMock()
    client.chat.completions.create.side_effect = create
    module.OpenAI = MagicMock(return_value=client)
    for name in ("APIConnectionError", "APIStatusError", "APITimeoutError", "AuthenticationError", "RateLimitError"):
        setattr(module, name, type(name, (Exception,), {}))
    return module, client


class LLMServiceTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            "OPENAI_API_KEY": "test-key-not-real",
            "OPENAI_MODEL": "gpt-4o-mini",
            "OPENAI_TIMEOUT_SECONDS": "20",
            "OPENAI_MAX_OUTPUT_TOKENS": "350",
        }, clear=False)
        self.env.start()
        os.environ.pop("FINORA_TEST_LLM", None)

    def tearDown(self):
        self.env.stop()

    def test_missing_key_is_reported_without_importing_provider(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
            with self.assertRaises(LLMConfigurationError):
                generate_reply("Hello", [], {"demo_only": True})

    def test_successful_provider_call_returns_model_text(self):
        response = types.SimpleNamespace(
            choices=[types.SimpleNamespace(message=types.SimpleNamespace(content="A generated demo answer."))]
        )
        client = MagicMock()
        client.chat.completions.create.return_value = response
        openai_module = types.ModuleType("openai")
        openai_module.OpenAI = MagicMock(return_value=client)
        for name in ("APIConnectionError", "APIStatusError", "APITimeoutError", "AuthenticationError", "RateLimitError"):
            setattr(openai_module, name, type(name, (Exception,), {}))

        with patch.dict(sys.modules, {"openai": openai_module}):
            result = generate_reply("Can you explain my demo balance?", [
                {"role": "user", "content": "Hi"},
                {"role": "assistant", "content": "Hello"},
            ], {"demo_only": True, "accounts": []})

        self.assertEqual(result, "A generated demo answer.")
        kwargs = client.chat.completions.create.call_args.kwargs
        self.assertEqual(kwargs["model"], "gpt-4o-mini")
        self.assertEqual(kwargs["messages"][-1], {"role": "user", "content": "Can you explain my demo balance?"})
        self.assertIn("Fictional demo context", kwargs["messages"][0]["content"])
        self.assertEqual(openai_module.OpenAI.call_args.kwargs["api_key"], "test-key-not-real")

    def test_explicit_test_adapter_is_not_a_real_llm_call(self):
        with patch.dict(os.environ, {"FINORA_TEST_LLM": "1"}):
            result = generate_reply("What is my balance?", [], {"demo_only": True})
        self.assertIn("TEST PROVIDER (not AI)", result)

    def test_test_adapter_balance_reply_matches_the_text_the_browser_tests_expect(self):
        context = {"accounts": [{"balance": 12840.55, "currency": "USD"}, {"balance": 24500.0, "currency": "USD"}]}
        with patch.dict(os.environ, {"FINORA_TEST_LLM": "1"}):
            result = generate_reply("What is my current balance?", [], context)
        self.assertEqual(result, "TEST PROVIDER (not AI): The fictional demo total balance is $37,340.55 across 2 account(s).")

    def test_provider_errors_are_distinguished(self):
        module, _ = fake_openai(lambda **kw: None)
        auth = module.AuthenticationError("bad key")
        quota = module.RateLimitError("x"); quota.code = "insufficient_quota"
        rate = module.RateLimitError("slow down")
        for error, expected in ((auth, LLMAuthError), (quota, LLMQuotaError), (rate, LLMRateLimitError)):
            module, _ = fake_openai(lambda error=error, **kw: (_ for _ in ()).throw(error))
            for name in ("AuthenticationError", "RateLimitError"):
                setattr(module, name, type(error) if type(error).__name__ == name else getattr(module, name))
            with patch.dict(sys.modules, {"openai": module}):
                with self.assertRaises(expected):
                    generate_reply("Hi", [], {"demo_only": True})

    def test_factual_settings_and_base_url_are_sent(self):
        response = types.SimpleNamespace(choices=[types.SimpleNamespace(message=types.SimpleNamespace(content="ok"))])
        module, client = fake_openai(lambda **kw: response)
        with patch.dict(sys.modules, {"openai": module}), patch.dict(os.environ, {"OPENAI_BASE_URL": "http://localhost:11434/v1"}):
            generate_reply("Hi", [], {"demo_only": True})
        kwargs = client.chat.completions.create.call_args.kwargs
        self.assertLessEqual(kwargs["temperature"], 0.2)
        self.assertIn("max_tokens", kwargs)
        self.assertEqual(module.OpenAI.call_args.kwargs["base_url"], "http://localhost:11434/v1")

    def test_newer_models_use_max_completion_tokens_and_no_temperature(self):
        response = types.SimpleNamespace(choices=[types.SimpleNamespace(message=types.SimpleNamespace(content="ok"))])
        module, client = fake_openai(lambda **kw: response)
        with patch.dict(sys.modules, {"openai": module}), patch.dict(os.environ, {"OPENAI_MODEL": "gpt-5-mini"}):
            generate_reply("Hi", [], {"demo_only": True})
        kwargs = client.chat.completions.create.call_args.kwargs
        self.assertIn("max_completion_tokens", kwargs)
        self.assertNotIn("max_tokens", kwargs)
        self.assertNotIn("temperature", kwargs)


class EnvLoadingTests(unittest.TestCase):
    def write(self, data):
        directory = tempfile.TemporaryDirectory(); self.addCleanup(directory.cleanup)
        path = Path(directory.name) / ".env"; path.write_bytes(data)
        return path

    def test_utf16_file_from_powershell_is_read(self):
        path = self.write("OPENAI_API_KEY=sk-test-utf16\r\n".encode("utf-16"))
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("OPENAI_API_KEY", None)
            self.assertTrue(load_env(path)); self.assertEqual(os.environ["OPENAI_API_KEY"], "sk-test-utf16")

    def test_bom_quotes_and_blank_os_variable_are_handled(self):
        path = self.write(b'\xef\xbb\xbfOPENAI_API_KEY="sk-test-bom"\n')
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
            load_env(path); self.assertEqual(os.environ["OPENAI_API_KEY"], "sk-test-bom")

    def test_real_os_variable_wins_over_file(self):
        path = self.write(b"OPENAI_API_KEY=from-file\n")
        with patch.dict(os.environ, {"OPENAI_API_KEY": "from-os"}):
            load_env(path); self.assertEqual(os.environ["OPENAI_API_KEY"], "from-os")

    def test_missing_file_is_not_an_error(self):
        self.assertFalse(load_env(Path("/nonexistent/.env")))


if __name__ == "__main__":
    unittest.main()
