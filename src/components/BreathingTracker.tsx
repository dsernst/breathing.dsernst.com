'use client'

import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import BreathController from '@/components/BreathController'
import { IdleWarningBeeps, useIdleWarningBeeps } from '@/components/IdleWarningBeeps'
import { useClientSnapshot } from '@/hooks/useClientSnapshot'
import {
  useBreathSessionWakeLock,
  useHoldDuration,
  usePauseHint,
  useSessionDuration,
} from '@/hooks/useBreathSession'
import { useTouchAudioGate } from '@/hooks/useTouchAudioGate'
import {
  playBreathCompleteBeep,
  playExhaleStartBeep,
  playHoldTickBeep,
  playInhaleStartBeep,
  playMissBeep,
} from '@/lib/beep'
import {
  BreathKey,
  BreathMachineState,
  createInitialState,
  handleBreathKeyDown,
  handleBreathKeyUp,
  resetSession,
  resolveBreathKey,
} from '@/lib/breathMachine'
import { KEY_COLORS, PAUSE_HINT_MS, PHASE_LABELS, STORAGE_BEST_STREAK } from '@/lib/constants'
import {
  formatDuration,
  formatExportFilename,
  formatHoldLive,
  formatSessionTime,
  formatTimestamp,
} from '@/lib/format'
import { readLocalStorageNumber, writeLocalStorage } from '@/lib/localStorage'

function saveBestStreak(n: number) {
  writeLocalStorage(STORAGE_BEST_STREAK, String(n))
}

function phaseAccent(phase: BreathMachineState['phase']) {
  if (phase === 'inhaling') return 'text-sky-400'
  if (phase === 'exhaling') return 'text-emerald-400'
  if (phase === 'idle') return 'text-zinc-500'
  return 'text-lime-400'
}

function phaseActive(phase: BreathMachineState['phase']) {
  return phase === 'inhaling' || phase === 'exhaling'
}

export default function BreathingTracker() {
  const [state, setState] = useState<BreathMachineState>(() => createInitialState())
  const [heldKeys, setHeldKeys] = useState<Set<BreathKey>>(new Set())
  const [listening, setListening] = useState(true)
  const [exportedCount, setExportedCount] = useState<number | null>(null)
  const stateRef = useRef(state)
  const pressRef = useRef<Partial<Record<BreathKey, number>>>({})

  const insecureContext = useClientSnapshot(() => !window.isSecureContext, false)
  const { needsAudioGate, enableAudio } = useTouchAudioGate()
  const { bumpActivity: bumpIdle, ...idleBeepsProps } = useIdleWarningBeeps(listening, enableAudio)

  const holdDuration = useHoldDuration(state.holdStartedAt)
  const sessionDuration = useSessionDuration(state.sessionStartedAt)
  const awaitingGap = state.phase === 'awaiting-inhale' || state.phase === 'awaiting-exhale'
  const { paused, bumpActivity: bumpPause } = usePauseHint(awaitingGap && state.phase !== 'idle', PAUSE_HINT_MS)

  useBreathSessionWakeLock(state.phase !== 'idle')

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const best = readLocalStorageNumber(STORAGE_BEST_STREAK, 0)
    startTransition(() => {
      setState((s) => ({ ...s, bestStreak: Math.max(s.bestStreak, best) }))
    })
  }, [])

  useEffect(() => {
    if (state.bestStreak > readLocalStorageNumber(STORAGE_BEST_STREAK, 0)) {
      saveBestStreak(state.bestStreak)
    }
  }, [state.bestStreak])

  const bumpActivity = useCallback(() => {
    bumpIdle()
    bumpPause()
  }, [bumpIdle, bumpPause])

  const applyTransition = useCallback(
    (next: BreathMachineState, breathKey: BreathKey, isDown: boolean) => {
      const prev = stateRef.current

      if (isDown && next.phase === 'inhaling' && prev.phase !== 'inhaling') playInhaleStartBeep()
      if (isDown && next.phase === 'exhaling' && prev.phase !== 'exhaling') playExhaleStartBeep()
      if (next.streak > prev.streak) playBreathCompleteBeep()
      if (next.lastMissAt !== null && next.lastMissAt !== prev.lastMissAt) playMissBeep()

      stateRef.current = next
      setState(next)
      bumpActivity()
    },
    [bumpActivity],
  )

  const handleKeyDown = useCallback(
    (breathKey: BreathKey) => {
      if (!listening || pressRef.current[breathKey]) return
      enableAudio()
      pressRef.current[breathKey] = Date.now()
      setHeldKeys((prev) => new Set(prev).add(breathKey))
      applyTransition(handleBreathKeyDown(stateRef.current, breathKey, Date.now()), breathKey, true)
    },
    [listening, enableAudio, applyTransition],
  )

  const handleKeyUp = useCallback(
    (breathKey: BreathKey) => {
      if (!listening) return
      delete pressRef.current[breathKey]
      setHeldKeys((prev) => {
        const next = new Set(prev)
        next.delete(breathKey)
        return next
      })
      applyTransition(handleBreathKeyUp(stateRef.current, breathKey, Date.now()), breathKey, false)
    },
    [listening, applyTransition],
  )

  useEffect(() => {
    if (!listening) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const breathKey = resolveBreathKey(e.key)
      if (!breathKey) return
      e.preventDefault()
      handleKeyDown(breathKey)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const breathKey = resolveBreathKey(e.key)
      if (!breathKey) return
      e.preventDefault()
      handleKeyUp(breathKey)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [listening, handleKeyDown, handleKeyUp])

  useEffect(() => {
    if (!phaseActive(state.phase) || holdDuration < 1000) return
    const secs = Math.floor(holdDuration / 1000)
    const prevSecs = Math.floor((holdDuration - 100) / 1000)
    if (secs > prevSecs) playHoldTickBeep()
  }, [state.phase, holdDuration])

  const reset = () => {
    const next = resetSession(stateRef.current)
    stateRef.current = next
    setState(next)
    pressRef.current = {}
    setHeldKeys(new Set())
    setExportedCount(null)
  }

  const exportLog = () => {
    const lines = [...state.breaths]
      .reverse()
      .map(
        (b, i) =>
          `${i + 1}\t${formatTimestamp(b.completedAt)}\t${formatDuration(b.inhaleMs)}\t${formatDuration(b.exhaleMs)}`,
      )
      .join('\n')
    const blob = new Blob([`breath\ttimestamp\tinhale\texhale\n${lines}\n`], {
      type: 'text/tab-separated-values',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = formatExportFilename()
    a.click()
    URL.revokeObjectURL(url)
    setExportedCount(state.breaths.length)
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Breathing</h1>
        <p className="text-zinc-400">Track inhale and exhale holds — build an unbroken streak</p>
      </header>

      <section className="flex flex-col items-center gap-6 overflow-visible rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
        <div className="flex w-full items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${listening ? 'animate-pulse bg-lime-500' : 'bg-zinc-400'}`}
            />
            <span className="text-zinc-300">{listening ? 'Listening' : 'Paused'}</span>
          </div>
          {state.sessionStartedAt !== null && (
            <span className="font-mono text-zinc-500">{formatSessionTime(sessionDuration)}</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-500">Streak</p>
          <p
            className={`font-mono text-7xl font-extralight tabular-nums tracking-tight sm:text-8xl ${
              state.streak > 0 ? 'text-lime-400' : 'text-zinc-300'
            }`}
          >
            {state.streak}
          </p>
          <p className="text-sm text-zinc-500">
            best <span className="font-mono text-zinc-400">{state.bestStreak}</span>
          </p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className={`text-sm font-medium uppercase tracking-widest ${phaseAccent(state.phase)}`}>
            {PHASE_LABELS[state.phase]}
          </p>
          {phaseActive(state.phase) && (
            <p className="font-mono text-2xl tabular-nums text-zinc-300">
              {formatHoldLive(holdDuration)}
            </p>
          )}
          {paused && (
            <p className="text-xs text-zinc-500">Paused — take your time, streak still counts</p>
          )}
        </div>

        {state.lastMissReason && (
          <p className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-2 text-center text-sm text-rose-200/90">
            Miss — streak reset. {state.lastMissReason}
          </p>
        )}

        {insecureContext && (
          <p className="rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-xs leading-relaxed text-amber-200/90">
            Audio requires HTTPS. Use <code className="text-amber-100">npm run dev:https</code> for
            phone testing.
          </p>
        )}

        {needsAudioGate ? (
          <button
            type="button"
            onClick={enableAudio}
            className="cursor-pointer rounded-xl bg-lime-600 px-8 py-3 text-sm font-medium text-white transition"
          >
            Enable audio feedback
          </button>
        ) : (
          <>
            <BreathController
              heldKeys={heldKeys}
              interactive={listening}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
            />
            <IdleWarningBeeps {...idleBeepsProps} />
          </>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setListening((v) => !v)}
            className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            {listening ? 'Pause' : 'Resume'}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={state.phase === 'idle'}
            className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-default disabled:opacity-40"
          >
            Reset session
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Breaths ({state.breaths.length})
          </h2>
          <button
            type="button"
            onClick={exportLog}
            disabled={state.breaths.length === 0}
            className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-default disabled:opacity-40"
          >
            {exportedCount === state.breaths.length && state.breaths.length > 0
              ? 'Exported.'
              : 'Export'}
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-800">
          {state.breaths.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-400">
              Complete an inhale → exhale cycle to start your streak.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {state.breaths.map((breath, i) => (
                <li
                  key={breath.id}
                  className="flex items-center gap-4 px-4 py-2.5 font-mono text-sm"
                >
                  <span className="w-8 shrink-0 text-zinc-500">#{state.breaths.length - i}</span>
                  <span className="w-24 shrink-0 text-zinc-400">
                    {formatTimestamp(breath.completedAt)}
                  </span>
                  <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${KEY_COLORS.inhale}`} />
                  <span className="text-zinc-300">{formatDuration(breath.inhaleMs)}</span>
                  <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${KEY_COLORS.exhale}`} />
                  <span className="text-zinc-300">{formatDuration(breath.exhaleMs)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
