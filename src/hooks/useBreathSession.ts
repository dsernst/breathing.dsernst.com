import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useWakeLock } from '@/hooks/useWakeLock'

function createClockStore(intervalMs: number) {
  let snapshot = 0
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setInterval> | null = null

  function subscribe(onStoreChange: () => void) {
    listeners.add(onStoreChange)
    if (!timer) {
      snapshot = Date.now()
      timer = setInterval(() => {
        snapshot = Date.now()
        listeners.forEach((l) => l())
      }, intervalMs)
    }
    return () => {
      listeners.delete(onStoreChange)
      if (listeners.size === 0 && timer) {
        clearInterval(timer)
        timer = null
      }
    }
  }

  return {
    subscribe,
    getSnapshot: () => snapshot,
  }
}

const clock100 = createClockStore(100)
const clock500 = createClockStore(500)
const clock1000 = createClockStore(1000)

function useStoreClock(store: ReturnType<typeof createClockStore>, active: boolean): number {
  return useSyncExternalStore(
    (cb) => (active ? store.subscribe(cb) : () => {}),
    () => (active ? store.getSnapshot() : 0),
    () => 0,
  )
}

export function usePauseHint(active: boolean, pauseHintMs: number) {
  const [lastActivity, setLastActivity] = useState(0)
  const now = useStoreClock(clock500, active)

  const bumpActivity = useCallback(() => {
    setLastActivity(Date.now())
  }, [])

  const paused = active && lastActivity > 0 && now - lastActivity >= pauseHintMs

  return { paused, bumpActivity }
}

export function useHoldDuration(holdStartedAt: number | null) {
  const now = useStoreClock(clock100, holdStartedAt !== null)
  if (holdStartedAt === null) return 0
  return Math.max(0, now - holdStartedAt)
}

export function useSessionDuration(sessionStartedAt: number | null) {
  const now = useStoreClock(clock1000, sessionStartedAt !== null)
  if (sessionStartedAt === null) return 0
  return Math.max(0, now - sessionStartedAt)
}

export function useBreathSessionWakeLock(active: boolean) {
  const { acquire, release } = useWakeLock()

  useEffect(() => {
    if (!active) {
      release()
      return
    }
    acquire()
    return () => release()
  }, [active, acquire, release])
}
