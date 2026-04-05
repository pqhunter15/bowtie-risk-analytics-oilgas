'use client'

import { useEffect, useRef } from 'react'
import { BowtieProvider, useBowtieContext } from '@/context/BowtieContext'
import BarrierForm from './sidebar/BarrierForm'
import BowtieFlow from './diagram/BowtieFlow'
import DetailPanel from './panel/DetailPanel'
import { DEMO_SCENARIO } from './sidebar/constants'

// ---------------------------------------------------------------------------
// Inner component — must be inside BowtieProvider to access context
// ---------------------------------------------------------------------------

function BowtieAppInner() {
  const { addBarrier, setEventDescription, barriers } = useBowtieContext()

  // Load demo scenario on first mount — only if no barriers exist yet.
  // Ref guard prevents React 18 StrictMode double-invocation from adding duplicates
  // (state updates from first invocation haven't flushed when the second fires).
  const demoLoaded = useRef(false)
  useEffect(() => {
    if (demoLoaded.current || barriers.length > 0) return
    demoLoaded.current = true
    setEventDescription(DEMO_SCENARIO.eventDescription)
    DEMO_SCENARIO.barriers.forEach((b) => addBarrier(b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps — run once on mount only (D-03)

  return (
    <div className="flex h-screen min-w-[1280px] bg-[#0F1117]">
      {/* Left panel: barrier input form */}
      <aside className="w-80 overflow-y-auto border-r border-[#2E3348] bg-[#1A1D27] flex-shrink-0">
        <BarrierForm />
      </aside>

      {/* Center panel: Bowtie diagram */}
      <main className="flex-1 h-full overflow-hidden">
        <BowtieFlow />
      </main>

      {/* Right panel: barrier detail */}
      <aside className="w-96 overflow-y-auto border-l border-[#2E3348] bg-[#1A1D27] p-4 flex-shrink-0">
        <DetailPanel />
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root client component — owns BowtieProvider context boundary
// ---------------------------------------------------------------------------

export default function BowtieApp() {
  return (
    <BowtieProvider>
      <BowtieAppInner />
    </BowtieProvider>
  )
}
