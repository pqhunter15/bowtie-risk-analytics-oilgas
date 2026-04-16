/**
 * Hardcoded hex values for Recharts (which cannot consume CSS vars directly).
 * Keep in sync with CSS variables in globals.css .dark {} block.
 */
export const CHART_COLORS = {
  shapIncreasing: '#EF4444',
  shapDecreasing: '#3B82F6',

  cat1: '#3B82F6',
  cat2: '#14B8A6',
  cat3: '#F5B740',
  cat4: '#8B5CF6',
  cat5: '#F97316',

  riskHigh: '#EF4444',
  riskMedium: '#F5B740',
  riskLow: '#22C55E',
  riskUnanalyzed: '#606873',

  sidePrevention: '#3B82F6',
  sideMitigation: '#14B8A6',

  gridLine: '#2A3040',
  referenceLine: '#2A3040',

  foreground: '#E6EAF0',
  mutedForeground: '#848B98',
  cardBg: '#161B26',
} as const
