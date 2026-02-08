"""Tests for GeminiProvider (mocked HTTP, no real API key needed)."""
import json
import os
from unittest.mock import patch, MagicMock

import pytest
import requests

from src.llm.base import LLMProvider
from src.llm.gemini_provider import GeminiProvider
from src.llm.registry import get_provider


# -- helpers ------------------------------------------------------------------

def _generate_content_payload(text: str) -> dict:
    """Build a minimal Gemini generateContent success envelope."""
    return {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": text}],
                    "role": "model",
                },
                "finishReason": "STOP",
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 30,
            "candidatesTokenCount": 80,
            "totalTokenCount": 110,
        },
    }


def _mock_response(status_code: int = 200, json_data: dict | None = None, text: str = "") -> MagicMock:
    resp = MagicMock(spec=requests.Response)
    resp.status_code = status_code
    resp.text = text or json.dumps(json_data or {})
    resp.json.return_value = json_data or {}
    return resp


# -- construction & fail-fast ------------------------------------------------

class TestGeminiProviderInit:
    def test_missing_key_raises_runtime_error(self):
        env_backup = os.environ.pop("GEMINI_API_KEY", None)
        try:
            with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
                GeminiProvider(api_key="")
        finally:
            if env_backup is not None:
                os.environ["GEMINI_API_KEY"] = env_backup

    def test_explicit_key_accepted(self):
        provider = GeminiProvider(api_key="AIza-test")
        assert isinstance(provider, LLMProvider)
        assert provider.model == "gemini-2.0-flash"

    def test_model_prefix_stripped(self):
        """models/gemini-2.0-flash should be normalized to gemini-2.0-flash."""
        p1 = GeminiProvider(api_key="AIza-test", model="models/gemini-2.0-flash")
        p2 = GeminiProvider(api_key="AIza-test", model="gemini-2.0-flash")
        assert p1.model == "gemini-2.0-flash"
        assert p2.model == "gemini-2.0-flash"

    @patch("src.llm.gemini_provider.requests.post")
    def test_model_prefix_url_correct(self, mock_post: MagicMock) -> None:
        """Both forms must produce the same URL without double 'models/'."""
        mock_post.return_value = _mock_response(200, _generate_content_payload('{}'))

        for model_arg in ("gemini-2.0-flash", "models/gemini-2.0-flash"):
            provider = GeminiProvider(api_key="AIza-test", model=model_arg)
            provider.extract("prompt")
            url = mock_post.call_args.args[0]
            assert "models/gemini-2.0-flash:generateContent" in url
            assert "models/models/" not in url


# -- extract() ---------------------------------------------------------------

class TestGeminiProviderExtract:
    @patch("src.llm.gemini_provider.requests.post")
    def test_successful_extraction(self, mock_post: MagicMock) -> None:
        sample_json = '{"incident_id": "INC-001"}'
        mock_post.return_value = _mock_response(200, _generate_content_payload(sample_json))

        provider = GeminiProvider(api_key="AIza-test", model="gemini-2.0-flash")
        result = provider.extract("some prompt")

        assert result == sample_json
        assert provider.last_meta["provider"] == "gemini"
        assert provider.last_meta["model"] == "gemini-2.0-flash"
        assert provider.last_meta["usage"]["totalTokenCount"] == 110

        # Verify request URL contains model and key
        call_args = mock_post.call_args
        url = call_args.args[0] if call_args.args else call_args.kwargs.get("url", "")
        assert "gemini-2.0-flash:generateContent" in url
        assert "key=AIza-test" in url

        # Verify body shape
        body = call_args.kwargs.get("json") or call_args[1].get("json")
        assert body["contents"][0]["parts"][0]["text"] == "some prompt"
        assert body["generationConfig"]["maxOutputTokens"] == 4096
        assert body["generationConfig"]["responseMimeType"] == "application/json"

    @patch("src.llm.gemini_provider.requests.post")
    def test_non_retryable_error_raises_immediately(self, mock_post: MagicMock) -> None:
        mock_post.return_value = _mock_response(403, text="Forbidden")
        provider = GeminiProvider(api_key="AIza-test", retries=2)
        with pytest.raises(RuntimeError, match="403"):
            provider.extract("prompt")
        assert mock_post.call_count == 1

    @patch("src.llm.gemini_provider.time.sleep")
    @patch("src.llm.gemini_provider.requests.post")
    def test_retry_on_429_then_success(self, mock_post: MagicMock, mock_sleep: MagicMock) -> None:
        sample_json = '{"ok": true}'
        mock_post.side_effect = [
            _mock_response(429, text="RESOURCE_EXHAUSTED"),
            _mock_response(200, _generate_content_payload(sample_json)),
        ]
        provider = GeminiProvider(api_key="AIza-test", retries=2)
        result = provider.extract("prompt")
        assert result == sample_json
        assert mock_post.call_count == 2
        mock_sleep.assert_called_once_with(1)

    @patch("src.llm.gemini_provider.time.sleep")
    @patch("src.llm.gemini_provider.requests.post")
    def test_all_retries_exhausted_raises(self, mock_post: MagicMock, mock_sleep: MagicMock) -> None:
        mock_post.return_value = _mock_response(500, text="Internal error")
        provider = GeminiProvider(api_key="AIza-test", retries=1)
        with pytest.raises(RuntimeError, match="500"):
            provider.extract("prompt")
        assert mock_post.call_count == 2


# -- registry integration ----------------------------------------------------

class TestRegistryGemini:
    def test_registry_missing_key_raises_runtime_error(self):
        env_backup = os.environ.pop("GEMINI_API_KEY", None)
        try:
            with pytest.raises(RuntimeError, match="not set"):
                get_provider("gemini")
        finally:
            if env_backup is not None:
                os.environ["GEMINI_API_KEY"] = env_backup

    @patch.dict(os.environ, {"GEMINI_API_KEY": "AIza-registry"})
    def test_registry_resolves_gemini_provider(self):
        provider = get_provider("gemini", model="gemini-2.0-flash")
        assert isinstance(provider, GeminiProvider)
        assert isinstance(provider, LLMProvider)
        assert provider.model == "gemini-2.0-flash"
