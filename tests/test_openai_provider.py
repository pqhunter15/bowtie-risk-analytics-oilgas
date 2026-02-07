"""Tests for OpenAIProvider (mocked HTTP, no real API key needed)."""
import json
import os
from unittest.mock import patch, MagicMock

import pytest
import requests

from src.llm.base import LLMProvider
from src.llm.openai_provider import OpenAIProvider
from src.llm.registry import get_provider


# -- helpers ------------------------------------------------------------------

def _responses_api_payload(text: str, model: str = "gpt-4o") -> dict:
    """Build a minimal OpenAI Responses API success envelope."""
    return {
        "id": "resp_abc123",
        "model": model,
        "output": [
            {
                "type": "message",
                "role": "assistant",
                "content": [
                    {"type": "output_text", "text": text}
                ],
            }
        ],
        "usage": {
            "input_tokens": 42,
            "output_tokens": 100,
        },
    }


def _mock_response(status_code: int = 200, json_data: dict | None = None, text: str = "") -> MagicMock:
    """Create a minimal mock requests.Response."""
    resp = MagicMock(spec=requests.Response)
    resp.status_code = status_code
    resp.text = text or json.dumps(json_data or {})
    resp.json.return_value = json_data or {}
    return resp


# -- construction & fail-fast ------------------------------------------------

class TestOpenAIProviderInit:
    def test_missing_key_raises_runtime_error(self):
        env_backup = os.environ.pop("OPENAI_API_KEY", None)
        try:
            with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
                OpenAIProvider(api_key="")
        finally:
            if env_backup is not None:
                os.environ["OPENAI_API_KEY"] = env_backup

    def test_explicit_key_accepted(self):
        provider = OpenAIProvider(api_key="sk-test-key")
        assert isinstance(provider, LLMProvider)
        assert provider.model == "gpt-4o"

    def test_custom_params(self):
        p = OpenAIProvider(
            api_key="sk-test",
            model="gpt-4o-mini",
            max_output_tokens=1024,
            temperature=0.5,
            timeout=30,
            retries=3,
        )
        assert p.model == "gpt-4o-mini"
        assert p.max_output_tokens == 1024
        assert p.temperature == 0.5
        assert p.timeout == 30
        assert p.retries == 3


# -- extract() ---------------------------------------------------------------

class TestOpenAIProviderExtract:
    @patch("src.llm.openai_provider.requests.post")
    def test_successful_extraction(self, mock_post: MagicMock) -> None:
        sample_json = '{"incident_id": "INC-001"}'
        mock_post.return_value = _mock_response(
            200, _responses_api_payload(sample_json),
        )

        provider = OpenAIProvider(api_key="sk-test")
        result = provider.extract("some prompt")

        assert result == sample_json
        assert provider.last_meta["provider"] == "openai"
        assert provider.last_meta["model"] == "gpt-4o"
        assert "latency_ms" in provider.last_meta
        assert provider.last_meta["usage"]["input_tokens"] == 42

        # Verify request shape
        call_kwargs = mock_post.call_args
        body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
        assert body["model"] == "gpt-4o"
        assert body["input"] == "some prompt"

    @patch("src.llm.openai_provider.requests.post")
    def test_non_retryable_error_raises_immediately(self, mock_post: MagicMock) -> None:
        mock_post.return_value = _mock_response(401, text="Unauthorized")

        provider = OpenAIProvider(api_key="sk-test", retries=2)
        with pytest.raises(RuntimeError, match="401"):
            provider.extract("prompt")

        assert mock_post.call_count == 1  # no retry on 401

    @patch("src.llm.openai_provider.time.sleep")  # skip real delays
    @patch("src.llm.openai_provider.requests.post")
    def test_retry_on_429_then_success(self, mock_post: MagicMock, mock_sleep: MagicMock) -> None:
        sample_json = '{"ok": true}'
        mock_post.side_effect = [
            _mock_response(429, text="Rate limited"),
            _mock_response(200, _responses_api_payload(sample_json)),
        ]

        provider = OpenAIProvider(api_key="sk-test", retries=2)
        result = provider.extract("prompt")

        assert result == sample_json
        assert mock_post.call_count == 2
        mock_sleep.assert_called_once_with(1)  # 2^0 = 1s

    @patch("src.llm.openai_provider.time.sleep")
    @patch("src.llm.openai_provider.requests.post")
    def test_retry_on_500_then_success(self, mock_post: MagicMock, mock_sleep: MagicMock) -> None:
        sample_json = '{"ok": true}'
        mock_post.side_effect = [
            _mock_response(500, text="Internal Server Error"),
            _mock_response(500, text="Internal Server Error"),
            _mock_response(200, _responses_api_payload(sample_json)),
        ]

        provider = OpenAIProvider(api_key="sk-test", retries=2)
        result = provider.extract("prompt")

        assert result == sample_json
        assert mock_post.call_count == 3

    @patch("src.llm.openai_provider.time.sleep")
    @patch("src.llm.openai_provider.requests.post")
    def test_all_retries_exhausted_raises(self, mock_post: MagicMock, mock_sleep: MagicMock) -> None:
        mock_post.return_value = _mock_response(429, text="Rate limited")

        provider = OpenAIProvider(api_key="sk-test", retries=1)
        with pytest.raises(RuntimeError, match="429"):
            provider.extract("prompt")

        assert mock_post.call_count == 2  # 1 initial + 1 retry

    @patch("src.llm.openai_provider.time.sleep")
    @patch("src.llm.openai_provider.requests.post")
    def test_request_exception_retried(self, mock_post: MagicMock, mock_sleep: MagicMock) -> None:
        sample_json = '{"ok": true}'
        mock_post.side_effect = [
            requests.ConnectionError("connection reset"),
            _mock_response(200, _responses_api_payload(sample_json)),
        ]

        provider = OpenAIProvider(api_key="sk-test", retries=1)
        result = provider.extract("prompt")
        assert result == sample_json


# -- registry integration ----------------------------------------------------

class TestRegistryOpenAI:
    def test_registry_missing_key_raises_runtime_error(self):
        env_backup = os.environ.pop("OPENAI_API_KEY", None)
        try:
            with pytest.raises(RuntimeError, match="not set"):
                get_provider("openai")
        finally:
            if env_backup is not None:
                os.environ["OPENAI_API_KEY"] = env_backup

    @patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-registry"})
    def test_registry_resolves_openai_provider(self):
        provider = get_provider("openai", model="gpt-4o-mini")
        assert isinstance(provider, OpenAIProvider)
        assert isinstance(provider, LLMProvider)
        assert provider.model == "gpt-4o-mini"

    @patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-kwargs"})
    def test_registry_passes_kwargs(self):
        provider = get_provider(
            "openai", model="gpt-4o", temperature=0.7, retries=5,
        )
        assert provider.temperature == 0.7
        assert provider.retries == 5
