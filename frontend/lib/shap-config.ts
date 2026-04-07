/**
 * Single source of truth for SHAP feature display names and hidden feature set.
 *
 * Import from this module in DetailPanel, TopAtRiskBarriers, DriversHF, RankedBarriers
 * instead of duplicating these constants.
 */

import { PIF_DISPLAY_NAMES } from '@/lib/types'

/** Incident-level features that are non-actionable — excluded from SHAP charts. */
export const SHAP_HIDDEN_FEATURES = new Set(['source_agency', 'primary_threat_category'])

/** Display names for all SHAP features: barrier-category + PIF + numeric. */
export const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  // Barrier-category features
  source_agency: 'Data Source',
  barrier_family: 'Barrier Family',
  side: 'Pathway Position',
  barrier_type: 'Barrier Type',
  line_of_defense: 'Line of Defense',
  supporting_text_count: 'Evidence Volume',
  // Numeric incident features
  pathway_sequence: 'Pathway Sequence',
  upstream_failure_rate: 'Upstream Failure Rate',
  // Incident-context feature (in hidden set but included for completeness)
  top_event_category: 'Top Event Category',
  // PIF features (from lib/types.ts PIF_DISPLAY_NAMES)
  ...(PIF_DISPLAY_NAMES as Record<string, string>),
}
