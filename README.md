# Bowtie Risk Analytics for Oil & Gas

A Streamlit-based application for analyzing oil and gas industry incidents using the Bowtie risk methodology.

## Overview

This project provides tools for:
- Extracting structured data from incident narratives
- Analyzing incidents using Bowtie diagrams
- Visualizing risk factors and control measures

## Project Structure

```
src/
├── models/      # Pydantic data models
├── analytics/   # Bowtie analytics logic
└── app/         # Streamlit application

data/
├── raw/         # Raw incident narratives
├── processed/   # Extracted JSON incidents
└── sample/      # Sample data for testing

docs/
├── DEVLOG.md       # Development log
├── STEP_TRACKER.md # Step progress tracker
└── DECISIONS.md    # Architecture decisions
```

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Run tests
pytest -v
```

## Development

See `docs/DEVLOG.md` for development progress and `docs/DECISIONS.md` for architecture decisions.
