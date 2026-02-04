import pytest
import json
from pathlib import Path
from src.app.utils import load_data

def test_load_data_returns_empty_when_no_data(tmp_path):
    # Given an empty directory
    data_dir = tmp_path / "processed"
    data_dir.mkdir()

    # When loading data
    incidents, metrics = load_data(data_dir)

    # Then
    assert incidents == []
    assert metrics["total_incidents"] == 0

def test_load_data_returns_correct_data(tmp_path):
    # Given a directory with data
    data_dir = tmp_path / "processed"
    data_dir.mkdir()
    
    # Create incident file
    incident_data = {"incident_id": "INC-001", "description": "Test"}
    (data_dir / "INC-001.json").write_text(json.dumps(incident_data), encoding='utf-8')
    
    # Create metrics file
    metrics_data = {
        "total_incidents": 1,
        "average_prevention_coverage": 0.8,
        "average_mitigation_coverage": 0.7,
        "average_overall_coverage": 0.75
    }
    (data_dir / "fleet_metrics.json").write_text(json.dumps(metrics_data), encoding='utf-8')

    # When loading data
    incidents, metrics = load_data(data_dir)

    # Then
    assert len(incidents) == 1
    assert incidents[0]["incident_id"] == "INC-001"
    assert metrics["total_incidents"] == 1
    assert metrics["average_overall_coverage"] == 0.75
