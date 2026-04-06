import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { BowtieProvider, useBowtieContext } from '@/context/BowtieContext'
import type { Barrier, PredictResponse, ShapValue } from '@/lib/types'

// ---------------------------------------------------------------------------
// Mock EvidenceSection to avoid real network calls from /explain
// ---------------------------------------------------------------------------

vi.mock('@/components/panel/EvidenceSection', () => ({
  default: ({ barrierId }: { barrierId: string }) => (
    <div data-testid="evidence-section">Evidence for {barrierId}</div>
  ),
}))

// ---------------------------------------------------------------------------
// Import component AFTER vi.mock
// ---------------------------------------------------------------------------

import RankedBarriers, { buildRankedRows } from '@/components/dashboard/RankedBarriers'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBarrier(overrides: Partial<Barrier> = {}): Barrier {
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

function makePrediction(
  model1_probability: number,
  model1_shap: ShapValue[] = [],
): PredictResponse {
  return {
    model1_probability,
    model2_probability: 0,
    model1_shap,
    model2_shap: [],
    model1_base_value: 0.1,
    model2_base_value: 0.1,
    feature_metadata: [],
    degradation_factors: [],
    risk_level: 'Low',
    barrier_type_display: 'Administrative',
    lod_display: '1st',
    barrier_condition_display: 'Nominal',
  }
}

type BarrierDef = Omit<Barrier, 'id' | 'riskLevel'>

/** Populates BowtieContext with barriers + predictions then renders children. */
function SetupBarriers({
  barrierDefs,
  predictionsMap,
}: {
  barrierDefs: BarrierDef[]
  predictionsMap?: (barriers: Barrier[]) => Record<string, PredictResponse>
}) {
  const { addBarrier, setPrediction, barriers } = useBowtieContext()
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    barrierDefs.forEach((b) => addBarrier(b))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!predictionsMap || barriers.length === 0) return
    const preds = predictionsMap(barriers)
    Object.entries(preds).forEach(([id, pred]) => setPrediction(id, pred))
  }, [barriers.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

const BARRIER_DEF: BarrierDef = {
  name: 'Pressure Relief Valve',
  side: 'prevention',
  barrier_type: 'mechanical',
  barrier_family: 'pressure_relief',
  line_of_defense: '1',
  barrierRole: 'preventive',
}

function renderWithContext(
  barrierDefs: BarrierDef[],
  predictionsMap?: (barriers: Barrier[]) => Record<string, PredictResponse>,
) {
  return render(
    <BowtieProvider>
      <SetupBarriers barrierDefs={barrierDefs} predictionsMap={predictionsMap} />
      <RankedBarriers />
    </BowtieProvider>,
  )
}

// ---------------------------------------------------------------------------
// Unit tests: buildRankedRows
// ---------------------------------------------------------------------------

describe('buildRankedRows', () => {
  it('returns empty array when no barriers', () => {
    expect(buildRankedRows([], {}, 'rank', 'asc')).toEqual([])
  })

  it('returns empty array when no predictions', () => {
    const b = makeBarrier()
    expect(buildRankedRows([b], {}, 'rank', 'asc')).toEqual([])
  })

  it('assigns rank 1 to the highest-probability barrier', () => {
    const b1 = makeBarrier({ name: 'Low' })
    const b2 = makeBarrier({ name: 'High' })
    const preds = {
      [b1.id]: makePrediction(0.2),
      [b2.id]: makePrediction(0.8),
    }
    const rows = buildRankedRows([b1, b2], preds, 'rank', 'asc')
    expect(rows[0].rank).toBe(1)
    expect(rows[0].name).toBe('High')
  })

  it('sorts by probability descending when sortKey=probability, sortDir=desc', () => {
    const b1 = makeBarrier({ name: 'A' })
    const b2 = makeBarrier({ name: 'B' })
    const b3 = makeBarrier({ name: 'C' })
    const preds = {
      [b1.id]: makePrediction(0.3),
      [b2.id]: makePrediction(0.9),
      [b3.id]: makePrediction(0.6),
    }
    const rows = buildRankedRows([b1, b2, b3], preds, 'probability', 'desc')
    expect(rows[0].probability).toBeGreaterThan(rows[1].probability)
    expect(rows[1].probability).toBeGreaterThan(rows[2].probability)
  })

  it('sorts by name ascending when sortKey=name, sortDir=asc', () => {
    const b1 = makeBarrier({ name: 'Zebra' })
    const b2 = makeBarrier({ name: 'Alpha' })
    const preds = {
      [b1.id]: makePrediction(0.5),
      [b2.id]: makePrediction(0.4),
    }
    const rows = buildRankedRows([b1, b2], preds, 'name', 'asc')
    expect(rows[0].name).toBe('Alpha')
    expect(rows[1].name).toBe('Zebra')
  })

  it('sets condition from barrier_condition_display when present', () => {
    const b = makeBarrier()
    const pred = makePrediction(0.5)
    pred.barrier_condition_display = 'Degraded'
    const rows = buildRankedRows([b], { [b.id]: pred }, 'rank', 'asc')
    expect(rows[0].condition).toBe('Degraded')
  })

  it('falls back condition to — when barrier_condition_display is null', () => {
    const b = makeBarrier()
    const pred = makePrediction(0.5)
    pred.barrier_condition_display = undefined as unknown as string
    const rows = buildRankedRows([b], { [b.id]: pred }, 'rank', 'asc')
    expect(rows[0].condition).toBe('—')
  })
})

// ---------------------------------------------------------------------------
// Component tests: RankedBarriers rendering
// ---------------------------------------------------------------------------

describe('RankedBarriers component', () => {
  it('shows empty-state text when no analyzed barriers', () => {
    render(
      <BowtieProvider>
        <RankedBarriers />
      </BowtieProvider>,
    )
    expect(screen.getByText('No analyzed barriers yet')).toBeTruthy()
  })

  it('renders ranked-barriers-table testid', () => {
    render(
      <BowtieProvider>
        <RankedBarriers />
      </BowtieProvider>,
    )
    expect(screen.getByTestId('ranked-barriers-table')).toBeTruthy()
  })

  it('renders a data row for each analyzed barrier', async () => {
    renderWithContext([BARRIER_DEF, { ...BARRIER_DEF, name: 'Second Barrier' }], (barriers) => ({
      [barriers[0].id]: makePrediction(0.7),
      [barriers[1].id]: makePrediction(0.4),
    }))

    // Wait for state to propagate
    await screen.findByText('Pressure Relief Valve')
    expect(screen.getByText('Second Barrier')).toBeTruthy()
  })

  it('does not render expanded row before any click', async () => {
    renderWithContext([BARRIER_DEF], (barriers) => ({
      [barriers[0].id]: makePrediction(0.6),
    }))
    await screen.findByText('Pressure Relief Valve')
    expect(screen.queryByTestId('ranked-row-expanded')).toBeNull()
  })

  it('shows expanded row with load-evidence-btn after clicking a row', async () => {
    renderWithContext([BARRIER_DEF], (barriers) => ({
      [barriers[0].id]: makePrediction(0.6),
    }))
    const row = await screen.findByText('Pressure Relief Valve')
    fireEvent.click(row.closest('tr')!)
    expect(screen.getByTestId('ranked-row-expanded')).toBeTruthy()
    expect(screen.getByTestId('load-evidence-btn')).toBeTruthy()
  })

  it('collapses expanded row on second click of same row', async () => {
    renderWithContext([BARRIER_DEF], (barriers) => ({
      [barriers[0].id]: makePrediction(0.6),
    }))
    const row = await screen.findByText('Pressure Relief Valve')
    const tr = row.closest('tr')!
    fireEvent.click(tr)
    expect(screen.getByTestId('ranked-row-expanded')).toBeTruthy()
    fireEvent.click(tr)
    expect(screen.queryByTestId('ranked-row-expanded')).toBeNull()
  })

  it('mounts EvidenceSection only after Load Evidence button is clicked', async () => {
    renderWithContext([BARRIER_DEF], (barriers) => ({
      [barriers[0].id]: makePrediction(0.6),
    }))
    const row = await screen.findByText('Pressure Relief Valve')
    fireEvent.click(row.closest('tr')!)

    // EvidenceSection not yet mounted
    expect(screen.queryByTestId('evidence-section')).toBeNull()

    // Click Load Evidence button
    const btn = screen.getByTestId('load-evidence-btn')
    fireEvent.click(btn)

    // Now EvidenceSection is mounted
    expect(screen.getByTestId('evidence-section')).toBeTruthy()
  })

  it('Load Evidence button click does not collapse the expanded row (stopPropagation)', async () => {
    renderWithContext([BARRIER_DEF], (barriers) => ({
      [barriers[0].id]: makePrediction(0.6),
    }))
    const row = await screen.findByText('Pressure Relief Valve')
    fireEvent.click(row.closest('tr')!)
    const btn = screen.getByTestId('load-evidence-btn')
    fireEvent.click(btn)
    // Row still expanded after clicking Load Evidence
    expect(screen.getByTestId('ranked-row-expanded')).toBeTruthy()
  })

  it('only one row is expanded at a time (clicking another collapses the first)', async () => {
    renderWithContext(
      [BARRIER_DEF, { ...BARRIER_DEF, name: 'Second Barrier' }],
      (barriers) => ({
        [barriers[0].id]: makePrediction(0.7),
        [barriers[1].id]: makePrediction(0.4),
      }),
    )

    const first = await screen.findByText('Pressure Relief Valve')
    fireEvent.click(first.closest('tr')!)
    expect(screen.getAllByTestId('ranked-row-expanded')).toHaveLength(1)

    const second = screen.getByText('Second Barrier')
    fireEvent.click(second.closest('tr')!)
    // Still only one expanded row (the second one now)
    expect(screen.getAllByTestId('ranked-row-expanded')).toHaveLength(1)
  })
})
