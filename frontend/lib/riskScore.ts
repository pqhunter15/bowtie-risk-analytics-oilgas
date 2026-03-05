import type { RiskLevel, RiskThresholds } from './types'

/**
 * Maps a barrier failure probability to a risk level using percentile cutoffs.
 *
 * Thresholds are derived from the training prediction distribution:
 * - Top 20% (>= p80): red
 * - Middle 40% (p60 to p80): amber
 * - Bottom 40% (< p60): green
 *
 * @param probability - Barrier failure probability in [0, 1] from model1_probability.
 * @param thresholds - Percentile cutoffs loaded from risk_thresholds.json.
 * @returns Risk level string (never 'unanalyzed').
 */
export function mapProbabilityToRiskLevel(
  probability: number,
  thresholds: RiskThresholds,
): Exclude<RiskLevel, 'unanalyzed'> {
  if (probability >= thresholds.p80) return 'red'
  if (probability >= thresholds.p60) return 'amber'
  return 'green'
}
