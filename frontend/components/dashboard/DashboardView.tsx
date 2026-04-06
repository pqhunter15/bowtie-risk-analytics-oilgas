'use client'

import { useState } from 'react'
import { useBowtieContext } from '@/context/BowtieContext'
import RiskDistributionChart, { buildRiskDistribution } from './RiskDistributionChart'
import TopAtRiskBarriers from './TopAtRiskBarriers'
import ModelKPIs from './ModelKPIs'
import ScenarioContext from './ScenarioContext'

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'executive-summary', label: 'Executive Summary' },
  { id: 'barrier-coverage', label: 'Barrier Coverage' },
  { id: 'incident-trends', label: 'Incident Trends' },
  { id: 'risk-matrix', label: 'Risk Matrix' },
] as const

type TabId = (typeof TABS)[number]['id']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardView() {
  const [activeTab, setActiveTab] = useState<TabId>('executive-summary')
  const { barriers } = useBowtieContext()

  const counts = buildRiskDistribution(barriers)

  return (
    <div className="w-full bg-[#0F1117] min-h-screen flex flex-col">
      {/* Tab bar */}
      <div className="flex bg-[#242836] rounded-t-md border-b border-[#2E3348] flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'text-[#E8ECF4] border-b-2 border-[#3B82F6]'
                : 'text-[#5A6178] hover:text-[#8B93A8]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 p-8">
        {activeTab === 'executive-summary' && (
          <>
            <RiskDistributionChart counts={counts} />
            <div className="mt-6">
              <TopAtRiskBarriers />
            </div>
            <div className="mt-6">
              <ModelKPIs />
            </div>
            <div className="mt-6">
              <ScenarioContext />
            </div>
          </>
        )}
        {activeTab !== 'executive-summary' && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[#5A6178]">
              {TABS.find((t) => t.id === activeTab)?.label} coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
