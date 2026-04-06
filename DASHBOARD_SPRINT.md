# Bowtie Risk Analytics — Final Sprint Plan
# GSD v2 Execution — Dashboard + Bowtie Diagram Fusion

## Product Vision
An integrated oil & gas process safety platform combining:
- BowTieXP-style bowtie diagram visualization (built — BowtieSVG.tsx)
- ML-driven predictive barrier health dashboard (to build)
- SHAP explainability as primary trust mechanism (built — ShapWaterfall.tsx)
- RAG-backed evidence from real BSEE/CSB incidents (built — EvidenceSection.tsx)

Two modes, one platform. Click barrier on diagram → see analytics on dashboard.
See high-risk barrier on dashboard → jump to it on the diagram.

Reference: Presight (Norway) is the closest UX benchmark for dashboard-bowtie fusion.
BowTieXP Enterprise has separate dashboard and diagram views connected by navigation.
Our approach integrates both into a single app with a mode toggle.

## Professor's Direction (April 5, 2026 email from Prof. Ageenko)
"The highest value contribution from your project is the modeling of barrier failure/barrier health.
Rather than investing significant effort trying to build a diagram UI, I suggest prioritizing
visualizing the results and adding and integrating explainability. A dashboard visualization
approach allows your pod to concentrate in the areas where you add the most value: modeling,
evaluation, explainability, and decision-support visualization."

Required deliverables:
1. Dashboard structure: main pages/tabs (Executive summary, ranked barriers, drivers, human factors)
2. Drill-down paths, filters and key metrics
3. Integrated explanation design using RAG citations supporting recommendations
4. Example mock (shareable with Fidel)

## What's Already Built (DO NOT rebuild)
- FastAPI: /predict (batch), /explain, /health endpoints
- 3 XGBoost models: F1=0.928 (binary barrier failure), 0.348 (HF sensitivity), 0.588 (multiclass condition)
- SHAP: 18 features (6 categorical + 9 PIFs + 3 numeric), hidden source_agency + primary_threat_category
- RAG: 4-stage hybrid FAISS+RRF, 526 incidents, 3,253 barriers, MRR=0.40, Claude Haiku narratives
- BowtieSVG.tsx: pure SVG bowtie diagram with threats, barriers, top event, consequences
- DetailPanel.tsx with tabs: Overview / SHAP Analysis / Evidence
- ShapWaterfall.tsx: horizontal SHAP waterfall chart (Recharts)
- EvidenceSection.tsx: RAG narrative + citations + recommendations
- RiskScoreBadge.tsx: traffic-light risk level display
- BarrierForm.tsx: sidebar with barrier input, PIF checkboxes, Analyze button
- BowtieContext.tsx: shared state for barriers, predictions, selected barrier
- Dark sidebar theme (#1A1D27), light diagram canvas (#E0E0E0)
- Apriori: 16 co-failure rules in configs/apriori_rules.yaml
- Docker Compose (3 containers: API, frontend, nginx)
- 479 Python tests + frontend vitest tests
- Risk thresholds: p60=0.9801, p80=0.9932

## GSD Execution Rules
1. Do NOT run `next build` or `npx next build` — dev server handles hot reload
2. /gsd auto for: API work, tests, component logic, data wiring, table/chart components
3. /gsd next (with human visual verification) for: layout changes, complex styling, spatial positioning
4. After each milestone: pause for git commit + push
5. No regressions — all tests must pass after every milestone
6. Reuse existing components wherever possible (ShapWaterfall, EvidenceSection, RiskScoreBadge)
7. All new dashboard components go in frontend/components/dashboard/
8. Dark theme tokens: bg=#1A1D27, surface=#242836, border=#2E3348, text=#E8ECF4, muted=#8B93A8
9. Risk colors: High=#EF4444, Medium=#F59E0B, Low=#22C55E, Unanalyzed=#64748B
10. Accent blue: #3B82F6

## Tech Stack for Dashboard
- Next.js 15, React, TypeScript
- Recharts for charts (already installed)
- shadcn/ui components (already installed: accordion, tabs, card, badge, button, dialog)
- Tremor for metric cards (already installed)
- Tailwind CSS for styling
- lucide-react for icons (already installed)

---

## M001: Dashboard Shell + Mode Toggle

### Slice 1: Create DashboardView component
File: frontend/components/dashboard/DashboardView.tsx
- 4-tab navigation bar at top: Executive Summary | Ranked Barriers | Drivers & HF | Evidence
- Tab styling: bg-[#242836] container, active tab text-[#E8ECF4] with border-b-2 border-[#3B82F6], inactive text-[#5A6178]
- Each tab renders a placeholder div with tab name for now
- Full-width layout, dark background (#1A1D27)
- useState for activeTab, default "executive"

### Slice 2: Mode toggle in BowtieApp.tsx
- Add mode toggle at top of BowtieApp: [📊 Dashboard] [🔷 Bowtie Diagram]
- Toggle styling: bg-[#242836] rounded-lg, active mode bg-[#3B82F6] text-white, inactive text-[#8B93A8]
- Dashboard mode: hide sidebar, render DashboardView full-width (no BarrierForm, no BowtieSVG, no DetailPanel)
- Bowtie Diagram mode: render existing layout (sidebar + BowtieSVG + DetailPanel) exactly as-is
- State: useState<'dashboard' | 'diagram'>('dashboard') — dashboard is default
- Both modes share BowtieContext (barriers, predictions, selectedBarrier)

### Slice 3: Tests
- Test mode toggle renders correct view
- Test tab navigation in dashboard switches content
- Test bowtie diagram mode still works (no regression)
- Run: cd frontend && npx vitest run

---

## M002: Executive Summary Tab

### Slice 1: Risk distribution chart
File: frontend/components/dashboard/ExecutiveSummary.tsx
- Recharts horizontal BarChart showing count of barriers at each risk level
- 3 bars: High (red #EF4444), Medium (amber #F59E0B), Low (green #22C55E)
- X-axis: count, Y-axis: risk level labels
- Dark chart theme: bg transparent, axis text #8B93A8, grid lines #2E3348
- Title: "Barrier Risk Distribution" in #E8ECF4

### Slice 2: Top-5 at-risk barriers cards
- 5 horizontal cards ranked by failure probability (highest first)
- Each card shows: rank number, barrier name, risk level badge (reuse RiskScoreBadge), top SHAP factor name + value, barrier type
- Card styling: bg-[#242836], border-[#2E3348], hover:bg-[#2E3348]
- Click card → set activeTab to "ranked" AND set selectedBarrier in context
- If fewer than 5 barriers analyzed, show however many exist

### Slice 3: Model performance KPIs
- 4 metric cards in a row:
  - Model 1 F1: 0.928 (label: "Barrier Failure Detection")
  - Model 3 F1: 0.588 (label: "Condition Classification")
  - Training Data: "558 barriers / 174 incidents"
  - NDCG@10: 1.000 (label: "Ranking Accuracy")
- Card styling: bg-[#242836], metric value large (#E8ECF4), label small (#8B93A8)

### Slice 4: Scenario context
- Shows: top event name, total barriers analyzed, prevention count, mitigation count
- Data source: barriers array from BowtieContext + predictions from /predict batch call
- On component mount: if barriers exist but no predictions, trigger batch /predict

---

## M003: Ranked Barriers Tab (PRIMARY DECISION-SUPPORT VIEW)

### Slice 1: Sortable table component
File: frontend/components/dashboard/RankedBarriers.tsx
- Table with columns: Rank | Barrier Name | Risk Level | Condition | Top SHAP Factor | Type | LOD | Side
- Default sort: rank ascending (highest failure probability = rank 1)
- Click column header → sort by that column (toggle asc/desc)
- Sort indicator: ▲/▼ arrow next to sorted column header
- Risk Level column: colored badge (red/amber/green pill)
- Table styling: bg-[#1A1D27], header bg-[#242836], row hover bg-[#242836], border-[#2E3348], text #E8ECF4

### Slice 2: Expandable row detail
- Click any table row → expand an inline detail section below the row
- Expanded section contains:
  - RiskScoreBadge component (reuse existing)
  - "Barrier Analysis Factors" summary text (base rate + primary degradation factors)
  - ShapWaterfall component for Model 1 (reuse existing — pass barrier's shap_values)
  - "Load Evidence" button: bg-[#3B82F6], on click → call /explain API → show evidence narrative inline
- Only one row expanded at a time (clicking another collapses the previous)
- Expanded row highlight: bg-[#242836] with left border accent #3B82F6

### Slice 3: Filter bar
- Row of filter dropdowns above the table:
  - Side: All | Prevention | Mitigation
  - Risk Level: All | High | Medium | Low
  - Barrier Type: All | Engineering | Administrative
  - LOD: All | 1st | 2nd | 3rd | Recovery
- Dark-styled select elements: bg-[#242836], border-[#2E3348], text-[#E8ECF4]
- Filters apply immediately (no submit button)
- Show "X results" count after filters

### Slice 4: Tests
- Test sort by each column
- Test filter by side, risk level, type
- Test row expansion shows ShapWaterfall
- Test "Load Evidence" calls /explain API
- Test only one row expanded at a time

---

## M004: Drivers & Human Factors Tab

### Slice 1: Global SHAP feature importance chart
File: frontend/components/dashboard/DriversHF.tsx
- Recharts horizontal BarChart: mean absolute SHAP value across ALL analyzed barriers
- Features sorted by importance (highest at top)
- Feature names mapped to display names:
  - upstream_failure_rate → "Upstream Failure Rate"
  - barrier_family → "Barrier Family"
  - evidence_volume → "Evidence Volume"
  - pathway_sequence → "Pathway Position"
  - line_of_defense → "Line of Defense"
  - barrier_type → "Barrier Type"
  - pif_* → degradation factor names from SHAP_FEATURE_NAMES mapping
- Bar color: #3B82F6 (accent blue)
- Dark theme: bg transparent, axis text #8B93A8
- Title: "Global Feature Importance" in #E8ECF4
- Subtitle: "Mean |SHAP| across all analyzed barriers" in #5A6178

### Slice 2: Human factor prevalence
- Horizontal BarChart showing frequency of each PIF appearing as top-3 SHAP contributor
- 9 active PIFs: competence, communication, situational_awareness, procedures, tools_equipment, safety_culture, management_of_change, supervision, training
- Display names: use degradation factor mapping (Operator Competence, Communication Breakdown, etc.)
- Color by PIF category: People=#6366F1, Work=#F97316, Organisation=#22C55E
- Title: "Degradation Factor Prevalence" in #E8ECF4

### Slice 3: Apriori co-failure rules table
- Load Jeffrey's 16 rules from configs/apriori_rules.yaml
- Create a simple API endpoint GET /api/apriori-rules that returns the YAML as JSON (or load client-side)
- Table columns: Antecedent Families | Consequent Family | Confidence | Lift | Support
- Sortable by confidence (default)
- Title: "Co-Failure Patterns (Apriori Association Rules)" in #E8ECF4
- Subtitle: "When these barrier families fail, related families also tend to fail" in #5A6178
- Table styling: same as Ranked Barriers table

### Slice 4: Tests
- Test SHAP aggregation math
- Test PIF prevalence calculation
- Test Apriori rules load and display

---

## M005: Evidence & Recommendations Tab

### Slice 1: Full-width evidence view
File: frontend/components/dashboard/EvidenceView.tsx
- Barrier selector dropdown at top: lists all analyzed barriers with their risk level
- Dropdown styling: dark, shows barrier name + risk badge
- Select barrier → calls /explain API → renders evidence below
- Reuse EvidenceSection component but in full-width layout (not constrained to 400px panel)
- Loading state: skeleton screen while /explain API processes

### Slice 2: Fix markdown rendering in evidence narrative
- The evidence narrative currently renders raw markdown (# headers, ## sections show as plain text)
- Parse markdown to HTML: install react-markdown or use simple regex replacement
- Render # as h2, ## as h3, - as bullet points
- Style headers: h2=#E8ECF4 font-size 16px bold, h3=#8B93A8 font-size 14px
- Style paragraphs: #8B93A8 font-size 14px line-height 1.6

### Slice 3: Enhanced recommendations display
- Parse "Recommendations" section from narrative
- Display as separate cards with blue left-border accent
- Each recommendation card: bg-[#242836], border-l-2 border-[#3B82F6]
- Confidence indicator: show RAG confidence score as colored dot (green >0.5, amber 0.25-0.5, red <0.25)

### Slice 4: Tests
- Test barrier selector loads correct evidence
- Test markdown rendering produces proper HTML
- Test confidence indicator colors

---

## M006: Integration, Polish, Deploy

### Slice 1: Diagram ↔ Dashboard cross-linking
- From Dashboard (Ranked Barriers tab): add "View on Diagram →" link in expanded row
  - Clicking switches mode to 'diagram' and sets selectedBarrier
  - BowtieSVG highlights that barrier (selected state styling)
- From Diagram (BowtieSVG): barrier click already opens DetailPanel
  - Add "View Full Analysis →" link in DetailPanel Overview tab
  - Clicking switches mode to 'dashboard', sets activeTab to 'ranked', expands that barrier's row
- Shared state: selectedBarrier in BowtieContext is the bridge

### Slice 2: Visual polish pass
- Ensure consistent dark theme across ALL dashboard components
- Loading skeletons during API calls (not spinners)
- Smooth tab transitions (optional: subtle fade)
- Empty states: "No barriers analyzed yet. Add barriers and click Analyze." message
- Error states: graceful API error handling with retry button
- Responsive: dashboard tabs stack on narrow screens

### Slice 3: Docker build + deploy
- Verify Docker Compose builds with new dashboard components
- Test: docker compose build && docker compose up -d
- Verify /api/health through nginx
- Verify frontend loads through nginx
- Test full flow: Dashboard mode → add barriers → analyze → ranked table → SHAP → evidence → diagram mode → click barrier
- Deploy to GNSR's server, note the URL

### Slice 4: Final test suite + git tag
- Run: python -m pytest tests/ -q (target: 479+ passing)
- Run: cd frontend && npx vitest run
- Verify all API endpoints: /predict, /explain, /health
- Git tag: v2.0.0-rc1
- Push tags: git push origin main --tags
