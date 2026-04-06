import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DashboardView from '@/components/dashboard/DashboardView'

const TAB_LABELS = ['Fleet Overview', 'Barrier Coverage', 'Incident Trends', 'Risk Matrix']

describe('DashboardView', () => {
  it('renders all 4 tab buttons with correct labels', () => {
    render(<DashboardView />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
    for (const label of TAB_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('defaults to Fleet Overview tab active', () => {
    render(<DashboardView />)
    const fleetBtn = screen.getByRole('button', { name: 'Fleet Overview' })
    expect(fleetBtn.className).toContain('border-[#3B82F6]')
    expect(screen.getByText('Fleet Overview coming soon')).toBeTruthy()
  })

  it('clicking Barrier Coverage makes it active and deactivates Fleet Overview', () => {
    render(<DashboardView />)
    const barrierBtn = screen.getByRole('button', { name: 'Barrier Coverage' })
    const fleetBtn = screen.getByRole('button', { name: 'Fleet Overview' })

    fireEvent.click(barrierBtn)

    expect(barrierBtn.className).toContain('border-[#3B82F6]')
    expect(fleetBtn.className).not.toContain('border-[#3B82F6]')
    expect(screen.getByText('Barrier Coverage coming soon')).toBeTruthy()
  })

  it('each tab click shows the correct coming soon content', () => {
    render(<DashboardView />)
    for (const label of TAB_LABELS) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(screen.getByText(`${label} coming soon`)).toBeTruthy()
    }
  })

  it('only one tab content is shown at a time', () => {
    render(<DashboardView />)
    fireEvent.click(screen.getByRole('button', { name: 'Incident Trends' }))

    expect(screen.getByText('Incident Trends coming soon')).toBeTruthy()
    expect(screen.queryByText('Fleet Overview coming soon')).toBeNull()
    expect(screen.queryByText('Barrier Coverage coming soon')).toBeNull()
    expect(screen.queryByText('Risk Matrix coming soon')).toBeNull()
  })

  it('inactive tabs have the inactive text colour class', () => {
    render(<DashboardView />)
    // With Fleet Overview active, the other three should carry the inactive colour
    for (const label of ['Barrier Coverage', 'Incident Trends', 'Risk Matrix']) {
      const btn = screen.getByRole('button', { name: label })
      expect(btn.className).toContain('text-[#5A6178]')
    }
  })
})
