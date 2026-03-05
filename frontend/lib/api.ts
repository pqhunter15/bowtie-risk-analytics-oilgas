import type { ExplainRequest, ExplainResponse, PredictRequest, PredictResponse } from './types'

/**
 * POST /api/predict — assess barrier historical reliability and SHAP values.
 *
 * The /api prefix is proxied by next.config.ts rewrites to localhost:8000,
 * so the browser only ever talks to the Next.js dev server (no CORS issues).
 *
 * Response includes Phase 8 fields: degradation_factors, risk_level,
 * barrier_type_display, lod_display, barrier_condition_display.
 *
 * @param payload - Barrier features to assess.
 * @returns Historical reliability assessment with SHAP values for both models.
 * @throws Error if the server returns a non-OK status.
 */
export async function predict(payload: PredictRequest): Promise<PredictResponse> {
  const res = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Assessment failed: ${res.status} ${res.statusText}`)
  return res.json() as Promise<PredictResponse>
}

/**
 * POST /api/explain — retrieve RAG evidence, LLM narrative, and recommendations for a barrier.
 *
 * Evidence is fetched on-demand per barrier click, not pre-fetched for all
 * barriers (LLM calls are expensive — D-15).
 *
 * Response includes Phase 8 field: recommendations.
 *
 * @param payload - Barrier description and optional SHAP context.
 * @returns Evidence narrative with similar incident citations and recommendations.
 * @throws Error if the server returns a non-OK status.
 */
export async function explain(payload: ExplainRequest): Promise<ExplainResponse> {
  const res = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Evidence retrieval failed: ${res.status} ${res.statusText}`)
  return res.json() as Promise<ExplainResponse>
}
