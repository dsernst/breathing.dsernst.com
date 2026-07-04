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

import { BreathPhase } from '@/lib/breathMachine'

/** Show a gentle paused hint after this gap — does not break streak. */
export const PAUSE_HINT_MS = 20_000

/** Main beat on screen — rhythm first, not controller directions. */
export const PHASE_DISPLAY: Record<
  BreathPhase,
  { beat: string; hint?: string }
> = {
  idle: { beat: '—', hint: 'down to start' },
  'awaiting-inhale': { beat: '—' },
  inhaling: { beat: 'in' },
  'awaiting-exhale': { beat: '—' },
  exhaling: { beat: 'out' },
}

export function phaseIsHold(phase: BreathPhase) {
  return phase === 'inhaling' || phase === 'exhaling'
}

export const KEY_COLORS = {
  inhale: 'bg-accent/60',
  exhale: 'bg-accent/40',
} as const

export const STORAGE_BEST_STREAK = 'breathing-best-streak'
export const STORAGE_BREATHS = 'breathing-session-breaths'
