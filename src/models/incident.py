"""Pydantic models for oil and gas incident data."""

from datetime import date as date_type
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class Incident(BaseModel):
    """Structured representation of an oil and gas incident."""

    incident_id: str = Field(..., description="Unique identifier for the incident")
    date: Optional[date_type] = Field(None, description="Date of the incident")
    location: Optional[str] = Field(None, description="Location where the incident occurred")
    facility_type: Optional[str] = Field(None, description="Type of facility (e.g., refinery, platform)")

    # Incident classification
    incident_type: Optional[str] = Field(None, description="Type of incident (e.g., fire, explosion, spill)")
    severity: Optional[str] = Field(None, description="Severity level of the incident")

    # Narrative
    description: str = Field(..., description="Narrative description of the incident")

    # Bowtie elements
    hazard: Optional[str] = Field(None, description="Primary hazard identified")
    top_event: Optional[str] = Field(None, description="The top event in the Bowtie diagram")
    causes: List[str] = Field(default_factory=list, description="Contributing causes/threats")
    consequences: List[str] = Field(default_factory=list, description="Resulting consequences")
    prevention_barriers: List[str] = Field(default_factory=list, description="Prevention/left-side barriers")
    mitigation_barriers: List[str] = Field(default_factory=list, description="Mitigation/right-side barriers")

    # Outcomes
    injuries: Optional[int] = Field(None, ge=0, description="Number of injuries")
    fatalities: Optional[int] = Field(None, ge=0, description="Number of fatalities")
    environmental_impact: Optional[str] = Field(None, description="Description of environmental impact")

    # Metadata
    source: Optional[str] = Field(None, description="Source of the incident report")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "incident_id": "INC-2024-001",
                "date": "2024-01-15",
                "location": "Gulf of Mexico",
                "facility_type": "Offshore Platform",
                "incident_type": "Gas Release",
                "severity": "Major",
                "description": "Uncontrolled gas release from wellhead...",
                "hazard": "Hydrocarbon Release",
                "top_event": "Loss of Containment",
                "causes": ["Equipment failure", "Corrosion"],
                "consequences": ["Fire", "Platform evacuation"],
                "prevention_barriers": ["Pressure monitoring", "Maintenance program"],
                "mitigation_barriers": ["Emergency shutdown", "Fire suppression"],
                "injuries": 2,
                "fatalities": 0,
                "environmental_impact": "Minor hydrocarbon sheen on water",
                "source": "BSEE Investigation Report"
            }
        }
    )
