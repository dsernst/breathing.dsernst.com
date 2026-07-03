/** 8BitDo Bluetooth auto-sleep after this much inactivity. */
export const CONTROLLER_SLEEP_MS = 15 * 60 * 1000

/** Escalating beeps in the final 30s before sleep — remainingMs before sleep, gain 0–1. */
export const CONTROLLER_IDLE_WARNINGS = [
  { remainingMs: 30_000, gain: 0.12 },
  { remainingMs: 20_000, gain: 0.18 },
  { remainingMs: 15_000, gain: 0.26 },
  { remainingMs: 10_000, gain: 0.34 },
  { remainingMs: 6_500, gain: 0.44 },
  { remainingMs: 3_500, gain: 0.58 },
] as const

/** Show a gentle paused hint after this gap — does not break streak. */
export const PAUSE_HINT_MS = 20_000

export const PHASE_LABELS = {
  idle: 'down to start',
  'awaiting-inhale': 'down',
  inhaling: 'in',
  'awaiting-exhale': 'up',
  exhaling: 'out',
} as const

export const KEY_COLORS = {
  inhale: 'bg-sky-500',
  exhale: 'bg-emerald-500',
} as const

export const STORAGE_BEST_STREAK = 'breathing-best-streak'
export const STORAGE_BREATHS = 'breathing-session-breaths'
