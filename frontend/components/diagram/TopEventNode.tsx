'use client'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'

export type TopEventNodeData = {
  label: string
}

export type TopEventNodeType = Node<TopEventNodeData, 'topEvent'>

const HIDDEN_HANDLE = { opacity: 0, width: 1, height: 1 } as const

export default function TopEventNode({ data }: NodeProps<TopEventNodeType>) {
  // Outer container matches layout dimensions (180×90).
  // Inner circle (140×140) overflows vertically for the visual effect.
  return (
    <div
      className="nodrag"
      style={{ width: 180, height: 90, position: 'relative' }}
    >
      {/* Hazard stripe ring — diagonal yellow/black pattern */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: 'repeating-linear-gradient(-45deg, #F59E0B, #F59E0B 4px, #1E293B 4px, #1E293B 8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* White inner circle */}
        <div
          style={{
            width: 124,
            height: 124,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 16px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, color: '#1E293B' }}>
            {data.label}
          </p>
        </div>
      </div>

      <Handle type="target" position={Position.Left} style={HIDDEN_HANDLE} />
      <Handle type="source" position={Position.Right} style={HIDDEN_HANDLE} />
    </div>
  )
}
