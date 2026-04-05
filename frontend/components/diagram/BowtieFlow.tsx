'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useViewport,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useBowtieContext } from '@/context/BowtieContext'
import { buildBowtieLayout, getPathwayLines, BARRIER_W, BARRIER_H } from './layout'
import BarrierNode from './BarrierNode'
import TopEventNode from './TopEventNode'
import ThreatNode from './ThreatNode'
import ConsequenceNode from './ConsequenceNode'
import PathwayView from './PathwayView'

// ---------------------------------------------------------------------------
// CRITICAL: nodeTypes MUST be defined at module scope (outside any component).
// If defined inside a component body, React Flow will infinite re-render on
// every render because the object reference changes. See RESEARCH.md Pitfall 2.
// ---------------------------------------------------------------------------
const nodeTypes = {
  barrier: BarrierNode,
  topEvent: TopEventNode,
  threat: ThreatNode,
  consequence: ConsequenceNode,
}

// ---------------------------------------------------------------------------
// Continuous pathway lines + effectiveness indicator rects.
// SVG layer tracks viewport pan/zoom. Renders BEHIND nodes (z-index 1).
// ---------------------------------------------------------------------------

const INDICATOR_COLORS: Record<string, string> = {
  red: '#EF4444',
  amber: '#F59E0B',
  green: '#22C55E',
  unanalyzed: '#9CA3AF',
}

interface BarrierIndicator {
  cx: number
  cy: number
  riskLevel: string
}

function PathwayLines({ barriers }: { barriers: BarrierIndicator[] }) {
  const { x, y, zoom } = useViewport()
  const lines = getPathwayLines()

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <g transform={`translate(${x},${y}) scale(${zoom})`}>
        {/* Continuous pathway lines */}
        {lines.map((line, i) => (
          <line
            key={`l-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
        {/* Effectiveness indicator rects at each barrier position */}
        {barriers.map((b, i) => (
          <rect
            key={`ind-${i}`}
            x={b.cx - 4}
            y={b.cy - 10}
            width={8}
            height={20}
            rx={1}
            fill={INDICATOR_COLORS[b.riskLevel] ?? INDICATOR_COLORS.unanalyzed}
          />
        ))}
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BowtieFlow() {
  const { barriers, eventDescription, predictions, setSelectedBarrierId, isAnalyzing, selectedBarrierId } =
    useBowtieContext()

  // View mode toggle: 'diagram' (React Flow) or 'pathway' (two-column card grid)
  const [viewMode, setViewMode] = useState<'diagram' | 'pathway'>('diagram')

  // Demo badge dismissal state
  const [showDemoBanner, setShowDemoBanner] = useState(true)

  // Build BowTieXP layout and overlay predictions onto node data
  const { nodes, edges } = useMemo(() => {
    const layout = buildBowtieLayout(barriers, eventDescription)

    // Overlay prediction results onto barrier nodes
    const nodesWithPredictions = layout.nodes.map((node) => {
      if (node.type !== 'barrier') return node

      const barrierId = node.data.barrierId as string
      const prediction = predictions[barrierId]
      if (!prediction) return node

      return {
        ...node,
        data: {
          ...node.data,
          probability: prediction.model1_probability,
          // riskLevel is derived from probability in BarrierForm (via setPrediction).
          // Here we reflect the barrier's current riskLevel from context.
        },
      }
    })

    // Sync riskLevel from barriers array (context is the source of truth)
    const barrierMap = new Map(barriers.map((b) => [b.id, b]))
    const finalNodes = nodesWithPredictions.map((node) => {
      if (node.type !== 'barrier') return node
      const barrierId = node.data.barrierId as string
      const barrier = barrierMap.get(barrierId)
      if (!barrier) return node
      return {
        ...node,
        data: {
          ...node.data,
          riskLevel: barrier.riskLevel,
          probability: barrier.probability,
        },
      }
    })

    // Mark selected barrier node
    const withSelection = finalNodes.map((node) => {
      if (node.type !== 'barrier') return node
      const barrierId = node.data.barrierId as string
      return {
        ...node,
        data: {
          ...node.data,
          selected: barrierId === selectedBarrierId,
        },
      }
    })

    return { nodes: withSelection, edges: layout.edges }
  }, [barriers, eventDescription, predictions, selectedBarrierId])

  // Barrier indicator rects for the SVG pathway layer
  const barrierIndicators: BarrierIndicator[] = useMemo(
    () =>
      nodes
        .filter((n) => n.type === 'barrier')
        .map((n) => ({
          cx: n.position.x + BARRIER_W / 2,
          cy: n.position.y + BARRIER_H / 2,
          riskLevel: String((n.data as Record<string, unknown>).riskLevel ?? 'unanalyzed'),
        })),
    [nodes],
  )

  // Node click handler — sets selectedBarrierId in context
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === 'barrier') {
        const barrierId = node.data.barrierId as string
        setSelectedBarrierId(barrierId)
      }
    },
    [setSelectedBarrierId],
  )

  // Determine if demo banner should show (only when barriers match demo scenario shape)
  const hasDemoBarriers = barriers.length === 5 && barriers.some((b) => b.name === 'Pressure Relief Valve')

  return (
    <div className="flex-1 h-full relative">
      {/* View toggle (D-10, Fidel-#55, Fidel-#56) */}
      <div className="absolute top-3 right-3 z-20 flex rounded-lg overflow-hidden border border-[#2E3348] bg-[#242836]">
        <button
          onClick={() => setViewMode('diagram')}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            viewMode === 'diagram'
              ? 'bg-[#3B82F6] text-white'
              : 'text-[#8B93A8] hover:text-[#E8ECF4]'
          }`}
        >
          Diagram View
        </button>
        <button
          onClick={() => setViewMode('pathway')}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            viewMode === 'pathway'
              ? 'bg-[#3B82F6] text-white'
              : 'text-[#8B93A8] hover:text-[#E8ECF4]'
          }`}
        >
          Pathway View
        </button>
      </div>

      {/* Demo badge — shown above the diagram on first load with demo scenario */}
      {viewMode === 'diagram' && showDemoBanner && hasDemoBarriers && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[#242836] border border-[#2E3348] rounded-md px-3 py-1.5 text-xs text-[#8B93A8] shadow-lg">
          <span>Demo scenario — modify or start fresh</span>
          <button
            onClick={() => setShowDemoBanner(false)}
            className="ml-1 text-[#5A6178] hover:text-[#E8ECF4] font-medium"
            aria-label="Dismiss demo banner"
          >
            ×
          </button>
        </div>
      )}

      {/* Analyzing overlay — pulse effect on barrier nodes when analysis in-flight */}
      {viewMode === 'diagram' && isAnalyzing && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-end justify-center pb-4">
          <span className="bg-[#242836] border border-[#2E3348] rounded-md px-3 py-1.5 text-xs text-[#8B93A8] shadow-lg animate-pulse">
            Analyzing barriers...
          </span>
        </div>
      )}

      {/* Diagram view — kept mounted to preserve viewport state (Pitfall 3 from RESEARCH.md) */}
      <div className={viewMode === 'diagram' ? 'h-full' : 'hidden'}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            proOptions={{ hideAttribution: true }}
            className="bg-[#F3F4F6]"
          >
            <PathwayLines barriers={barrierIndicators} />
            <Background color="#D1D5DB" gap={20} size={1} />
            <Controls
              className="!bg-[#1A1D27] !border-[#2E3348] !shadow-xl [&>button]:!bg-[#1A1D27] [&>button]:!border-b-[#2E3348] [&>button:hover]:!bg-[#242836] [&>button>svg]:!fill-[#8B93A8]"
            />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {/* Pathway view — two-column barrier card grid */}
      {viewMode === 'pathway' && (
        <PathwayView
          barriers={barriers}
          predictions={predictions}
          selectedBarrierId={selectedBarrierId}
          onBarrierClick={(id) => setSelectedBarrierId(id)}
        />
      )}
    </div>
  )
}
