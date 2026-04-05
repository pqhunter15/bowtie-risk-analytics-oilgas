# Architecture — Bowtie Risk Analytics

> **Status:** Frozen (Architecture Freeze v1, 2026-03-04). See `docs/architecture/ARCHITECTURE_FREEZE_v1.md` for extension rules.

---

## Overview

Bowtie Risk Analytics is an end-to-end pipeline for analyzing oil & gas incidents using the [Bowtie risk methodology](https://en.wikipedia.org/wiki/Bow_tie_analysis). It ingests public incident reports (CSB, BSEE, PHMSA, TSB), extracts structured risk data via LLM, predicts barrier failure probability with explainability (SHAP), retrieves similar historical failures via hybrid semantic search (RAG), and surfaces results through a Next.js dashboard backed by a FastAPI service.

**Core question:** *Which barriers in this Bowtie are most likely to be weak or fail, and why?*

**Current scope:** Loss of Containment (LOC) scenarios.

---

## System Architecture

The system is organized in five layers with strict unidirectional data flow:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 0 — Ingestion                                                │
│  data/raw/{csb,bsee,phmsa,tsb}/  (PDFs + extracted text)           │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1 — Structured Incidents                                     │
│  data/structured/incidents/schema_v2_3/  (739 canonical V2.3 JSONs) │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 2 — Flat Exports                                             │
│  data/processed/flat_incidents_combined.csv  (739 rows)             │
│  data/processed/controls_combined.csv        (4,776 rows)           │
└──────────┬────────────────────────────────────┬─────────────────────┘
           ▼                                    ▼
┌──────────────────────┐             ┌──────────────────────────────┐
│  ML Modeling Layer   │             │  RAG Retrieval Layer         │
│  src/modeling/       │             │  src/rag/                    │
│  data/models/        │             │  data/evaluation/rag_workspace│
└──────────┬───────────┘             └──────────────┬───────────────┘
           └─────────────────┬───────────────────────┘
                             ▼
             ┌───────────────────────────────┐
             │  API + Frontend               │
             │  src/api/ (FastAPI)           │
             │  frontend/ (Next.js 15)       │
             │  nginx (reverse proxy)        │
             └───────────────────────────────┘
```

**Isolation rules:**
- L0 never reads L1/L2. L1 reads L0 only. L2 reads L1 only.
- Modeling code reads from L2 (`processed/`) only — never writes back.
- RAG reads from L1 or L2. Never from L0.
- New modeling artifacts go in `data/models/` (gitignored). Reproduce via pipeline.

---

## Data Flow

### Ingestion → Extraction → Export

```
PDFs (CSB, BSEE, PHMSA, TSB)
  └─ src/pipeline.py acquire        → data/raw/<source>/pdf/
  └─ src/pipeline.py extract-text   → data/raw/<source>/text/
  └─ src/pipeline.py extract-structured (AnthropicProvider)
                                    → data/structured/incidents/schema_v2_3/
  └─ src/pipeline.py build-combined-exports
                                    → data/processed/controls_combined.csv
                                    → data/processed/flat_incidents_combined.csv
```

### Modeling Pipeline

```
data/processed/controls_combined.csv   ─┐
data/processed/flat_incidents_combined.csv ─┤
                                            ▼
                        src/modeling/feature_engineering.py
                          • Left-join controls + incident PIFs
                          • Derive binary labels from barrier_status
                          • OrdinalEncode 5 categorical features
                          • Assign barrier_family (25 families)
                                            │
                        data/models/artifacts/feature_matrix.parquet (4,688 rows)
                                            │
                        src/modeling/train.py
                          • 5-fold GroupKFold CV (incident_id groups)
                          • LogisticRegression (class_weight=balanced)
                          • XGBoost (scale_pos_weight from data)
                                            │
                        data/models/artifacts/xgb_model1.json (barrier failure)
                        data/models/artifacts/xgb_model2.json (HF sensitivity)
                        data/models/artifacts/logreg_model1.joblib
                        data/models/artifacts/logreg_model2.joblib
                        data/models/artifacts/shap_background_model*.npy
```

### RAG Retrieval Pipeline

```
data/evaluation/rag_workspace/
  embeddings/barrier_embeddings.npy    (all-mpnet-base-v2, 768-dim)
  embeddings/incident_embeddings.npy
  datasets/barrier_documents.csv       (3,253 barrier controls)
  datasets/incident_documents.csv      (526 incidents)
        │
  RAGAgent.from_directory()
        │
  HybridRetriever.retrieve()
    1. Metadata filter (barrier_family, PIF flags)
    2. Barrier FAISS search (top-50)
    3. Incident FAISS search (top-20)
    4. Intersection filter
    5. RRF ranking: score = 1/(60+r_barrier) + 1/(60+r_incident)
        │
  Optional: CrossEncoderReranker (ms-marco-MiniLM-L-6-v2)
        │
  ContextBuilder → 8000-char structured context
        │
  BarrierExplainer.explain()
    • Confidence gate: barrier_sim_score ≥ 0.25
    • Build SHAP section from top-5 factors
    • Call AnthropicProvider (claude-haiku-4-5) via asyncio.to_thread()
    • Parse narrative + recommendations sections
```

### Request Flow (Production)

```
Browser → nginx:80
  └─ /api/*  → FastAPI (uvicorn :8000)
       POST /predict  → BarrierPredictor.predict()  → XGBoost + SHAP
       POST /explain  → BarrierExplainer.explain()  → RAG + LLM
       GET  /health   → artifact status + uptime
  └─ /*      → Next.js standalone (:3000)
```

---

## Key Modules

### Ingestion & Extraction

| Module | Purpose |
|--------|---------|
| `src/pipeline.py` | CLI entry point, 15+ subcommands |
| `src/ingestion/structured.py` | LLM extraction orchestrator; `get_controls()` is the single source of truth for control extraction |
| `src/ingestion/source_ingest.py` | Ingest PDFs from URL lists or local directories |
| `src/ingestion/sources/` | Source-specific discovery and download (CSB, BSEE, PHMSA, TSB) |
| `src/ingestion/pdf_text.py` | PDF text extraction via pdfplumber |
| `src/ingestion/normalize.py` | V2.2 → V2.3 normalization |
| `src/llm/anthropic_provider.py` | Production LLM provider (synchronous, wrap with `asyncio.to_thread` in async contexts) |
| `src/llm/stub.py` | StubProvider for testing — no API key required |
| `src/llm/model_policy.py` | YAML-driven model ladder (haiku → sonnet escalation) |

### Data Models

| Module | Purpose |
|--------|---------|
| `src/models/incident_v23.py` | `IncidentV23` — canonical Schema v2.3 Pydantic model |
| `src/models/incident.py` | Legacy Incident model (V1-era) |
| `src/models/bowtie.py` | Legacy Bowtie model (V1-era) |

### ML Modeling

| Module | Purpose |
|--------|---------|
| `src/modeling/feature_engineering.py` | Build feature matrix: join CSVs, derive labels, OrdinalEncode, assign barrier families |
| `src/modeling/train.py` | Train LogReg + XGBoost with 5-fold GroupKFold CV |
| `src/modeling/explain.py` | SHAP TreeExplainer backgrounds + PIF ablation study |
| `src/modeling/predict.py` | `BarrierPredictor` — loads artifacts once at startup, serves per-request inference with SHAP |
| `src/modeling/profile.py` | Data profiling and label distribution reporting |

### RAG Retrieval System

| Module | Purpose |
|--------|---------|
| `src/rag/embeddings/sentence_transformers_provider.py` | Sentence embeddings (all-mpnet-base-v2, 768-dim) |
| `src/rag/vector_index.py` | FAISS `IndexFlatIP` wrapper with mask support (L2-normalized → cosine similarity) |
| `src/rag/corpus_builder.py` | V2.3 JSON → barrier/incident document CSVs; barrier family assignment |
| `src/rag/retriever.py` | `HybridRetriever` — 4-stage pipeline (filter → dual FAISS → intersection → RRF) |
| `src/rag/reranker.py` | Optional `CrossEncoderReranker` (ms-marco-MiniLM-L-6-v2) |
| `src/rag/context_builder.py` | Structured context text assembly (8,000 char max) |
| `src/rag/rag_agent.py` | `RAGAgent` orchestrator — `from_directory()`, `explain()` (retrieval only, no LLM) |
| `src/rag/explainer.py` | `BarrierExplainer` — RAG + confidence gate + LLM narrative |
| `src/rag/config.py` | Pipeline constants (`CONFIDENCE_THRESHOLD=0.25`) |

### API

| Module | Purpose |
|--------|---------|
| `src/api/main.py` | FastAPI application factory (`create_app()`), lifespan, 3 endpoints |
| `src/api/schemas.py` | Pydantic request/response models |
| `src/api/mapping_loader.py` | YAML mapping config loader (barrier types, LoD, PIF degradation names) |
| `configs/mappings/barrier_types.yaml` | 5-category barrier type → process safety display names |
| `configs/mappings/lod_categories.yaml` | 11-category line-of-defense mapping |
| `configs/mappings/pif_to_degradation.yaml` | PIF → degradation factor display names |

### Frontend

| Path | Purpose |
|------|---------|
| `frontend/app/page.tsx` | Next.js 15 App Router root page |
| `frontend/components/BowtieApp.tsx` | Root client component; owns `BowtieProvider` context boundary |
| `frontend/components/diagram/BowtieFlow.tsx` | React Flow bowtie diagram (nodeTypes must be at module scope) |
| `frontend/components/sidebar/BarrierForm.tsx` | Barrier input form |
| `frontend/components/panel/DetailPanel.tsx` | Barrier detail: prediction, SHAP waterfall, RAG evidence |
| `frontend/context/BowtieContext.tsx` | Global state: barriers, event description, predictions |
| `frontend/lib/types.ts` | TypeScript types mirroring API Pydantic schemas |

### Analytics

| Module | Purpose |
|--------|---------|
| `src/analytics/flatten.py` | V2.3 controls → 16-column flat CSV (`CONTROLS_CSV_COLUMNS`) |
| `src/analytics/build_combined_exports.py` | Combined `flat_incidents` + `controls` CSVs across all sources |
| `src/analytics/control_coverage_v0.py` | Coverage score from flat controls |
| `src/analytics/baseline.py` | Pandas-based summary analytics |

---

## Deployment

### Docker Compose Stack

Three containers orchestrated by `docker-compose.yml`:

```
nginx:80          ← public entry point
  /api/* → api:8000   (FastAPI + uvicorn, 1 worker)
  /*     → frontend:3000  (Next.js standalone)
```

**`Dockerfile.api`** (`python:3.12-slim`):
- Installs PyTorch CPU wheel pre-baked (`torch-2.11.0+cpu`)
- Pre-downloads `all-mpnet-base-v2` into image (`HF_HOME=/app/.cache/huggingface`)
- Copies `data/models/artifacts/` and `data/evaluation/rag_workspace/` at build time
- Copies `scripts/association_mining/` (required: `corpus_builder.py` imports it at module load)
- Healthcheck: `curl /health`, 30s interval, 15s start_period

**`Dockerfile.frontend`** (`node:20-alpine`):
- Multi-stage: builder + standalone runner
- `output: 'standalone'` in `next.config.ts` required for standalone build
- `ENV HOSTNAME=0.0.0.0` required — Next.js standalone binds to `127.0.0.1` by default

**Dependencies:**
- `frontend` depends on `api` with `condition: service_healthy`
- `api` healthcheck has `start_period: 15s` to allow XGBoost + FAISS load time

### Running Locally (Development)

```bash
# 1. Create virtual environment
python -m venv .venv && source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start API server
uvicorn src.api.main:app --reload --port 8000

# 4. Start frontend
cd frontend && npm install && npm run dev
```

### Running via Docker Compose

```bash
docker-compose up --build
```

Open `http://localhost` — nginx routes to frontend and proxies `/api/*` to FastAPI.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Schema version | V2.3 (7 top-level keys) | Stable canonical format for 739 incidents; V2.2 normalized on ingest |
| Label derivation | `barrier_status ∈ {failed, degraded, not_installed, bypassed}` | The `barrier_failed` CSV column diverges in 535 rows; status field is authoritative |
| Cross-validation | `GroupKFold(n_splits=5)` on `incident_id` | 12 PIF features are incident-level (broadcast); group isolation prevents leakage |
| ML framework | XGBoost (primary) + LogReg (baseline) | Gradient boosting for performance, LogReg for interpretability baseline |
| SHAP | `TreeExplainer` recreated from model + `.npy` background | `TreeExplainer` holds C++ references; not serializable — never save/load directly |
| Embedding model | `all-mpnet-base-v2` (768-dim, FAISS IndexFlatIP) | Strong semantic similarity for incident/barrier text; L2-normalized for cosine via inner product |
| RAG confidence gate | `barrier_sim_score ≥ 0.25` | `rrf_score` is rank-based, not a similarity measure; cosine similarity has a natural threshold |
| LLM provider | `AnthropicProvider` (claude-haiku-4-5 for narratives) | Cost-efficient for high-volume inference; wrapped in `asyncio.to_thread()` in async FastAPI routes |
| API startup | Single lifespan, `app.state` | All artifacts loaded once — no per-request model loading |
| Frontend | Next.js 15 App Router + React Flow + Recharts | Standalone output enables minimal production image; React Flow requires module-scope `nodeTypes` |
| Python version | 3.12 | PyTorch wheel availability (`cp312` only for the pre-baked CPU build) |
