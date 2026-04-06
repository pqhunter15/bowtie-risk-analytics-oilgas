'use client'

import { useState, useEffect } from 'react'
import { useBowtieContext } from '@/context/BowtieContext'
import EvidenceSection from '@/components/panel/EvidenceSection'
import type { RiskLevel } from '@/lib/types'

// ---------------------------------------------------------------------------
// Risk label mapping (inline — mirrors RankedBarriers badge labels)
// ---------------------------------------------------------------------------

const PILL_LABELS: Record<RiskLevel, string> = {
  red: 'High',
  amber: 'Medium',
  green: 'Low',
  unanalyzed: 'Pending',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EvidenceView() {
  const { barriers, predictions, eventDescription } = useBowtieContext()

  // Only barriers that have a prediction result
  const analyzedBarriers = barriers.filter((b) => predictions[b.id])

  const [selectedBarrierId, setSelectedBarrierId] = useState<string | null>(
    analyzedBarriers[0]?.id ?? null,
  )

  // Reset selection when the analyzed set changes (e.g. after analysis completes)
  useEffect(() => {
    if (analyzedBarriers.length === 0) {
      setSelectedBarrierId(null)
      return
    }
    // If current selection is no longer in analyzed set, reset to first
    const stillValid = analyzedBarriers.some((b) => b.id === selectedBarrierId)
    if (!stillValid) {
      setSelectedBarrierId(analyzedBarriers[0].id)
    }
  }, [analyzedBarriers.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedBarrier = analyzedBarriers.find((b) => b.id === selectedBarrierId) ?? null
  const selectedPrediction = selectedBarrierId ? predictions[selectedBarrierId] : null

  return (
    <div className="w-full" data-testid="evidence-view">
      {analyzedBarriers.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-[#5A6178]">Run analysis to view barrier evidence</p>
        </div>
      ) : (
        <>
          {/* Barrier selector */}
          <div className="mb-6">
            <label
              htmlFor="evidence-barrier-select"
              className="block text-xs font-medium text-[#5A6178] mb-1"
            >
              Select barrier
            </label>
            <select
              id="evidence-barrier-select"
              value={selectedBarrierId ?? ''}
              onChange={(e) => setSelectedBarrierId(e.target.value || null)}
              className="w-full bg-[#242836] border border-[#2E3348] rounded-md px-3 py-2 text-sm text-[#E8ECF4] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
            >
              {analyzedBarriers.map((barrier) => (
                <option key={barrier.id} value={barrier.id}>
                  {barrier.name} ({PILL_LABELS[barrier.riskLevel]})
                </option>
              ))}
            </select>
          </div>

          {/* Evidence panel */}
          {selectedBarrier && selectedPrediction && (
            <EvidenceSection
              barrierId={selectedBarrier.id}
              barrier={selectedBarrier}
              eventDescription={eventDescription}
              prediction={selectedPrediction}
            />
          )}
        </>
      )}
    </div>
  )
}
