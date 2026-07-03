import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useWakeLock } from '@/hooks/useWakeLock'

function subscribeInterval(ms: number, onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, ms)
  return () => window.clearInterval(id)
}

function useClock(active: boolean, ms: number) {
  return useSyncExternalStore(
    (onStoreChange) => (active ? subscribeInterval(ms, onStoreChange) : () => {}),
    () => Date.now(),
    () => 0,
  )
}

export function usePauseHint(active: boolean, pauseHintMs: number) {
  const [lastActivity, setLastActivity] = useState(0)
  const now = useClock(active, 500)

  const bumpActivity = useCallback(() => {
    setLastActivity(Date.now())
  }, [])

  const paused = active && lastActivity > 0 && now - lastActivity >= pauseHintMs

  return { paused, bumpActivity }
}

export function useHoldDuration(holdStartedAt: number | null) {
  const now = useClock(holdStartedAt !== null, 100)
  if (holdStartedAt === null) return 0
  return Math.max(0, now - holdStartedAt)
}

export function useSessionDuration(sessionStartedAt: number | null) {
  const now = useClock(sessionStartedAt !== null, 1000)
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
