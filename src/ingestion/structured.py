"""Structured extraction: text -> LLM -> validated JSON."""
import csv
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, ConfigDict

from src.llm.base import LLMProvider
from src.prompts.loader import load_prompt
from src.validation.incident_validator import validate_incident_v2_2

logger = logging.getLogger(__name__)


class StructuredManifestRow(BaseModel):
    """Tracks structured extraction results."""
    model_config = ConfigDict(extra="ignore")

    incident_id: str
    source_text_path: str
    output_json_path: str
    provider: str
    extracted: bool = False
    extracted_at: Optional[datetime] = None
    valid: bool = False
    validation_errors: Optional[str] = None
    error: Optional[str] = None


def save_structured_manifest(rows: list[StructuredManifestRow], path: Path) -> None:
    """Save structured extraction manifest to CSV."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(StructuredManifestRow.model_fields.keys())

    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            row_dict = row.model_dump()
            if row_dict["extracted_at"]:
                row_dict["extracted_at"] = row_dict["extracted_at"].isoformat()
            row_dict = {k: ("" if v is None else v) for k, v in row_dict.items()}
            row_dict["extracted"] = str(row_dict["extracted"])
            row_dict["valid"] = str(row_dict["valid"])
            writer.writerow(row_dict)


def _parse_llm_json(raw: str) -> dict:
    """Extract JSON from LLM response, stripping markdown fences if present."""
    text = raw.strip()
    if text.startswith("```"):
        # Strip ```json ... ``` fences
        lines = text.split("\n")
        # Remove first line (```json) and last line (```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    return json.loads(text)


def extract_structured(
    text_dir: Path,
    out_dir: Path,
    provider: LLMProvider,
    provider_name: str = "unknown",
) -> list[StructuredManifestRow]:
    """Run structured extraction on all .txt files in text_dir.

    Args:
        text_dir: Directory containing extracted text files.
        out_dir: Directory to write validated JSON files.
        provider: LLM provider instance.
        provider_name: Name of the provider for manifest tracking.

    Returns:
        List of manifest rows tracking extraction results.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    rows: list[StructuredManifestRow] = []

    txt_files = sorted(text_dir.glob("*.txt"))
    if not txt_files:
        logger.warning(f"No .txt files found in {text_dir}")
        return rows

    logger.info(f"Processing {len(txt_files)} text files with provider={provider_name}")

    for txt_path in txt_files:
        incident_id = txt_path.stem
        json_path = out_dir / f"{incident_id}.json"

        row = StructuredManifestRow(
            incident_id=incident_id,
            source_text_path=str(txt_path),
            output_json_path=str(json_path),
            provider=provider_name,
        )

        try:
            text = txt_path.read_text(encoding="utf-8")
            if not text.strip():
                row.error = "Empty text file"
                rows.append(row)
                continue

            # Assemble prompt and call LLM
            prompt = load_prompt(text)
            raw_response = provider.extract(prompt)

            # Parse JSON from response
            payload = _parse_llm_json(raw_response)

            # Override incident_id with filename-based ID
            payload["incident_id"] = incident_id

            # Validate
            is_valid, errors = validate_incident_v2_2(payload)
            row.valid = is_valid
            row.extracted = True
            row.extracted_at = datetime.now(timezone.utc)

            if not is_valid:
                row.validation_errors = "; ".join(errors[:5])  # Cap at 5 errors
                logger.warning(f"{incident_id}: validation failed: {errors[:3]}")

            # Write JSON regardless (for debugging)
            json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            logger.info(f"{incident_id}: extracted (valid={is_valid})")

        except Exception as e:
            row.error = str(e)[:200]
            logger.error(f"{incident_id}: extraction failed: {e}")

        rows.append(row)

    return rows
