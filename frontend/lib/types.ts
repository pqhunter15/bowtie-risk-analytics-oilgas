// Risk levels (from UI-SPEC risk level color mapping)
export type RiskLevel = 'red' | 'amber' | 'green' | 'unanalyzed'

export interface RiskThresholds {
  p80: number
  p60: number
}

// ---------------------------------------------------------------------------
// API request/response types (mirroring src/api/schemas.py exactly)
// ---------------------------------------------------------------------------

export interface PredictRequest {
  side: string
  barrier_type: string
  line_of_defense: string
  barrier_family: string
  source_agency: string
  pif_competence?: number
  pif_fatigue?: number
  pif_communication?: number
  pif_situational_awareness?: number
  pif_procedures?: number
  pif_workload?: number
  pif_time_pressure?: number
  pif_tools_equipment?: number
  pif_safety_culture?: number
  pif_management_of_change?: number
  pif_supervision?: number
  pif_training?: number
  supporting_text_count?: number
}

export interface ShapValue {
  feature: string
  value: number
  category: 'barrier' | 'incident_context'
}

export interface FeatureMetadata {
  name: string
  category: string
}

export interface DegradationFactor {
  factor: string         // Display name: "Operator Fatigue"
  source_feature: string // Original pif_* key: "pif_fatigue"
  contribution: number   // SHAP value
  description: string    // Optional description
}

export interface PredictResponse {
  model1_probability: number
  model2_probability: number
  model1_shap: ShapValue[]
  model2_shap: ShapValue[]
  model1_base_value: number
  model2_base_value: number
  feature_metadata: FeatureMetadata[]
  // Phase 8: Process safety terminology fields
  degradation_factors: DegradationFactor[]
  risk_level: string              // "High" | "Medium" | "Low"
  barrier_type_display: string    // Mapped display name
  lod_display: string             // Mapped display name
  barrier_condition_display: string  // Mapped barrier condition characterization (Fidel-#59)
}

export interface ExplainRequest {
  barrier_family: string
  barrier_type: string
  side: string
  barrier_role: string
  event_description: string
  shap_factors?: ShapValue[]
  risk_level?: string           // H/M/L context from /predict result
}

export interface CitationResponse {
  incident_id: string
  control_id: string
  barrier_name: string
  barrier_family: string
  supporting_text: string
  relevance_score: number
  incident_summary: string
}

export interface ExplainResponse {
  narrative: string
  citations: CitationResponse[]
  retrieval_confidence: number
  model_used: string
  recommendations: string  // Phase 8 (D-12)
}

// ---------------------------------------------------------------------------
// Frontend-specific types
// ---------------------------------------------------------------------------

export interface PifFlags {
  pif_competence: number
  pif_fatigue: number
  pif_communication: number
  pif_situational_awareness: number
  pif_procedures: number
  pif_workload: number
  pif_time_pressure: number
  pif_tools_equipment: number
  pif_safety_culture: number
  pif_management_of_change: number
  pif_supervision: number
  pif_training: number
}

/** Default PIF values based on training data frequency (top 5 PIFs > 50% prevalence).
 *  procedures=84%, situational_awareness=73%, tools_equipment=67%,
 *  supervision=53%, safety_culture=52% */
export const DEFAULT_PIF_FLAGS: PifFlags = {
  pif_competence: 0,
  pif_fatigue: 0,
  pif_communication: 0,
  pif_situational_awareness: 1,
  pif_procedures: 1,
  pif_workload: 0,
  pif_time_pressure: 0,
  pif_tools_equipment: 1,
  pif_safety_culture: 1,
  pif_management_of_change: 0,
  pif_supervision: 1,
  pif_training: 0,
}

/** Display names for PIF flags (matches pif_to_degradation.yaml) */
export const PIF_DISPLAY_NAMES: Record<keyof PifFlags, string> = {
  pif_competence: 'Operator Competence',
  pif_fatigue: 'Operator Fatigue',
  pif_communication: 'Communication',
  pif_situational_awareness: 'Situational Awareness',
  pif_procedures: 'Procedures',
  pif_workload: 'Workload',
  pif_time_pressure: 'Time Pressure',
  pif_tools_equipment: 'Tools & Equipment',
  pif_safety_culture: 'Safety Culture',
  pif_management_of_change: 'Management of Change',
  pif_supervision: 'Supervision',
  pif_training: 'Training',
}

export interface Barrier {
  id: string
  name: string
  side: 'prevention' | 'mitigation'
  barrier_type: string
  barrier_family: string
  line_of_defense: string
  barrierRole: string
  riskLevel: RiskLevel
  probability?: number
}
