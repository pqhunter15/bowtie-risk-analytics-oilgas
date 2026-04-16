/**
 * Convert a snake_case internal name to a human-readable Title Case string.
 *
 * Examples:
 *   "control_room_habitability_hvac_pressurization" → "Control Room Habitability / HVAC Pressurization"
 *   "emergency_shutdown_isolation" → "Emergency Shutdown Isolation"
 *   "other_unknown" → "Other Unknown"
 *
 * Special handling:
 *   - "hvac" → "HVAC" (uppercase acronym)
 *   - "ppe" → "PPE"
 *   - "eds" → "EDS"
 *   - "pa" (standalone) → "PA"
 *   - "decon" → "Decon" (normal title case)
 */

const UPPERCASE_TOKENS = new Set(['hvac', 'ppe', 'eds', 'pa'])

export function formatBarrierFamily(raw: string): string {
  if (!raw) return ''
  return raw
    .split('_')
    .map((word) =>
      UPPERCASE_TOKENS.has(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ')
}
