# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bowtie Risk Analytics is a Python pipeline, RAG retrieval system, and Streamlit dashboard for analyzing oil & gas incidents using the Bowtie risk methodology. It ingests public incident reports (CSB, BSEE), extracts structured risk data via LLM, retrieves similar barrier failures via hybrid semantic search, and calculates barrier coverage metrics. Current scope: **Loss of Containment** scenarios.

**Core question this system answers:** "Which barriers in this Bowtie are most likely to be weak or fail, and why?"

**Binary prediction target:** label = 1 when barrier didn't perform (failed/degraded/not_installed/bypassed) AND human factors contributed (barrier_failed_human == True). Exclude unknowns from training.

## Commands

```bash
# Install dependencies
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Run all tests
pytest

# Run a single test file
pytest tests/test_engine.py

# Pipeline CLI
python -m src.pipeline acquire --csb-limit 20 --bsee-limit 20 --download
python -m src.pipeline extract-text
python -m src.pipeline extract-structured --provider anthropic --model claude-sonnet-4-5-20250929
python -m src.pipeline extract-structured --provider stub --limit 3   # no API key needed
python -m src.pipeline schema-check --incident-dir data/structured/incidents/schema_v2_3
python -m src.pipeline quality-gate --incident-dir data/structured/incidents/schema_v2_3
python -m src.pipeline convert-schema --incident-dir data/structured/incidents/anthropic --out-dir data/structured/incidents/schema_v2_3
python -m src.pipeline build-combined-exports   # produces flat_incidents_combined.csv + controls_combined.csv
python -m src.pipeline discover-source --source csb|bsee|phmsa|tsb
python -m src.pipeline ingest-source --source bsee --url-list configs/sources/bsee/url_list.csv
python -m src.pipeline corpus-manifest
python -m src.pipeline corpus-extract --policy configs/model_policy.yaml
python -m src.pipeline corpus-clean

# Streamlit dashboard
streamlit run src/app/main.py

# RAG evaluation
python scripts/evaluate_retrieval.py

# Association mining chain (standalone scripts, not pipeline)
python scripts/association_mining/jsonaggregation.py
python scripts/association_mining/jsonflattening.py
python scripts/association_mining/event_barrier_normalization.py
```

## Architecture

**Data flow:**
```
raw/ → structured/incidents/schema_v2_3/ → processed/ (flat CSVs) → modeling → dashboard
                                         → RAG corpus (embeddings + retrieval)
```

**Key modules:**

### Models & Validation
- `src/models/incident_v23.py` — IncidentV23 Pydantic v2 model (canonical Schema v2.3)
- `src/models/incident.py` — Legacy Incident model
- `src/models/bowtie.py` — Legacy Bowtie model
- `src/validation/incident_validator.py` — Pydantic validation

### Ingestion & Extraction
- `src/ingestion/structured.py` — LLM extraction orchestrator, `get_controls()` (single source of truth for control extraction)
- `src/ingestion/loader.py` — Raw text parsing
- `src/ingestion/manifests.py` — CSV manifest models (download/extraction state tracking)
- `src/ingestion/pdf_text.py` — PDF text extraction via pdfplumber
- `src/ingestion/normalize.py` — V2.2 to V2.3 normalization
- `src/ingestion/source_ingest.py` — Ingest PDFs from URL lists or local directories
- `src/ingestion/sources/` — Source-specific discovery and download (csb, bsee, phmsa, tsb)
- `src/extraction/` — Multi-pass PDF extraction with quality gating
- `src/corpus/` — corpus_v1 management (manifest, extract, clean)

### LLM Providers
- `src/llm/base.py` — LLM provider ABC
- `src/llm/anthropic_provider.py` — Anthropic Claude (default production provider)
- `src/llm/stub.py` — StubProvider for testing (no API key needed)
- `src/llm/model_policy.py` — YAML-driven model ladder (haiku to sonnet escalation)
- `src/llm/registry.py` — Provider registry

### Analytics
- `src/analytics/engine.py` — Barrier coverage calculation and gap identification (legacy, V1-era)
- `src/analytics/aggregation.py` — Fleet-wide metric aggregation
- `src/analytics/flatten.py` — V2.3 controls to flat CSV (CONTROLS_CSV_COLUMNS: 16 columns)
- `src/analytics/build_combined_exports.py` — Combined flat_incidents + controls CSVs across all sources
- `src/analytics/control_coverage_v0.py` — Coverage score from flat controls
- `src/analytics/baseline.py` — Pandas-based summary analytics
- `src/nlp/loc_scoring.py` — Keyword-based Loss of Containment scoring (LOC_v1, frozen)

### RAG Retrieval System
- `src/rag/config.py` — Pipeline constants
- `src/rag/embeddings/` — EmbeddingProvider ABC + SentenceTransformer implementation (all-mpnet-base-v2)
- `src/rag/vector_index.py` — FAISS IndexFlatIP wrapper with mask support
- `src/rag/corpus_builder.py` — V2.3 JSON to barrier/incident document CSVs, barrier family assignment, PIF extraction
- `src/rag/retriever.py` — 4-stage hybrid retrieval (metadata filter, dual FAISS, intersection, RRF ranking)
- `src/rag/reranker.py` — Optional cross-encoder reranker (ms-marco-MiniLM-L-6-v2)
- `src/rag/context_builder.py` — Structured context text assembly (8000 char max)
- `src/rag/rag_agent.py` — RAGAgent orchestrator (from_directory, explain)

### Application
- `src/app/main.py` — Streamlit dashboard entry point (skeleton, needs rebuild)
- `src/app/utils.py` — Data loading from data/processed/

### Pipeline Orchestration
- `src/pipeline.py` — CLI entry point with 15+ subcommands
- `src/prompts/loader.py` — Extraction prompt loader with template substitution

### Association Mining (standalone scripts)
- `scripts/association_mining/jsonaggregation.py` — JSON to aggregated incidents
- `scripts/association_mining/jsonflattening.py` — Aggregated to flat barrier rows
- `scripts/association_mining/event_barrier_normalization.py` — 4-quadrant barrier family assignment (45 families)

## Data Directories

```
data/
  raw/<source>/             # L0: Ingested PDFs + extracted text (bsee, csb, phmsa, tsb)
  structured/
    incidents/schema_v2_3/  # L1: 739 canonical V2.3 JSONs (SINGLE SOURCE OF TRUTH)
  processed/                # L2: Analytics-ready flat exports
    flat_incidents_combined.csv   # 739 rows, includes 12 PIF _mentioned columns
    controls_combined.csv         # 4,776 rows, 16+ columns per control
  corpus_v1/                # Frozen V2.2 corpus (147 incidents, self-contained)
  evaluation/               # RAG evaluation dataset + results (committed)

out/
  association_mining/       # Script-only outputs (not consumed by pipeline)
```

**Layer isolation:** L0 never reads L1/L2. L1 reads L0 only. L2 reads L1 only.

**Data is gitignored** except data/samples/ and data/evaluation/. Reproduce via pipeline commands.

## Architecture Freeze v1

**Status:** FROZEN as of 2026-03-04. Read `docs/architecture/ARCHITECTURE_FREEZE_v1.md` before any structural changes.

**Extension rules for new work:**
- Model artifacts go in `data/models/` (new dir, must update data_pipeline_contract_v1.md)
- Models consume from L2 (`processed/`) or `out/association_mining/`
- Never write to `structured/` or `raw/`
- RAG reads from L1 or L2, never L0
- New modeling code goes in `src/modeling/`

**Forbidden patterns:**
- Do not create dirs under data/structured/incidents/ beyond schema_v2_3/
- Do not bypass get_controls() for control extraction
- Do not store ML/RAG artifacts in structured/ or raw/
- Do not write to out/ from src/pipeline.py

## Key Schema Fields

**Controls CSV columns (from src/analytics/flatten.py CONTROLS_CSV_COLUMNS):**
incident_id, control_id, name, side, barrier_role, barrier_type, line_of_defense, lod_basis, linked_threat_ids, linked_consequence_ids, barrier_status, barrier_failed, human_contribution_value, barrier_failed_human, confidence, supporting_text_count

**Additional columns in combined exports:** source_agency, provider_bucket, json_path

**Incidents CSV PIF columns (12 _mentioned booleans):**
People: competence_mentioned, fatigue_mentioned, communication_mentioned, situational_awareness_mentioned
Work: procedures_mentioned, workload_mentioned, time_pressure_mentioned, tools_equipment_mentioned
Organisation: safety_culture_mentioned, management_of_change_mentioned, supervision_mentioned, training_mentioned

## Label Derivation (for ML modeling)

```python
barrier_did_not_perform = barrier_status in ('failed', 'degraded', 'not_installed', 'bypassed')
hf_contributed = barrier_failed_human == True
label = 1 if (barrier_did_not_perform and hf_contributed) else 0
# EXCLUDE rows where barrier_status == 'unknown'
```

## Code Conventions

- Python 3.10+, type hints required on all functions
- Pydantic v2 for all data models with ConfigDict(strict=False) for flexible parsing
- PEP 8 formatting
- Tests in tests/ matching test_*.py pattern
- Update docs/devlog/DEVLOG.md with significant progress
- V2.3 JSON files: read with encoding="utf-8-sig", write with encoding="utf-8"

## Gotchas

- **Canonical schema is V2.3** — 7 top-level keys: incident_id, source, context, event, bowtie, pifs, notes
- V2.2 to V2.3 key changes: side prevention to left / mitigation to right; barrier_status active to worked; line_of_defense "1st" to 1 (int)
- source.agency is absent from real JSONs; source_agency resolution uses doc_type, then URL, then path segment, then UNKNOWN
- RAGAgent.explain() returns ExplanationResult with context_text but does NOT call an LLM — it is retrieval only
- pipeline.py infinite recursion bug in get_sources_root() has been fixed (no longer present)
- Test count: 480 Python tests (pytest), 156 frontend tests (vitest)

## RAG System

**Corpus:** 526 incidents, 3,253 barrier controls, 25 barrier families
**Baseline performance (50-query benchmark):** Top-1=0.30, Top-5=0.56, Top-10=0.62, MRR=0.40
**Tag:** v1.0-rag-baseline

## Modeling Requirements

- 2-3 models max: LogReg baseline, XGBoost improved, optional advanced
- Human factors are INPUT FEATURES, not a separate modeling objective
- Model explainability is PRIMARY (SHAP, reason codes); RAG evidence is SUPPORTING
- Evaluation: Precision@k + Recall@k quantitative AND qualitative rubric
- Minimum 150-250 labeled examples with cross-validation
- Deploy demo to Streamlit Community Cloud

## What Needs Building

1. `src/modeling/feature_engineering.py` — join controls + incidents CSVs, derive binary label, encode features, output feature matrix
2. `src/modeling/train.py` — LogReg + XGBoost, stratified 5-fold CV, save models to data/models/artifacts/
3. `src/modeling/explain.py` — SHAP values + per-barrier reason codes
4. `src/modeling/predict.py` — inference on new/unseen controls
5. `src/rag/explainer.py` — wire RAG context + SHAP reasons to LLM API for evidence narrative
6. `src/app/` rebuild — Streamlit dashboard: barrier health predictions + SHAP + RAG evidence
7. Deploy to Streamlit Community Cloud

## Session Checkpoint

**Last completed:** RAG Phase 2 cross-encoder reranker merged to main (v1.0-rag-baseline, 2026-03-05). Architecture Freeze v1 documented and tagged (pipeline-freeze-v1, 2026-03-04).
**Current state:** 739 incidents, 4,776 controls, 362 tests passing, architecture frozen, RAG functional.
**Next up:** Phase 1 — Feature engineering (src/modeling/feature_engineering.py)
