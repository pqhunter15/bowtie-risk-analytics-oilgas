"""OpenAI Responses API provider (HTTP, no SDK dependency)."""
import logging
import os
import time
from typing import Any, Optional

import requests

from src.llm.base import LLMProvider

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "gpt-4o"
_API_URL = "https://api.openai.com/v1/responses"
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


class OpenAIProvider(LLMProvider):
    """LLM provider that calls the OpenAI Responses API over HTTP.

    Args:
        api_key: OpenAI API key.  If *None*, reads ``OPENAI_API_KEY`` from env.
        model: Model identifier (e.g. ``gpt-4o``).
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
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        if not self.api_key:
            raise RuntimeError(
                "OpenAIProvider requires OPENAI_API_KEY env var but it is not set."
            )
        self.model = model or _DEFAULT_MODEL
        self.max_output_tokens = max_output_tokens
        self.temperature = temperature
        self.timeout = timeout
        self.retries = retries

        # Populated after each extract() call
        self.last_meta: dict[str, Any] = {}

    def extract(self, prompt: str) -> str:
        """Send *prompt* to the OpenAI Responses API and return the raw text.

        Retries on 429 and 5xx with exponential back-off (1s, 2s, 4s …).

        Returns:
            The model's text output as a plain string.

        Raises:
            RuntimeError: After all retries are exhausted or on a
                non-retryable HTTP error.
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model,
            "input": prompt,
            "max_output_tokens": self.max_output_tokens,
            "temperature": self.temperature,
        }

        last_err: Optional[Exception] = None
        attempts = 1 + self.retries  # first try + retries

        for attempt in range(attempts):
            t0 = time.monotonic()
            try:
                resp = requests.post(
                    _API_URL,
                    headers=headers,
                    json=body,
                    timeout=self.timeout,
                )
                latency_ms = round((time.monotonic() - t0) * 1000)

                if resp.status_code == 200:
                    data = resp.json()
                    raw_text = self._extract_text(data)
                    self.last_meta = {
                        "provider": "openai",
                        "model": self.model,
                        "latency_ms": latency_ms,
                        "usage": data.get("usage"),
                    }
                    return raw_text

                # Retryable?
                if resp.status_code in _RETRYABLE_STATUS_CODES and attempt < attempts - 1:
                    delay = 2 ** attempt  # 1, 2, 4 …
                    logger.warning(
                        "OpenAI API %s (attempt %d/%d), retrying in %ds …",
                        resp.status_code, attempt + 1, attempts, delay,
                    )
                    time.sleep(delay)
                    last_err = RuntimeError(
                        f"OpenAI API returned {resp.status_code}: {resp.text[:300]}"
                    )
                    continue

                # Non-retryable error
                raise RuntimeError(
                    f"OpenAI API returned {resp.status_code}: {resp.text[:500]}"
                )

            except requests.RequestException as exc:
                latency_ms = round((time.monotonic() - t0) * 1000)
                last_err = exc
                if attempt < attempts - 1:
                    delay = 2 ** attempt
                    logger.warning(
                        "OpenAI request error (attempt %d/%d): %s, retrying in %ds …",
                        attempt + 1, attempts, exc, delay,
                    )
                    time.sleep(delay)
                    continue
                raise RuntimeError(
                    f"OpenAI request failed after {attempts} attempts: {exc}"
                ) from exc

        # Should not reach here, but just in case
        raise RuntimeError(
            f"OpenAI request failed after {attempts} attempts: {last_err}"
        )

    # ------------------------------------------------------------------
    @staticmethod
    def _extract_text(response_data: dict) -> str:
        """Pull the text content from the Responses API JSON envelope."""
        for item in response_data.get("output", []):
            if item.get("type") == "message":
                for part in item.get("content", []):
                    if part.get("type") == "output_text":
                        return part["text"]
        # Fallback: try top-level output_text (simpler shapes)
        if "output_text" in response_data:
            return response_data["output_text"]
        raise RuntimeError(
            "Could not extract text from OpenAI Responses API payload."
        )
