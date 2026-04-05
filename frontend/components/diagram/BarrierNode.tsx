'use client'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'

export type BarrierNodeData = {
  label: string
  riskLevel: 'red' | 'amber' | 'green' | 'unanalyzed'
  probability?: number
  barrierId: string
  barrierType?: string
  selected?: boolean
}

export type BarrierNodeType = Node<BarrierNodeData, 'barrier'>

const HIDDEN_HANDLE = { opacity: 0, width: 1, height: 1 } as const

export default function BarrierNode({ data }: NodeProps<BarrierNodeType>) {
  return (
    <div
      className="cursor-pointer nodrag transition-all duration-150"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #D1D5DB',
        borderRadius: 0,
        padding: '4px 8px',
        minWidth: 130,
        maxWidth: 160,
        boxShadow: data.selected
          ? '0 0 0 2px rgba(37,99,235,0.5)'
          : '0 1px 2px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ color: '#1E293B', fontSize: 11, fontWeight: 500, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
        {data.label}
      </p>
      {data.barrierType && (
        <p style={{ color: '#6B7280', fontSize: 10, lineHeight: 1.2, marginTop: 1 }}>
          {data.barrierType}
        </p>
      )}

      <Handle type="target" position={Position.Left} style={HIDDEN_HANDLE} />
      <Handle type="source" position={Position.Right} style={HIDDEN_HANDLE} />
    </div>
  )
}
