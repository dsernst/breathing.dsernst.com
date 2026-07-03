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
import { PAUSE_HINT_MS, PHASE_LABELS, STORAGE_BEST_STREAK } from '@/lib/constants'
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

function phaseActive(phase: BreathMachineState['phase']) {
  return phase === 'inhaling' || phase === 'exhaling'
}

function statusLine(
  state: BreathMachineState,
  listening: boolean,
  sessionDuration: number,
  paused: boolean,
) {
  const parts: string[] = [PHASE_LABELS[state.phase]]
  if (!listening) parts.push('paused')
  else if (paused) parts.push('…')
  if (state.sessionStartedAt !== null) parts.push(formatSessionTime(sessionDuration))
  return parts.join(' · ')
}

export default function BreathingTracker() {
  const [state, setState] = useState<BreathMachineState>(() => createInitialState())
  const [heldKeys, setHeldKeys] = useState<Set<BreathKey>>(new Set())
  const [listening, setListening] = useState(true)
  const stateRef = useRef(state)
  const pressRef = useRef<Partial<Record<BreathKey, number>>>({})

  const insecureContext = useClientSnapshot(() => !window.isSecureContext, false)
  const { needsAudioGate, enableAudio } = useTouchAudioGate()
  const { bumpActivity: bumpIdle, ...idleBeepsProps } = useIdleWarningBeeps(listening, enableAudio)

  const holdDuration = useHoldDuration(state.holdStartedAt)
  const sessionDuration = useSessionDuration(state.sessionStartedAt)
  const awaitingGap = state.phase === 'awaiting-inhale' || state.phase === 'awaiting-exhale'
  const { paused, bumpActivity: bumpPause } = usePauseHint(awaitingGap, PAUSE_HINT_MS)

  useBreathSessionWakeLock(state.phase !== 'idle')

  const live = state.phase !== 'idle' && listening

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
  }

  if (needsAudioGate) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <button
          type="button"
          onClick={enableAudio}
          className="cursor-pointer text-sm tracking-wide text-dim transition hover:text-foreground"
        >
          tap for audio
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center select-none">
      <p
        className={`fixed top-10 text-[0.65rem] uppercase tracking-[0.25em] transition-colors ${
          live ? 'text-accent' : 'text-dim'
        }`}
      >
        {statusLine(state, listening, sessionDuration, paused)}
      </p>

      <div className="flex flex-col items-center leading-none">
        <span
          className={`text-[clamp(4rem,18vw,9rem)] font-extralight tabular-nums tracking-tight transition-colors ${
            state.streak > 0 ? 'text-accent' : 'text-foreground'
          }`}
        >
          {state.streak}
        </span>

        {phaseActive(state.phase) && (
          <span className="mt-3 font-extralight tabular-nums text-dim">
            {formatHoldLive(holdDuration)}
          </span>
        )}
      </div>

      {state.lastMissReason && (
        <p className="fixed bottom-24 max-w-xs px-6 text-center text-xs text-dim">
          miss
        </p>
      )}

      {state.bestStreak > 0 && (
        <p className="fixed bottom-16 text-xs tabular-nums text-dim/80">
          best {state.bestStreak}
        </p>
      )}

      <details className="group fixed bottom-8 text-dim open:text-foreground/60">
        <summary className="cursor-pointer list-none text-center text-sm tracking-widest marker:content-none [&::-webkit-details-marker]:hidden">
          ···
        </summary>
        <div className="absolute bottom-full left-1/2 mb-4 flex w-72 -translate-x-1/2 flex-col gap-4 rounded border border-dim/30 bg-background px-4 py-4 text-xs">
          <BreathController
            heldKeys={heldKeys}
            interactive={listening}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
          />

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={() => setListening((v) => !v)}
              className="cursor-pointer hover:text-foreground"
            >
              {listening ? 'pause' : 'resume'}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={state.phase === 'idle'}
              className="cursor-pointer hover:text-foreground disabled:opacity-30"
            >
              reset
            </button>
            {state.breaths.length > 0 && (
              <button type="button" onClick={exportLog} className="cursor-pointer hover:text-foreground">
                export ({state.breaths.length})
              </button>
            )}
          </div>

          {state.breaths.length > 0 && (
            <ul className="max-h-32 space-y-1 overflow-y-auto tabular-nums text-dim">
              {state.breaths.slice(0, 12).map((b, i) => (
                <li key={b.id}>
                  {state.breaths.length - i}. {formatDuration(b.inhaleMs)} /{' '}
                  {formatDuration(b.exhaleMs)}
                </li>
              ))}
            </ul>
          )}

          {insecureContext && (
            <p className="text-dim/80">Audio needs HTTPS — use npm run dev:https on phone.</p>
          )}

          <IdleWarningBeeps {...idleBeepsProps} />
        </div>
      </details>
    </div>
  )
}
