'use client'

import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { BreathAudioSettings, useBreathAudioPrefs } from '@/components/BreathAudioSettings'
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
import { playMissBeep } from '@/lib/beep'
import { startHoldTone, stopHoldTone } from '@/lib/holdTone'
import {
  BreathKey,
  BreathMachineState,
  createInitialState,
  handleBreathKeyDown,
  handleBreathKeyUp,
  pauseSessionClock,
  resetSession,
  resolveBreathKey,
} from '@/lib/breathMachine'
import { PAUSE_HINT_MS, PHASE_DISPLAY, phaseIsHold, STORAGE_BEST_STREAK } from '@/lib/constants'
import { formatHoldLive, formatSessionTime } from '@/lib/format'
import { readLocalStorageNumber, writeLocalStorage } from '@/lib/localStorage'
import { cancelSpeech, speakBreathPhase } from '@/lib/speech'

function saveBestStreak(n: number) {
  writeLocalStorage(STORAGE_BEST_STREAK, String(n))
}

function formatBeat(beat: string) {
  if (beat === 'in' || beat === 'out') return beat.toUpperCase()
  return beat
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
  const { speechLabels, holdTone, toggleSpeechLabels, toggleHoldTone } = useBreathAudioPrefs()

  const holdDuration = useHoldDuration(state.holdStartedAt)
  const sessionDuration = useSessionDuration(state.sessionMs, state.sessionRunningSince)
  const awaitingGap = state.phase === 'awaiting-inhale' || state.phase === 'awaiting-exhale'
  const { paused, bumpActivity: bumpPause } = usePauseHint(awaitingGap, PAUSE_HINT_MS)
  const sessionClockActive = state.sessionRunningSince !== null || state.sessionMs > 0
  const prevPausedRef = useRef(false)

  const sessionClockPaused = sessionClockActive && state.sessionRunningSince === null

  useBreathSessionWakeLock(state.phase !== 'idle')

  const holding = phaseIsHold(state.phase)
  const { beat, hint } = PHASE_DISPLAY[state.phase]

  useEffect(() => {
    if (!listening || !holdTone) {
      stopHoldTone()
      return
    }
    if (state.phase === 'inhaling') startHoldTone('inhale')
    else if (state.phase === 'exhaling') startHoldTone('exhale')
    else stopHoldTone()
    return () => stopHoldTone()
  }, [listening, holdTone, state.phase])

  useEffect(() => {
    if (paused && !prevPausedRef.current && state.phase !== 'idle') {
      const next = pauseSessionClock(stateRef.current, Date.now())
      stateRef.current = next
      setState(next)
    }
    prevPausedRef.current = paused
  }, [paused, state.phase])

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
    (next: BreathMachineState) => {
      const prev = stateRef.current

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
      const prev = stateRef.current
      const next = handleBreathKeyDown(prev, breathKey, Date.now())
      if (speechLabels) {
        const breathPair = prev.streak + 1
        if (next.phase === 'inhaling' && prev.phase !== 'inhaling')
          speakBreathPhase('in', breathPair)
        if (next.phase === 'exhaling' && prev.phase !== 'exhaling')
          speakBreathPhase('out', breathPair)
      }
      pressRef.current[breathKey] = Date.now()
      setHeldKeys((held) => new Set(held).add(breathKey))
      applyTransition(next)
    },
    [listening, enableAudio, applyTransition, speechLabels],
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
      applyTransition(handleBreathKeyUp(stateRef.current, breathKey, Date.now()))
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

  const reset = () => {
    stopHoldTone()
    cancelSpeech()
    const next = resetSession(stateRef.current)
    stateRef.current = next
    setState(next)
    pressRef.current = {}
    setHeldKeys(new Set())
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
      <div className="fixed inset-x-0 top-8 flex items-baseline justify-between px-8 text-xs tabular-nums tracking-wide">
        {sessionClockActive && (
          <span
            className={`rounded px-2 py-0.5 text-muted transition-colors ${
              sessionClockPaused ? 'border border-muted/60' : 'border border-transparent'
            }`}
          >
            {formatSessionTime(sessionDuration)}
          </span>
        )}
        {state.phase !== 'idle' && (
          <span className="text-foreground/90">
            {state.streak}
            {state.bestStreak > 0 && <span className="text-muted"> · best {state.bestStreak}</span>}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center leading-none">
        <span
          className={`text-[clamp(4rem,20vw,10rem)] font-extralight uppercase tracking-[0.08em] transition-colors duration-150 ${
            holding ? 'text-accent' : 'text-dim'
          }`}
        >
          {formatBeat(beat)}
        </span>

        <span
          className={`mt-4 min-h-[2rem] text-[clamp(1.5rem,6vw,3rem)] font-extralight tabular-nums transition-opacity duration-150 ${
            holding ? 'text-foreground opacity-100' : 'opacity-0'
          }`}
          aria-hidden={!holding}
        >
          {formatHoldLive(holdDuration)}
        </span>

        <span
          className={`mt-3 min-h-[1rem] text-[0.65rem] uppercase tracking-[0.2em] text-dim/70 transition-opacity duration-150 ${
            hint ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={!hint}
        >
          {hint ?? '·'}
        </span>
      </div>

      {state.lastMissReason && (
        <p className="fixed bottom-20 text-xs uppercase tracking-[0.2em] text-dim">miss</p>
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

          <BreathAudioSettings
            speechLabels={speechLabels}
            holdTone={holdTone}
            toggleSpeechLabels={toggleSpeechLabels}
            toggleHoldTone={toggleHoldTone}
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
          </div>

          {insecureContext && (
            <p className="text-dim/80">Audio needs HTTPS — use npm run dev:https on phone.</p>
          )}

          <IdleWarningBeeps {...idleBeepsProps} />
        </div>
      </details>
    </div>
  )
}
