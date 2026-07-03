export type BreathPhase = 'idle' | 'awaiting-inhale' | 'inhaling' | 'awaiting-exhale' | 'exhaling'

export type BreathKey = 'inhale' | 'exhale'

export type BreathRecord = {
  id: string
  inhaleMs: number
  exhaleMs: number
  completedAt: number
}

export type BreathMachineState = {
  phase: BreathPhase
  streak: number
  bestStreak: number
  sessionStartedAt: number | null
  holdStartedAt: number | null
  pendingInhaleMs: number | null
  breaths: BreathRecord[]
  lastMissAt: number | null
  lastMissReason: string | null
}

export const INHALE_KEY = 'f'
export const EXHALE_KEY = 'c'

export function resolveBreathKey(key: string): BreathKey | null {
  const normalized = key.toLowerCase()
  if (normalized === INHALE_KEY || normalized === 'arrowdown') return 'inhale'
  if (normalized === EXHALE_KEY || normalized === 'arrowright') return 'exhale'
  return null
}

export function createInitialState(bestStreak = 0): BreathMachineState {
  return {
    phase: 'idle',
    streak: 0,
    bestStreak,
    sessionStartedAt: null,
    holdStartedAt: null,
    pendingInhaleMs: null,
    breaths: [],
    lastMissAt: null,
    lastMissReason: null,
  }
}

function miss(state: BreathMachineState, reason: string, at: number): BreathMachineState {
  return {
    ...state,
    phase: state.phase === 'idle' ? 'idle' : 'awaiting-inhale',
    streak: 0,
    holdStartedAt: null,
    pendingInhaleMs: null,
    lastMissAt: at,
    lastMissReason: reason,
  }
}

function completeBreath(state: BreathMachineState, exhaleMs: number, at: number): BreathMachineState {
  const inhaleMs = state.pendingInhaleMs ?? 0
  const streak = state.streak + 1
  const record: BreathRecord = {
    id: crypto.randomUUID(),
    inhaleMs,
    exhaleMs,
    completedAt: at,
  }

  return {
    ...state,
    phase: 'awaiting-inhale',
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    holdStartedAt: null,
    pendingInhaleMs: null,
    breaths: [record, ...state.breaths],
    lastMissAt: null,
    lastMissReason: null,
  }
}

export function handleInhaleDown(state: BreathMachineState, at: number): BreathMachineState {
  if (state.phase === 'inhaling') return state
  if (state.phase === 'idle' || state.phase === 'awaiting-inhale') {
    return {
      ...state,
      phase: 'inhaling',
      sessionStartedAt: state.sessionStartedAt ?? at,
      holdStartedAt: at,
      lastMissAt: null,
      lastMissReason: null,
    }
  }
  return miss(state, 'Press down only to start an inhale', at)
}

export function handleInhaleUp(state: BreathMachineState, at: number): BreathMachineState {
  if (state.phase !== 'inhaling' || state.holdStartedAt === null) {
    return miss(state, 'Release down only while inhaling', at)
  }

  return {
    ...state,
    phase: 'awaiting-exhale',
    holdStartedAt: null,
    pendingInhaleMs: at - state.holdStartedAt,
    lastMissAt: null,
    lastMissReason: null,
  }
}

export function handleExhaleDown(state: BreathMachineState, at: number): BreathMachineState {
  if (state.phase === 'exhaling') return state
  if (state.phase === 'awaiting-exhale') {
    return {
      ...state,
      phase: 'exhaling',
      holdStartedAt: at,
      lastMissAt: null,
      lastMissReason: null,
    }
  }
  return miss(state, 'Press right only after an inhale', at)
}

export function handleExhaleUp(state: BreathMachineState, at: number): BreathMachineState {
  if (state.phase !== 'exhaling' || state.holdStartedAt === null) {
    return miss(state, 'Release right only while exhaling', at)
  }

  return completeBreath(state, at - state.holdStartedAt, at)
}

export function handleBreathKeyDown(
  state: BreathMachineState,
  breathKey: BreathKey,
  at: number,
): BreathMachineState {
  if (breathKey === 'inhale') return handleInhaleDown(state, at)
  return handleExhaleDown(state, at)
}

export function handleBreathKeyUp(
  state: BreathMachineState,
  breathKey: BreathKey,
  at: number,
): BreathMachineState {
  if (breathKey === 'inhale') return handleInhaleUp(state, at)
  return handleExhaleUp(state, at)
}

export function resetSession(state: BreathMachineState): BreathMachineState {
  return {
    ...createInitialState(state.bestStreak),
    bestStreak: state.bestStreak,
  }
}

/** ponytail: assert-based self-check — no test framework */
function selfCheck() {
  let s = createInitialState()
  const t0 = 1000

  s = handleInhaleDown(s, t0)
  console.assert(s.phase === 'inhaling')
  s = handleInhaleUp(s, t0 + 4000)
  console.assert(s.phase === 'awaiting-exhale' && s.pendingInhaleMs === 4000)
  s = handleExhaleDown(s, t0 + 5000)
  s = handleExhaleUp(s, t0 + 9000)
  console.assert(s.streak === 1 && s.phase === 'awaiting-inhale')

  s = handleExhaleDown(s, t0 + 9100)
  console.assert(s.streak === 0 && s.lastMissReason !== null)

  s = handleInhaleDown(createInitialState(), t0)
  s = handleExhaleDown(s, t0 + 100)
  console.assert(s.streak === 0)
}

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') selfCheck()
