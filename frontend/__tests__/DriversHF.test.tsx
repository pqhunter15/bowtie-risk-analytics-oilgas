import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  buildGlobalShapData,
  buildPifPrevalenceData,
  PifPrevalenceChart,
  PIF_CATEGORY,
} from '@/components/dashboard/DriversHF'
import type { GlobalShapEntry, PifPrevalenceEntry } from '@/components/dashboard/DriversHF'
import { BowtieProvider } from '@/context/BowtieContext'
import GlobalShapChart from '@/components/dashboard/DriversHF'
import type { PredictResponse, ShapValue } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrediction(model1_shap: ShapValue[]): PredictResponse {
  return {
    model1_probability: 0.5,
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
    barrier_condition_display: '',
  }
}

function makeShap(
  feature: string,
  value: number,
  category: 'barrier' | 'incident_context' = 'barrier',
): ShapValue {
  return { feature, value, category }
}

// ---------------------------------------------------------------------------
// buildGlobalShapData tests
// ---------------------------------------------------------------------------

describe('buildGlobalShapData', () => {
  it('returns [] for empty predictions', () => {
    expect(buildGlobalShapData({})).toEqual([])
  })

  it('returns sorted array descending by meanAbsShap', () => {
    const pred = makePrediction([
      makeShap('barrier_type', 0.1),
      makeShap('barrier_family', 0.5),
      makeShap('line_of_defense', 0.3),
    ])
    const result = buildGlobalShapData({ b1: pred })
    expect(result).toHaveLength(3)
    expect(result[0].meanAbsShap).toBeGreaterThanOrEqual(result[1].meanAbsShap)
    expect(result[1].meanAbsShap).toBeGreaterThanOrEqual(result[2].meanAbsShap)
    // Verify barrier_family is first (largest |value|)
    expect(result[0].feature).toBe('Barrier Family')
  })

  it('excludes source_agency and primary_threat_category', () => {
    const pred = makePrediction([
      makeShap('source_agency', 0.99),
      makeShap('primary_threat_category', 0.8),
      makeShap('barrier_type', 0.2),
    ])
    const result = buildGlobalShapData({ b1: pred })
    const features = result.map((e: GlobalShapEntry) => e.feature)
    expect(features).not.toContain('Data Source')
    expect(features).not.toContain('source_agency')
    expect(features).not.toContain('primary_threat_category')
    expect(features).toContain('Barrier Type')
  })

  it('computes mean correctly across multiple barriers', () => {
    const pred1 = makePrediction([makeShap('barrier_type', 0.2)])
    const pred2 = makePrediction([makeShap('barrier_type', 0.4)])
    const result = buildGlobalShapData({ b1: pred1, b2: pred2 })
    expect(result).toHaveLength(1)
    expect(result[0].meanAbsShap).toBeCloseTo(0.3)
  })

  it('uses display names for features', () => {
    const pred = makePrediction([makeShap('side', 0.3)])
    const result = buildGlobalShapData({ b1: pred })
    expect(result[0].feature).toBe('Pathway Position')
  })

  it('assigns category correctly', () => {
    const pred = makePrediction([
      makeShap('barrier_type', 0.3, 'barrier'),
      makeShap('top_event_category', 0.2, 'incident_context'),
    ])
    const result = buildGlobalShapData({ b1: pred })
    const barrierEntry = result.find((e: GlobalShapEntry) => e.feature === 'Barrier Type')
    const contextEntry = result.find((e: GlobalShapEntry) => e.feature === 'Top Event Category')
    expect(barrierEntry?.category).toBe('barrier')
    expect(contextEntry?.category).toBe('incident_context')
  })
})

// ---------------------------------------------------------------------------
// GlobalShapChart render tests
// ---------------------------------------------------------------------------

describe('GlobalShapChart', () => {
  it('renders with data-testid global-shap-chart', () => {
    render(
      <BowtieProvider>
        <GlobalShapChart />
      </BowtieProvider>,
    )
    expect(screen.getByTestId('global-shap-chart')).toBeTruthy()
  })

  it('shows empty state message when no predictions', () => {
    render(
      <BowtieProvider>
        <GlobalShapChart />
      </BowtieProvider>,
    )
    expect(screen.getByText(/Run Analyze Barriers/i)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// buildPifPrevalenceData tests
// ---------------------------------------------------------------------------

describe('buildPifPrevalenceData', () => {
  it('returns [] for empty predictions', () => {
    expect(buildPifPrevalenceData({})).toEqual([])
  })

  it('counts only PIFs appearing in globally-sorted top-3 by |SHAP|', () => {
    // 5 SHAP values: top-3 are barrier_family(0.9), side(0.8), pif_competence(0.7)
    // pif_procedures(0.4) and pif_training(0.1) are outside the top 3
    const pred = makePrediction([
      makeShap('barrier_family', 0.9),
      makeShap('side', 0.8),
      makeShap('pif_competence', 0.7),
      makeShap('pif_procedures', 0.4),
      makeShap('pif_training', 0.1),
    ])
    const result = buildPifPrevalenceData({ b1: pred })
    const competence = result.find((e: PifPrevalenceEntry) => e.featureKey === 'pif_competence')
    const procedures = result.find((e: PifPrevalenceEntry) => e.featureKey === 'pif_procedures')
    const training = result.find((e: PifPrevalenceEntry) => e.featureKey === 'pif_training')
    expect(competence?.prevalence).toBeGreaterThan(0)
    expect(procedures?.prevalence).toBe(0)
    expect(training?.prevalence).toBe(0)
  })

  it('prevalence is a fraction (0–1): PIF in top-3 of 1 out of 2 predictions = 0.5', () => {
    // pred1: pif_competence is in top-3 (value 0.8)
    const pred1 = makePrediction([
      makeShap('pif_competence', 0.8),
      makeShap('barrier_type', 0.1),
      makeShap('side', 0.05),
    ])
    // pred2: pif_competence is NOT in top-3 (value 0.01, others dominate)
    const pred2 = makePrediction([
      makeShap('barrier_family', 0.9),
      makeShap('line_of_defense', 0.7),
      makeShap('barrier_type', 0.6),
      makeShap('pif_competence', 0.01),
    ])
    const result = buildPifPrevalenceData({ b1: pred1, b2: pred2 })
    const competence = result.find((e: PifPrevalenceEntry) => e.featureKey === 'pif_competence')
    expect(competence?.prevalence).toBeCloseTo(0.5)
  })

  it('returns all 9 PIFs when predictions exist (even those at 0 prevalence)', () => {
    const pred = makePrediction([makeShap('barrier_type', 0.5)])
    const result = buildPifPrevalenceData({ b1: pred })
    expect(result).toHaveLength(9)
  })

  it('assigns correct categories from PIF_CATEGORY', () => {
    const pred = makePrediction([makeShap('barrier_type', 0.5)])
    const result = buildPifPrevalenceData({ b1: pred })
    const competence = result.find((e: PifPrevalenceEntry) => e.featureKey === 'pif_competence')
    const procedures = result.find((e: PifPrevalenceEntry) => e.featureKey === 'pif_procedures')
    const safetyCulture = result.find((e: PifPrevalenceEntry) => e.featureKey === 'pif_safety_culture')
    expect(competence?.category).toBe('People')
    expect(procedures?.category).toBe('Work')
    expect(safetyCulture?.category).toBe('Organisation')
  })

  it('sorts descending by prevalence', () => {
    // pif_competence in top-3 for both predictions; pif_procedures in top-3 for one
    const pred1 = makePrediction([
      makeShap('pif_competence', 0.9),
      makeShap('pif_procedures', 0.8),
      makeShap('side', 0.1),
    ])
    const pred2 = makePrediction([
      makeShap('pif_competence', 0.9),
      makeShap('barrier_type', 0.8),
      makeShap('barrier_family', 0.7),
    ])
    const result = buildPifPrevalenceData({ b1: pred1, b2: pred2 })
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].prevalence).toBeGreaterThanOrEqual(result[i + 1].prevalence)
    }
  })
})

// ---------------------------------------------------------------------------
// PifPrevalenceChart render tests
// ---------------------------------------------------------------------------

describe('PifPrevalenceChart', () => {
  it('renders with data-testid pif-prevalence-chart', () => {
    render(
      <BowtieProvider>
        <PifPrevalenceChart />
      </BowtieProvider>,
    )
    expect(screen.getByTestId('pif-prevalence-chart')).toBeTruthy()
  })

  it('shows empty state message when no predictions', () => {
    render(
      <BowtieProvider>
        <PifPrevalenceChart />
      </BowtieProvider>,
    )
    expect(screen.getByText(/Run Analyze Barriers/i)).toBeTruthy()
  })
})
