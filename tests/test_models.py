"""Tests for the Incident model."""

from datetime import date

import pytest

from src.models.incident import Incident


class TestIncident:
    """Test cases for the Incident model."""

    def test_create_minimal_incident(self):
        """Test creating an incident with minimal required fields."""
        incident = Incident(
            incident_id="INC-001",
            description="Test incident description"
        )
        assert incident.incident_id == "INC-001"
        assert incident.description == "Test incident description"
        assert incident.causes == []
        assert incident.consequences == []

    def test_create_full_incident(self):
        """Test creating an incident with all fields populated."""
        incident = Incident(
            incident_id="INC-002",
            date=date(2024, 1, 15),
            location="Gulf of Mexico",
            facility_type="Offshore Platform",
            incident_type="Gas Release",
            severity="Major",
            description="Uncontrolled gas release from wellhead",
            hazard="Hydrocarbon Release",
            top_event="Loss of Containment",
            causes=["Equipment failure", "Corrosion"],
            consequences=["Fire", "Platform evacuation"],
            prevention_barriers=["Pressure monitoring"],
            mitigation_barriers=["Emergency shutdown"],
            injuries=2,
            fatalities=0,
            environmental_impact="Minor hydrocarbon sheen",
            source="BSEE Report"
        )
        assert incident.incident_id == "INC-002"
        assert incident.date == date(2024, 1, 15)
        assert len(incident.causes) == 2
        assert incident.injuries == 2
        assert incident.fatalities == 0

    def test_incident_serialization(self):
        """Test that incident can be serialized to JSON."""
        incident = Incident(
            incident_id="INC-003",
            description="Test serialization"
        )
        json_data = incident.model_dump_json()
        assert "INC-003" in json_data
        assert "Test serialization" in json_data

    def test_incident_from_dict(self):
        """Test creating incident from dictionary."""
        data = {
            "incident_id": "INC-004",
            "description": "From dict",
            "causes": ["Cause A", "Cause B"]
        }
        incident = Incident(**data)
        assert incident.incident_id == "INC-004"
        assert len(incident.causes) == 2

    def test_injuries_must_be_non_negative(self):
        """Test that injuries cannot be negative."""
        with pytest.raises(ValueError):
            Incident(
                incident_id="INC-005",
                description="Test",
                injuries=-1
            )

    def test_fatalities_must_be_non_negative(self):
        """Test that fatalities cannot be negative."""
        with pytest.raises(ValueError):
            Incident(
                incident_id="INC-006",
                description="Test",
                fatalities=-1
            )
