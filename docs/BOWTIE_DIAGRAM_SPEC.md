# BowTieXP Diagram Specification — Implementation Guide for Claude Code

## Goal
Replace the React Flow diagram with a pure SVG component (`BowtieSVG.tsx`) that renders a bowtie diagram EXACTLY matching the BowTieXP visual language by Wolters Kluwer.

Read these design skills first:
- `.claude/skills/ui-ux-pro-max/SKILL.md`
- `.claude/skills/frontend-design/SKILL.md`

Reference image: `docs/bowtiexp-reference.png` — THIS IS THE TARGET. Match it exactly.

---

## Architecture Decision

**WHY NOT React Flow:** React Flow renders nodes as independent HTML `<div>` elements connected by SVG edge paths. This creates gaps between connectors and nodes, handles visible on node boundaries, and broken pathway lines. BowTieXP renders everything as ONE coordinated SVG drawing where pathway lines flow continuously behind barrier blocks. React Flow fundamentally cannot produce this visual result.

**THE SOLUTION:** A single `<svg>` element that draws the entire bowtie diagram. Drawing order matters — pathway lines are drawn FIRST (behind everything), then effectiveness indicators, then barrier blocks, then threat/consequence boxes, then the top event. Click handlers on `<g>` groups provide interactivity.

---

## File Structure

```
frontend/components/diagram/BowtieSVG.tsx    ← NEW: Pure SVG bowtie renderer
frontend/components/diagram/BowtieApp.tsx    ← MODIFY: Use BowtieSVG instead of ReactFlow
frontend/components/diagram/BowtieFlow.tsx   ← KEEP: Don't delete (fallback)
```

---

## Component API

```tsx
interface BowtieSVGProps {
  topEvent: string;                    // "Loss of containment during high-pressure gas transfer operations"
  threats: Array<{
    id: string;
    name: string;
    contribution: 'high' | 'medium' | 'low';
  }>;
  consequences: Array<{
    id: string;
    name: string;
  }>;
  barriers: Array<{
    id: string;
    name: string;
    side: 'prevention' | 'mitigation';
    barrier_type: string;              // "engineering" | "administrative"
    barrier_role?: string;             // "Prevent overpressure"
    line_of_defense?: string;          // "1st" | "2nd" | "3rd"
    risk_level?: 'Low' | 'Medium' | 'High' | null;
    threatId?: string;                 // Which threat this barrier belongs to
    consequenceId?: string;            // Which consequence this barrier protects
  }>;
  selectedBarrierId: string | null;
  onBarrierClick: (barrierId: string) => void;
}
```

---

## Layout Algorithm (Dynamic, Not Hardcoded)

```
CANVAS: viewBox="0 0 1400 H" where H = max(threats.length, consequences.length) * 200 + 100

SPACING CONSTANTS:
  THREAT_X = 30                     // Left edge of threat boxes
  THREAT_WIDTH = 200
  BARRIER_START_X = 340             // Left edge of first barrier column
  BARRIER_WIDTH = 180
  BARRIER_GAP_X = 30                // Horizontal gap between sequential barriers
  TOP_EVENT_CX = 700                // Center X of top event circle
  TOP_EVENT_CY = H / 2             // Center Y (vertically centered)
  TOP_EVENT_R = 80                  // Radius
  MITIGATION_START_X = TOP_EVENT_CX + TOP_EVENT_R + 100
  CONSEQUENCE_X = 1150              // Left edge of consequence boxes
  CONSEQUENCE_WIDTH = 200
  
THREAT POSITIONING:
  For each threat i (0-indexed):
    threat.y = 80 + i * (H - 160) / max(1, threats.length - 1)
    If only 1 threat: threat.y = H / 2
    threat.x = THREAT_X
    threat.height = 115

BARRIER POSITIONING (Prevention):
  Group barriers by threatId.
  For each threat's barriers (j = 0, 1, 2...):
    barrier.x = BARRIER_START_X + j * (BARRIER_WIDTH + BARRIER_GAP_X)
    barrier.y is calculated by linear interpolation along the curve from 
              threat center to top event center at t = (j + 1) / (n + 1)
    barrier.height = 78

BARRIER POSITIONING (Mitigation):
  Group by consequenceId.
  For each consequence's barriers (j = 0, 1, 2...):
    barrier.x = MITIGATION_START_X + j * (BARRIER_WIDTH + BARRIER_GAP_X)
    barrier.y = interpolate between TOP_EVENT_CY and consequence center Y

CONSEQUENCE POSITIONING:
  For each consequence i:
    consequence.y = same spacing logic as threats
    consequence.x = CONSEQUENCE_X
    consequence.height = 90

PATHWAY CURVES:
  Use cubic bezier (C command) connecting:
    From: threat right edge midpoint → To: first barrier left edge midpoint
    From: last barrier right edge midpoint → To: top event circle left tangent
    From: top event circle right tangent → To: first mitigation barrier left edge
    From: last mitigation barrier right edge → To: consequence left edge midpoint
  
  Control points create gentle S-curves, NOT straight lines.
  Control point formula for threat→barrier:
    cx1 = threat_right_x + (barrier_left_x - threat_right_x) * 0.4
    cy1 = threat_center_y
    cx2 = threat_right_x + (barrier_left_x - threat_right_x) * 0.6
    cy2 = barrier_center_y
```

---

## Visual Specification (EXACT BowTieXP Matching)

### Global Rules
- ALL text color: `#0000EE` (BowTieXP signature blue)
- Font family: Arial, sans-serif
- Canvas background: `#E0E0E0` (light gray)
- No gradients on boxes (flat fills only)
- Sharp corners on ALL boxes (no border-radius)
- All pathway lines: stroke `#AAA`, strokeWidth 2

### Threat Boxes
```
Width: 200px, Height: 115px
Border: 3px solid #0000CC (thick blue, ALL sides)
Fill: white
Internal layout:
  - Name: font-size 15px, font-weight 700, color #0000EE
    Two lines max, wrap if needed
  - Separator: thin gray line (#BBB, 0.5px) below name
  - Contribution badge: 
    14x14px colored square (red=#DC2626 for High, amber=#F59E0B for Medium/Low)
    + text "HC High contribution" / "MC Medium" / "LC Low"
    font-size 11px, font-weight 600, color #0000EE
```

### Barrier Blocks
```
Width: 180px, Height: 78px
Border: 1px solid #999
Fill: white
Internal layout (3 rows separated by thin gray lines):
  Row 1 - Name: font-size 13px, font-weight 700, color #0000EE
           Two lines max for long names
  Row 2 - Role/Description: font-size 11px, color #0000EE, text-decoration underline
  Row 3 - Type indicator: 
           12x12px colored square + type label text
           Colors by barrier_type:
             engineering → #3B82F6 (blue), label "A-HW Active hardware"
             administrative → #8B5CF6 (purple), label "ST Socio technical"
             ppe → #EC4899 (pink), label "BEH Behavioural"
           font-size 10px, color #0000EE
  Separator lines: #CCC, 0.5px between each row
  
Selected state: border 2px solid #3B82F6, subtle blue box-shadow
```

### Top Event Circle
```
Outer circle: radius 80px
  Fill: radial-gradient from #F97316 (center) to #DC2626 (edge)
  Stroke: #333, 2px

Inner rectangle: centered inside circle
  Width: 90px, Height: 72px
  Fill: white
  Stroke: #444, 1.5px
  
Text inside inner rect:
  Line 1-2: Top event name, font-size 13px, font-weight 700, color #1A1A1A
  Line 3: "(Top Event)" label, font-size 10px, color #666
```

### Hazard Box (above top event circle)
```
Outer rect: width 170px, height 72px
  Fill: diagonal yellow-black hazard stripe pattern
  Stroke: #333, 2px
  
  SVG pattern:
  <pattern id="hazard" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="14" height="14" fill="#F5C518"/>
    <rect width="7" height="14" fill="#1A1A1A"/>
  </pattern>

Inner rect (inset 8px):
  Fill: white
  Stroke: #333, 1px
  
Text: Hazard name centered, font-size 11px, font-weight 700, color #0000EE
  "Loss of containment during gas transfer operations"
  
Position: centered above the top event circle, gap 10-15px
```

### Consequence Boxes
```
Width: 200px, Height: 90px
Border: 3px solid #DC2626 (thick red, ALL sides)
Fill: white
Text: font-size 14px, font-weight 700, color #0000EE

Red bottom strip: full-width rect at bottom of box
  Height: 13px, Fill: #DC2626
```

### Effectiveness Indicator Bars
```
Small rectangles sitting ON the pathway line
Position: between threat and first barrier, between barriers
Width: 8px, Height: 22px
Colors:
  Green (#22C55E) = effective / Low risk
  Amber (#F59E0B) = degraded / Medium risk  
  Red (#EF4444) = failed / High risk
  Gray (#94A3B8) = not analyzed
Centered on the pathway line at the interpolated position
```

### Pathway Lines
```
Stroke: #AAA (gray)
StrokeWidth: 2
Fill: none
Type: Cubic bezier curves (SVG `C` command)
  
Connection points:
  - FROM threat: right edge, vertical center
  - TO barrier: left edge, vertical center  
  - FROM barrier: right edge, vertical center
  - TO top event: circle tangent point (calculated from angle)
  - FROM top event: circle tangent point on right side
  - TO consequence: left edge, vertical center

Lines must NOT pass through any box. Route curves around obstacles.
Lines connect TO box edges, never overlap with box interiors.
```

---

## Integration with BowtieApp.tsx

```tsx
// In BowtieApp.tsx, replace ReactFlow with BowtieSVG when in Diagram View:

{view === 'diagram' ? (
  <BowtieSVG
    topEvent={topEvent}
    threats={demoThreats}       // hardcoded for demo, user-enterable later
    consequences={demoConsequences}
    barriers={barriers}
    selectedBarrierId={selectedBarrier?.id || null}
    onBarrierClick={(id) => {
      const barrier = barriers.find(b => b.id === id);
      if (barrier) setSelectedBarrier(barrier);
    }}
  />
) : (
  <PathwayView ... />           // Keep pathway view unchanged
)}
```

### Demo Scenario Data
```tsx
const demoThreats = [
  { id: 't1', name: 'Equipment overpressure', contribution: 'high' as const },
  { id: 't2', name: 'Overheating of equipment', contribution: 'medium' as const },
  { id: 't3', name: 'Operator error during transfer', contribution: 'low' as const },
];

const demoConsequences = [
  { id: 'c1', name: 'Gas release / toxic exposure' },
  { id: 'c2', name: 'Explosive failure of equipment' },
  { id: 'c3', name: 'Fire / explosion' },
];

// Map barriers to threats:
// Prevention barriers → assign to threats based on position
// Mitigation barriers → assign to consequences
```

### Scroll/Zoom Container
```tsx
<div style={{ 
  width: '100%', 
  height: '100%', 
  overflow: 'auto',
  background: '#E0E0E0' 
}}>
  <div style={{ 
    transform: `scale(${zoom})`, 
    transformOrigin: '0 0',
    minWidth: '1400px' 
  }}>
    <svg viewBox="0 0 1400 {calculatedHeight}" width="100%">
      {/* ... all SVG content ... */}
    </svg>
  </div>
  {/* Zoom controls */}
  <div style={{ position: 'absolute', bottom: 16, left: 16 }}>
    <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))}>+</button>
    <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}>−</button>
    <button onClick={() => setZoom(1)}>⊡</button>
  </div>
</div>
```

---

## Reference SVG Code (Working Example)

This SVG produces the correct visual output. Use it as the rendering template:

```svg
<svg viewBox="0 0 1400 680" style="font-family:Arial,sans-serif">
<defs>
  <pattern id="hazard" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="14" height="14" fill="#F5C518"/>
    <rect width="7" height="14" fill="#1A1A1A"/>
  </pattern>
  <radialGradient id="orb">
    <stop offset="0%" stop-color="#F97316"/>
    <stop offset="100%" stop-color="#DC2626"/>
  </radialGradient>
</defs>

<!-- DRAWING ORDER: 1. Lines, 2. Indicators, 3. Barriers, 4. Threats, 5. Top Event, 6. Consequences -->

<!-- Example: Threat box -->
<g style="cursor:pointer">
  <rect x="30" y="72" width="200" height="115" fill="white" stroke="#0000CC" stroke-width="3"/>
  <text x="46" y="102" fill="#0000EE" font-size="15" font-weight="700">Equipment</text>
  <text x="46" y="122" fill="#0000EE" font-size="15" font-weight="700">overpressure</text>
  <line x1="30" y1="140" x2="230" y2="140" stroke="#BBB" stroke-width="0.5"/>
  <rect x="46" y="152" width="14" height="14" fill="#DC2626" rx="1"/>
  <text x="66" y="164" fill="#0000EE" font-size="11" font-weight="600">HC High contribution</text>
</g>

<!-- Example: Barrier block -->
<g style="cursor:pointer" onclick="handleBarrierClick('barrier-id')">
  <rect x="340" y="62" width="180" height="78" fill="white" stroke="#999" stroke-width="1"/>
  <text x="355" y="84" fill="#0000EE" font-size="13" font-weight="700">Pressure Relief Valve</text>
  <line x1="340" y1="92" x2="520" y2="92" stroke="#CCC" stroke-width="0.5"/>
  <text x="355" y="110" fill="#0000EE" font-size="11" text-decoration="underline">Prevent overpressure</text>
  <line x1="340" y1="118" x2="520" y2="118" stroke="#CCC" stroke-width="0.5"/>
  <rect x="355" y="125" width="12" height="12" fill="#3B82F6" rx="1"/>
  <text x="372" y="135" fill="#0000EE" font-size="10">A-HW Active hardware</text>
</g>

<!-- Example: Pathway curve -->
<path d="M 230 130 C 285 130, 305 100, 340 100" stroke="#AAA" stroke-width="2" fill="none"/>

<!-- Example: Top event -->
<circle cx="700" cy="400" r="80" fill="url(#orb)" stroke="#333" stroke-width="2"/>
<rect x="656" y="362" width="88" height="70" fill="white" stroke="#444" stroke-width="1.5"/>
<text x="700" y="386" text-anchor="middle" fill="#1A1A1A" font-size="13" font-weight="700">Overpressure</text>
<text x="700" y="403" text-anchor="middle" fill="#1A1A1A" font-size="13" font-weight="700">in cracker</text>
<text x="700" y="424" text-anchor="middle" fill="#666" font-size="10">(Top Event)</text>

<!-- Example: Hazard box (above circle) -->
<rect x="615" y="270" width="170" height="72" fill="url(#hazard)" stroke="#333" stroke-width="2"/>
<rect x="623" y="278" width="154" height="56" fill="white" stroke="#333" stroke-width="1"/>
<text x="700" y="300" text-anchor="middle" fill="#0000EE" font-size="11" font-weight="700">Loss of containment</text>
<text x="700" y="314" text-anchor="middle" fill="#0000EE" font-size="11" font-weight="700">during gas transfer</text>
<text x="700" y="328" text-anchor="middle" fill="#0000EE" font-size="11" font-weight="700">operations</text>

<!-- Example: Consequence box -->
<g style="cursor:pointer">
  <rect x="1150" y="82" width="200" height="90" fill="white" stroke="#DC2626" stroke-width="3"/>
  <text x="1168" y="112" fill="#0000EE" font-size="14" font-weight="700">Gas release / toxic</text>
  <text x="1168" y="132" fill="#0000EE" font-size="14" font-weight="700">exposure</text>
  <rect x="1150" y="159" width="200" height="13" fill="#DC2626"/>
</g>
</svg>
```

---

## Critical Rules

1. **Lines must NOT overlap with boxes.** Every pathway line connects TO box edges, never passes through box interiors. If a line would cross a box, reroute it with control points.

2. **All content must be visible.** viewBox must be large enough that no text is clipped, no boxes are cut off.

3. **No React Flow.** This is pure SVG rendered as a React component. No nodes, edges, handles, or RF utilities.

4. **Click handlers work.** Clicking any barrier `<g>` group calls `onBarrierClick(barrierId)` which opens the detail panel with SHAP + Evidence tabs.

5. **Responsive zoom.** Wrap in scrollable container with zoom buttons (+/−/reset).

6. **Do NOT run `next build`.** The dev server handles hot reload.

7. **Keep the sidebar and detail panel exactly as they are.** Only replace the ReactFlow canvas area with BowtieSVG.
