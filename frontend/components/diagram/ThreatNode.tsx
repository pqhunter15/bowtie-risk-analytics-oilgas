'use client'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'

export type ThreatNodeData = {
  label: string
}

export type ThreatNodeType = Node<ThreatNodeData, 'threat'>

const HIDDEN_HANDLE = { opacity: 0, width: 1, height: 1 } as const

export default function ThreatNode({ data }: NodeProps<ThreatNodeType>) {
  return (
    <div
      className="w-[180px] nodrag"
      style={{
        backgroundColor: '#FFFFFF',
        borderLeft: '4px solid #2563EB',
        borderTop: '1px solid #D1D5DB',
        borderRight: '1px solid #D1D5DB',
        borderBottom: '1px solid #D1D5DB',
        borderRadius: 0,
        padding: '8px 12px',
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, color: '#1E293B' }}>
        {data.label}
      </p>
      <Handle type="source" position={Position.Right} style={HIDDEN_HANDLE} />
    </div>
  )
}
