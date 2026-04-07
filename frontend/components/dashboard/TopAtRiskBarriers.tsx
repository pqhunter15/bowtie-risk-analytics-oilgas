'use client'

import { useBowtieContext } from '@/context/BowtieContext'
import RiskScoreBadge from '@/components/panel/RiskScoreBadge'
import { SHAP_HIDDEN_FEATURES, FEATURE_DISPLAY_NAMES } from '@/lib/shap-config'
import type { Barrier, PredictResponse, ShapValue } from '@/lib/types'

// Re-export for downstream consumers (RankedBarriers imports from here)
export { SHAP_HIDDEN_FEATURES, FEATURE_DISPLAY_NAMES }

// ---------------------------------------------------------------------------
// Pure function
// ---------------------------------------------------------------------------

export interface AtRiskBarrierEntry {
  barrier: Barrier
  probability: number
  topFactor: ShapValue | null
}

/**
 * Build the top-N barriers ranked by failure probability descending.
 *
 * @param barriers   - All barriers from BowtieContext.
 * @param predictions - Map of barrierId → PredictResponse from BowtieContext.
 * @param n          - Max entries to return (default 5).
 * @returns Sorted array of AtRiskBarrierEntry, length ≤ n.
 */
export function buildTopAtRiskBarriers(
  barriers: Barrier[],
  predictions: Record<string, PredictResponse>,
  n = 5,
): AtRiskBarrierEntry[] {
  // Filter to only analyzed barriers
  const analyzed = barriers.filter((b) => predictions[b.id] !== undefined)

  // Sort descending by model1_probability
  const sorted = [...analyzed].sort(
    (a, b) => predictions[b.id].model1_probability - predictions[a.id].model1_probability,
  )

  // Take top n
  const top = sorted.slice(0, n)

  return top.map((barrier) => {
    const pred = predictions[barrier.id]
    const probability = pred.model1_probability

    // Find top SHAP factor: exclude hidden features, sort by |value| desc, take first
    const visibleShap = (pred.model1_shap ?? []).filter(
      (s) => !SHAP_HIDDEN_FEATURES.has(s.feature),
    )
    const sortedShap = [...visibleShap].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    const topFactor = sortedShap.length > 0 ? sortedShap[0] : null

    return { barrier, probability, topFactor }
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TopAtRiskBarriers() {
  const { barriers, predictions } = useBowtieContext()
  const items = buildTopAtRiskBarriers(barriers, predictions)

  return (
    <div data-testid="top-at-risk-barriers">
      <h3 className="text-base font-semibold mb-3 text-[#E8ECF4]">Top At-Risk Barriers</h3>

      {items.length === 0 ? (
        <p className="text-sm text-[#5A6178]">
          Run Analyze Barriers to see top risk rankings
        </p>
      ) : (
        <div>
          {items.map((item) => {
            const featureName = item.topFactor
              ? (FEATURE_DISPLAY_NAMES[item.topFactor.feature] ?? item.topFactor.feature)
              : null
            const isPositive = item.topFactor ? item.topFactor.value >= 0 : false

            return (
              <div
                key={item.barrier.id}
                className="bg-[#242836] rounded-lg p-3 mb-2"
              >
                {/* Barrier name */}
                <p className="text-base font-semibold text-[#E8ECF4] mb-2">
                  {item.barrier.name}
                </p>

                {/* Risk badge */}
                <RiskScoreBadge
                  probability={item.probability}
                  riskLevel={item.barrier.riskLevel}
                />

                {/* Top SHAP factor */}
                {item.topFactor && featureName && (
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-[#8B93A8] truncate mr-2">{featureName}</span>
                    <span className={isPositive ? 'text-red-400' : 'text-blue-400'}>
                      {isPositive ? '+' : ''}{item.topFactor.value.toFixed(3)}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
