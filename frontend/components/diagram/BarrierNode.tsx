'use client'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BarrierNodeData = {
  label: string
  riskLevel: 'red' | 'amber' | 'green' | 'unanalyzed'
  probability?: number
  barrierId: string
  selected?: boolean
}

export type BarrierNodeType = Node<BarrierNodeData, 'barrier'>

// ---------------------------------------------------------------------------
// H/M/L label mapping for badge text (D-07, Fidel-#34)
// ---------------------------------------------------------------------------

const RISK_LEVEL_LABELS: Record<string, string> = {
  red: 'High',
  amber: 'Medium',
  green: 'Low',
  unanalyzed: '',
}

// ---------------------------------------------------------------------------
// Risk color hex values for dark-themed nodes
// ---------------------------------------------------------------------------

const RISK_COLORS: Record<string, string> = {
  red: '#EF4444',
  amber: '#F59E0B',
  green: '#22C55E',
  unanalyzed: '#2E3348',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BarrierNode({ data }: NodeProps<BarrierNodeType>) {
  const analyzed = data.riskLevel && data.riskLevel !== 'unanalyzed'
  const riskColor = RISK_COLORS[data.riskLevel] ?? RISK_COLORS.unanalyzed

  const borderStyle = data.selected
    ? '3px solid #3B82F6'
    : analyzed
      ? `1px solid ${riskColor}`
      : '1px solid #2E3348'

  const leftBorder = analyzed && !data.selected
    ? `3px solid ${riskColor}`
    : undefined

  return (
    <div
      className="rounded-md p-3 w-[160px] cursor-pointer nodrag hover:brightness-110 transition-all duration-150"
      style={{
        backgroundColor: '#1A1D27',
        border: borderStyle,
        borderLeft: leftBorder ?? (data.selected ? '3px solid #3B82F6' : borderStyle),
        boxShadow: data.selected
          ? '0 0 0 2px rgba(59,130,246,0.3)'
          : '0 2px 4px rgba(0,0,0,0.3)',
      }}
    >
      {/* Barrier name */}
      <p className="text-sm font-semibold truncate" style={{ color: '#E8ECF4' }}>
        {data.label}
      </p>

      {/* Risk level badge — shows Low/Medium/High after analysis */}
      {analyzed ? (
        <p className="text-xs font-medium" style={{ color: riskColor }}>
          {RISK_LEVEL_LABELS[data.riskLevel] ?? ''}
        </p>
      ) : (
        <p className="text-xs select-none" style={{ color: '#5A6178' }}>
          Not analyzed
        </p>
      )}

      {/* React Flow handles */}
      <Handle type="target" position={Position.Left} className="!bg-[#4A5178]" />
      <Handle type="source" position={Position.Right} className="!bg-[#4A5178]" />
    </div>
  )
}
