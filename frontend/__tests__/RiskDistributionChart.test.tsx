import { describe, it, expect } from 'vitest'
import { buildRiskDistribution } from '@/components/dashboard/RiskDistributionChart'
import type { Barrier } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBarrier(overrides: Partial<Barrier>): Barrier {
  return {
    id: crypto.randomUUID(),
    name: 'Test Barrier',
    side: 'prevention',
    barrier_type: 'administrative',
    barrier_family: 'procedure',
    line_of_defense: '1',
    barrierRole: 'preventive',
    riskLevel: 'unanalyzed',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildRiskDistribution', () => {
  it('returns all zeros for an empty barriers array', () => {
    expect(buildRiskDistribution([])).toEqual({ high: 0, medium: 0, low: 0 })
  })

  it('counts red → high, amber → medium, green → low correctly', () => {
    const barriers: Barrier[] = [
      makeBarrier({ riskLevel: 'red' }),
      makeBarrier({ riskLevel: 'red' }),
      makeBarrier({ riskLevel: 'amber' }),
      makeBarrier({ riskLevel: 'green' }),
      makeBarrier({ riskLevel: 'green' }),
      makeBarrier({ riskLevel: 'green' }),
    ]
    expect(buildRiskDistribution(barriers)).toEqual({ high: 2, medium: 1, low: 3 })
  })

  it('excludes unanalyzed barriers from all buckets', () => {
    const barriers: Barrier[] = [
      makeBarrier({ riskLevel: 'unanalyzed' }),
      makeBarrier({ riskLevel: 'unanalyzed' }),
      makeBarrier({ riskLevel: 'red' }),
    ]
    expect(buildRiskDistribution(barriers)).toEqual({ high: 1, medium: 0, low: 0 })
  })

  it('returns all zeros when every barrier is unanalyzed', () => {
    const barriers: Barrier[] = [
      makeBarrier({ riskLevel: 'unanalyzed' }),
      makeBarrier({ riskLevel: 'unanalyzed' }),
    ]
    expect(buildRiskDistribution(barriers)).toEqual({ high: 0, medium: 0, low: 0 })
  })

  it('handles all barriers in a single bucket', () => {
    const barriers: Barrier[] = [
      makeBarrier({ riskLevel: 'amber' }),
      makeBarrier({ riskLevel: 'amber' }),
      makeBarrier({ riskLevel: 'amber' }),
    ]
    expect(buildRiskDistribution(barriers)).toEqual({ high: 0, medium: 3, low: 0 })
  })

  it('counts a single green barrier correctly', () => {
    const barriers: Barrier[] = [makeBarrier({ riskLevel: 'green' })]
    expect(buildRiskDistribution(barriers)).toEqual({ high: 0, medium: 0, low: 1 })
  })
})
