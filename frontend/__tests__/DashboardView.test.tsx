import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BowtieProvider } from '@/context/BowtieContext'
import DashboardView from '@/components/dashboard/DashboardView'

const TAB_LABELS = ['Executive Summary', 'Barrier Coverage', 'Incident Trends', 'Risk Matrix']

function renderDashboard() {
  return render(
    <BowtieProvider>
      <DashboardView />
    </BowtieProvider>,
  )
}

describe('DashboardView', () => {
  it('renders all 4 tab buttons with correct labels', () => {
    renderDashboard()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
    for (const label of TAB_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('defaults to Executive Summary tab active', () => {
    renderDashboard()
    const execBtn = screen.getByRole('button', { name: 'Executive Summary' })
    expect(execBtn.className).toContain('border-[#3B82F6]')
    // The Executive Summary tab shows the chart, not a "coming soon" message
    expect(screen.getByTestId('risk-distribution-chart')).toBeTruthy()
  })

  it('clicking Barrier Coverage makes it active and deactivates Executive Summary', () => {
    renderDashboard()
    const barrierBtn = screen.getByRole('button', { name: 'Barrier Coverage' })
    const execBtn = screen.getByRole('button', { name: 'Executive Summary' })

    fireEvent.click(barrierBtn)

    expect(barrierBtn.className).toContain('border-[#3B82F6]')
    expect(execBtn.className).not.toContain('border-[#3B82F6]')
    expect(screen.getByText('Barrier Coverage coming soon')).toBeTruthy()
  })

  it('each non-Executive-Summary tab shows the correct coming soon content', () => {
    renderDashboard()
    const comingSoonTabs = TAB_LABELS.filter((l) => l !== 'Executive Summary')
    for (const label of comingSoonTabs) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(screen.getByText(`${label} coming soon`)).toBeTruthy()
    }
  })

  it('only one tab content is shown at a time', () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Incident Trends' }))

    expect(screen.getByText('Incident Trends coming soon')).toBeTruthy()
    expect(screen.queryByTestId('risk-distribution-chart')).toBeNull()
    expect(screen.queryByText('Barrier Coverage coming soon')).toBeNull()
    expect(screen.queryByText('Risk Matrix coming soon')).toBeNull()
  })

  it('inactive tabs have the inactive text colour class', () => {
    renderDashboard()
    // With Executive Summary active, the other three should carry the inactive colour
    for (const label of ['Barrier Coverage', 'Incident Trends', 'Risk Matrix']) {
      const btn = screen.getByRole('button', { name: label })
      expect(btn.className).toContain('text-[#5A6178]')
    }
  })

  it('executive-summary tab shows top-at-risk-barriers component', () => {
    renderDashboard()
    // Executive Summary is the default tab
    expect(screen.getByTestId('top-at-risk-barriers')).toBeTruthy()
  })

  it('executive-summary tab shows model KPIs component', () => {
    renderDashboard()
    expect(screen.getByTestId('model-kpis')).toBeTruthy()
  })

  it('executive-summary tab shows scenario context component', () => {
    renderDashboard()
    expect(screen.getByTestId('scenario-context')).toBeTruthy()
  })
})
