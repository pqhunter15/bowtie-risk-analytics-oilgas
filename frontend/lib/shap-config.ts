/**
 * Single source of truth for SHAP feature display names and hidden feature set.
 *
 * Import from this module in DetailPanel, TopAtRiskBarriers, DriversHF, RankedBarriers
 * instead of duplicating these constants.
 */

import { PIF_DISPLAY_NAMES } from '@/lib/types'

/** Incident-level features that are non-actionable — excluded from SHAP charts.
 *  source_agency was removed from the model (users always default to UNKNOWN).
 *  primary_threat_category is a legitimate feature but non-actionable for end users. */
export const SHAP_HIDDEN_FEATURES = new Set(['primary_threat_category'])

/** Display names for all SHAP features: barrier-category + PIF + numeric. */
export const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  // Barrier-category features
  barrier_family: 'Barrier Family',
  side: 'Pathway Position',
  barrier_type: 'Barrier Type',
  line_of_defense: 'Line of Defense',
  primary_threat_category: 'Threat Category',
  supporting_text_count: 'Evidence Volume',
  // Numeric incident features
  pathway_sequence: 'Pathway Sequence',
  upstream_failure_rate: 'Upstream Failure Rate',
  // Not in the current feature set but kept for display-name completeness
  top_event_category: 'Top Event Category',
  // PIF features (from lib/types.ts PIF_DISPLAY_NAMES)
  ...(PIF_DISPLAY_NAMES as Record<string, string>),
}
