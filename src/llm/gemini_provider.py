"""Google Gemini generateContent API provider (HTTP, no SDK dependency)."""
import logging
import os
import time
from typing import Any, Optional

import requests

from src.llm.base import LLMProvider

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "gemini-2.0-flash"
_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


class GeminiProvider(LLMProvider):
    """LLM provider that calls the Gemini generateContent API over HTTP.

    Args:
        api_key: Gemini API key.  If *None*, reads ``GEMINI_API_KEY`` from env.
        model: Model identifier (e.g. ``gemini-2.0-flash``).
        max_output_tokens: Cap on response tokens.
        temperature: Sampling temperature.
        timeout: Per-request timeout in seconds.
        retries: Number of retries on transient (429 / 5xx) failures.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_output_tokens: int = 4096,
        temperature: float = 0.0,
        timeout: int = 120,
        retries: int = 2,
    ) -> None:
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        if not self.api_key:
            raise RuntimeError(
                "GeminiProvider requires GEMINI_API_KEY env var but it is not set."
            )
        self.model = model or _DEFAULT_MODEL
        self.max_output_tokens = max_output_tokens
        self.temperature = temperature
        self.timeout = timeout
        self.retries = retries

        # Populated after each extract() call
        self.last_meta: dict[str, Any] = {}

    def extract(self, prompt: str) -> str:
        """Send *prompt* to the Gemini generateContent API and return the raw text.

        Retries on 429 and 5xx with exponential back-off (1s, 2s, 4s …).
        """
        url = f"{_API_BASE}/{self.model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "maxOutputTokens": self.max_output_tokens,
                "temperature": self.temperature,
            },
        }

        last_err: Optional[Exception] = None
        attempts = 1 + self.retries

        for attempt in range(attempts):
            t0 = time.monotonic()
            try:
                resp = requests.post(
                    url,
                    headers=headers,
                    json=body,
                    timeout=self.timeout,
                )
                latency_ms = round((time.monotonic() - t0) * 1000)

                if resp.status_code == 200:
                    data = resp.json()
                    raw_text = self._extract_text(data)
                    self.last_meta = {
                        "provider": "gemini",
                        "model": self.model,
                        "latency_ms": latency_ms,
                        "usage": data.get("usageMetadata"),
                    }
                    return raw_text

                if resp.status_code in _RETRYABLE_STATUS_CODES and attempt < attempts - 1:
                    delay = 2 ** attempt
                    logger.warning(
                        "Gemini API %s (attempt %d/%d), retrying in %ds …",
                        resp.status_code, attempt + 1, attempts, delay,
                    )
                    time.sleep(delay)
                    last_err = RuntimeError(
                        f"Gemini API returned {resp.status_code}: {resp.text[:300]}"
                    )
                    continue

                raise RuntimeError(
                    f"Gemini API returned {resp.status_code}: {resp.text[:500]}"
                )

            except requests.RequestException as exc:
                last_err = exc
                if attempt < attempts - 1:
                    delay = 2 ** attempt
                    logger.warning(
                        "Gemini request error (attempt %d/%d): %s, retrying in %ds …",
                        attempt + 1, attempts, exc, delay,
                    )
                    time.sleep(delay)
                    continue
                raise RuntimeError(
                    f"Gemini request failed after {attempts} attempts: {exc}"
                ) from exc

        raise RuntimeError(
            f"Gemini request failed after {attempts} attempts: {last_err}"
        )

    @staticmethod
    def _extract_text(response_data: dict) -> str:
        """Pull text from the generateContent JSON envelope."""
        for candidate in response_data.get("candidates", []):
            content = candidate.get("content", {})
            for part in content.get("parts", []):
                if "text" in part:
                    return part["text"]
        raise RuntimeError(
            "Could not extract text from Gemini generateContent payload."
        )
