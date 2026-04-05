'use client'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'

export type ConsequenceNodeData = {
  label: string
}

export type ConsequenceNodeType = Node<ConsequenceNodeData, 'consequence'>

const HIDDEN_HANDLE = { opacity: 0, width: 1, height: 1 } as const

export default function ConsequenceNode({ data }: NodeProps<ConsequenceNodeType>) {
  return (
    <div
      className="w-[180px] nodrag"
      style={{
        backgroundColor: '#FFFFFF',
        borderRight: '4px solid #DC2626',
        borderTop: '1px solid #D1D5DB',
        borderLeft: '1px solid #D1D5DB',
        borderBottom: '1px solid #D1D5DB',
        borderRadius: 0,
        padding: '8px 12px',
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, color: '#1E293B' }}>
        {data.label}
      </p>
      <Handle type="target" position={Position.Left} style={HIDDEN_HANDLE} />
    </div>
  )
}
