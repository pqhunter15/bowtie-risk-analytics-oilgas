"""Input sanitization for user-provided text before it reaches LLM prompts.

Strips or neutralizes content that could alter prompt structure:
- Role/turn markers (Human:, Assistant:, <|system|>, etc.)
- Template variable syntax ({{...}}, {%...%})
- XML-style injection tags (<system>, </instructions>, etc.)
- Markdown heading injection (## Instructions, ## System, etc.)
"""
from __future__ import annotations

import re


_ROLE_MARKERS = re.compile(
    r"(?i)"
    r"(?:"
    r"(?:^|\n)\s*(?:human|user|assistant|system|ai)\s*:"
    r"|<\|(?:system|user|assistant|im_start|im_end)\|>"
    r"|<<\s*/?SYS\s*>>"
    r")",
)

_TEMPLATE_VARS = re.compile(r"\{\{.*?\}\}|\{%.*?%\}")

_XML_INJECTION = re.compile(
    r"</?(?:system|instructions|prompt|context|message|tool_use|function_call|result)[^>]*>",
    re.IGNORECASE,
)

_HEADING_INJECTION = re.compile(
    r"(?:^|\n)\s*#{1,3}\s*(?:instructions|system|prompt|override|ignore)",
    re.IGNORECASE,
)


def sanitize_prompt_input(text: str) -> str:
    """Remove prompt-injection markers from user-provided text.

    Applied at the API boundary before text reaches BarrierExplainer.
    Preserves the semantic content while stripping structural markers
    that could alter how the LLM interprets the prompt.
    """
    text = _ROLE_MARKERS.sub("", text)
    text = _TEMPLATE_VARS.sub("", text)
    text = _XML_INJECTION.sub("", text)
    text = _HEADING_INJECTION.sub("", text)
    return text.strip()
