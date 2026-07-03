'use client'

import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import {
  cancelIdleWarningSequenceTest,
  playIdleWarningBeep,
  playIdleWarningSequenceTest,
} from '@/lib/beep'
import { CONTROLLER_IDLE_WARNINGS, CONTROLLER_SLEEP_MS } from '@/lib/constants'
import { readLocalStorage, writeLocalStorage } from '@/lib/localStorage'

const STORAGE_KEY = 'breathing-idle-warning-beeps'
const IDLE_POLL_MS = 500

function loadEnabled(): boolean {
  return readLocalStorage(STORAGE_KEY, 'true') === 'true'
}

function saveEnabled(enabled: boolean) {
  writeLocalStorage(STORAGE_KEY, String(enabled))
}

export function useIdleWarningBeeps(listening: boolean, enableAudio: () => void) {
  const [enabled, setEnabled] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testSecs, setTestSecs] = useState(30)
  const lastActivityRef = useRef(0)
  const firedRef = useRef<Set<number>>(new Set())
  const active = listening && enabled

  useEffect(() => {
    startTransition(() => setEnabled(loadEnabled()))
  }, [])

  useEffect(() => () => cancelIdleWarningSequenceTest(), [])

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    firedRef.current.clear()
  }, [])

  const stopTest = useCallback(() => {
    cancelIdleWarningSequenceTest()
    setTesting(false)
  }, [])

  const bumpActivity = useCallback(() => {
    resetIdleTimer()
    stopTest()
  }, [resetIdleTimer, stopTest])

  useEffect(() => {
    if (!active) return

    resetIdleTimer()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') resetIdleTimer()
      else stopTest()
    }

    const tick = () => {
      if (document.visibilityState !== 'visible') return

      const idleMs = Date.now() - lastActivityRef.current

      for (const { remainingMs, gain } of CONTROLLER_IDLE_WARNINGS) {
        if (firedRef.current.has(remainingMs)) continue
        if (idleMs < CONTROLLER_SLEEP_MS - remainingMs) continue

        firedRef.current.add(remainingMs)
        playIdleWarningBeep(gain)
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    const id = window.setInterval(tick, IDLE_POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(id)
    }
  }, [active, resetIdleTimer, stopTest])

  const toggleEnabled = useCallback(() => {
    if (enabled && testing) stopTest()
    setEnabled((v) => {
      const next = !v
      saveEnabled(next)
      return next
    })
  }, [enabled, testing, stopTest])

  const toggleTest = useCallback(() => {
    if (testing) return stopTest()
    enableAudio()
    setTestSecs(30)
    setTesting(true)
    playIdleWarningSequenceTest(stopTest)
  }, [testing, enableAudio, stopTest])

  useEffect(() => {
    if (!testing) return

    const id = window.setInterval(() => {
      setTestSecs((s) => Math.max(0, s - 1))
    }, 1000)

    return () => window.clearInterval(id)
  }, [testing])

  return {
    bumpActivity,
    enabled,
    testing,
    testSecs,
    toggleEnabled,
    toggleTest,
  }
}

export function IdleWarningBeeps({
  enabled,
  testing,
  testSecs,
  toggleEnabled,
  toggleTest,
}: {
  enabled: boolean
  testing: boolean
  testSecs: number
  toggleEnabled: () => void
  toggleTest: () => void
}) {
  const sleepMin = CONTROLLER_SLEEP_MS / 60_000

  return (
    <details className="group w-full">
      <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 transition hover:text-zinc-400 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="inline-block text-[9px] transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        Idle warning beeps{!enabled ? ' (disabled)' : ''}
      </summary>
      <div className="mt-2 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <p className="text-sm leading-relaxed text-zinc-300">
          Controller auto-sleeps after{' '}
          <span className="font-mono text-zinc-200">
            {sleepMin}
            <span className="text-[8px]"> </span>min
          </span>{' '}
          of inactivity.
        </p>

        <div>
          <p className="mb-1.5 text-xs text-zinc-500">Warning beeps before sleep</p>
          <div className="flex flex-wrap gap-1.5">
            {CONTROLLER_IDLE_WARNINGS.map(({ remainingMs }) => (
              <span
                key={remainingMs}
                className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300"
              >
                −{remainingMs / 1000}s
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs leading-relaxed text-zinc-400">
          Press any controller button to reset the timer.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleEnabled}
            className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            {enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            onClick={toggleTest}
            className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1.5 text-sm tabular-nums text-zinc-300 transition hover:bg-zinc-800"
          >
            {testing ? `Testing - ${testSecs}s` : 'Test'}
          </button>
        </div>
      </div>
    </details>
  )
}
