import os
import json
import logging
from pathlib import Path
from typing import List, Optional

from src.ingestion.loader import load_incident_from_text
from src.models.incident import Incident
from src.models.bowtie import Bowtie
from src.analytics.engine import calculate_barrier_coverage, identify_gaps
from src.analytics.aggregation import calculate_fleet_metrics

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def load_bowtie(bowtie_path: Path) -> Optional[Bowtie]:
    """Loads a Bowtie definition from a JSON file."""
    if not bowtie_path.exists():
        logger.warning(f"Bowtie definition not found at {bowtie_path}")
        return None

    try:
        data = json.loads(bowtie_path.read_text(encoding='utf-8'))
        return Bowtie(**data)
    except Exception as e:
        logger.error(f"Failed to load Bowtie definition: {e}")
        return None

def process_raw_files(raw_dir: Path, processed_dir: Path, bowtie_path: Optional[Path] = None) -> List[Incident]:
    """
    Reads raw text files, parses incidents, computes analytics, and saves structured JSON.

    Args:
        raw_dir: Directory containing raw text files.
        processed_dir: Directory to save processed JSON files.
        bowtie_path: Path to the reference Bowtie JSON file (optional).

    Returns:
        List of successfully processed Incident objects.
    """
    processed_incidents = []
    all_output_data = []

    if not raw_dir.exists():
        logger.error(f"Raw directory not found: {raw_dir}")
        return []

    processed_dir.mkdir(parents=True, exist_ok=True)

    # Load Bowtie reference if provided
    bowtie = load_bowtie(bowtie_path) if bowtie_path else None
    if bowtie:
        logger.info(f"Loaded Bowtie reference: {bowtie.hazard} -> {bowtie.top_event}")

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

                    # Prepare output data
                    output_data = incident.model_dump()

                    # Run analytics if Bowtie is available
                    if bowtie:
                        coverage = calculate_barrier_coverage(incident, bowtie)
                        gaps = identify_gaps(incident, bowtie)

                        output_data["analytics"] = {
                            "coverage": coverage,
                            "gaps": [gap.model_dump() for gap in gaps]
                        }
                        logger.info(f"Analyzed {incident.incident_id}: Coverage={coverage['overall_coverage']:.1%}, Gaps={len(gaps)}")

                    all_output_data.append(output_data)

                    # Save enriched JSON
                    output_file = processed_dir / f"{incident.incident_id}.json"
                    output_file.write_text(json.dumps(output_data, indent=2, default=str), encoding='utf-8')
                    logger.info(f"Saved {incident.incident_id}")

                except ValueError as e:
                    logger.warning(f"Failed to parse block in {file_path.name}: {e}")

        except Exception as e:
            logger.error(f"Error reading file {file_path.name}: {e}")

    # Calculate and save aggregate metrics
    if all_output_data:
        metrics = calculate_fleet_metrics(all_output_data)
        metrics_file = processed_dir / "fleet_metrics.json"
        metrics_file.write_text(json.dumps(metrics, indent=2), encoding='utf-8')
        logger.info(f"Saved fleet metrics to {metrics_file.name}")

    logger.info(f"Pipeline finished. Processed {len(processed_incidents)} incidents.")
    return processed_incidents

if __name__ == "__main__":
    # Define paths relative to the project root
    BASE_DIR = Path(__file__).resolve().parent.parent
    RAW_DIR = BASE_DIR / "data" / "raw"
    PROCESSED_DIR = BASE_DIR / "data" / "processed"
    BOWTIE_PATH = BASE_DIR / "data" / "sample" / "bowtie_loc.json"

    process_raw_files(RAW_DIR, PROCESSED_DIR, BOWTIE_PATH)
