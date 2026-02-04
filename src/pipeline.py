import os
import json
import logging
from pathlib import Path
from typing import List

from src.ingestion.loader import load_incident_from_text
from src.models.incident import Incident

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def process_raw_files(raw_dir: Path, processed_dir: Path) -> List[Incident]:
    """
    Reads raw text files, parses incidents, and saves structured JSON.

    Args:
        raw_dir: Directory containing raw text files.
        processed_dir: Directory to save processed JSON files.

    Returns:
        List of successfully processed Incident objects.
    """
    processed_incidents = []

    if not raw_dir.exists():
        logger.error(f"Raw directory not found: {raw_dir}")
        return []

    processed_dir.mkdir(parents=True, exist_ok=True)

    for file_path in raw_dir.glob("*.txt"):
        logger.info(f"Processing file: {file_path.name}")

        try:
            content = file_path.read_text(encoding='utf-8')
            # Simple splitter for the sample format (blocks separated by blank lines)
            blocks = content.strip().split('\n\n')

            for block in blocks:
                if not block.strip():
                    continue

                try:
                    incident = load_incident_from_text(block)
                    processed_incidents.append(incident)

                    # Save individual JSON
                    output_file = processed_dir / f"{incident.incident_id}.json"
                    output_file.write_text(incident.model_dump_json(indent=2), encoding='utf-8')
                    logger.info(f"Saved {incident.incident_id}")

                except ValueError as e:
                    logger.warning(f"Failed to parse block in {file_path.name}: {e}")

        except Exception as e:
            logger.error(f"Error reading file {file_path.name}: {e}")

    logger.info(f"Pipeline finished. Processed {len(processed_incidents)} incidents.")
    return processed_incidents

if __name__ == "__main__":
    # Define paths relative to the project root
    # Assuming this script is at src/pipeline.py, project root is one level up?
    # No, src/ is one level up from pipeline.py? No, pipeline.py is IN src/.
    # So __file__ = src/pipeline.py. parent = src. parent.parent = root.
    BASE_DIR = Path(__file__).resolve().parent.parent
    RAW_DIR = BASE_DIR / "data" / "raw"
    PROCESSED_DIR = BASE_DIR / "data" / "processed"

    process_raw_files(RAW_DIR, PROCESSED_DIR)
