import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useWakeLock } from '@/hooks/useWakeLock'

let nowSnapshot = 0
const nowListeners = new Set<() => void>()
let nowTimer: ReturnType<typeof setInterval> | null = null

function subscribeNow(onStoreChange: () => void) {
  nowListeners.add(onStoreChange)
  if (!nowTimer) {
    nowSnapshot = Date.now()
    nowTimer = setInterval(() => {
      nowSnapshot = Date.now()
      nowListeners.forEach((l) => l())
    }, 100)
  }
  return () => {
    nowListeners.delete(onStoreChange)
    if (nowListeners.size === 0 && nowTimer) {
      clearInterval(nowTimer)
      nowTimer = null
    }
  }
}

function getNowSnapshot() {
  return nowSnapshot
}

function useNow() {
  return useSyncExternalStore(subscribeNow, getNowSnapshot, () => 0)
}

export function usePauseHint(active: boolean, pauseHintMs: number) {
  const [lastActivity, setLastActivity] = useState(0)
  const now = useNow()

  const bumpActivity = useCallback(() => {
    setLastActivity(Date.now())
  }, [])

  const paused = active && lastActivity > 0 && now - lastActivity >= pauseHintMs

  return { paused, bumpActivity }
}

export function useHoldDuration(holdStartedAt: number | null) {
  const now = useNow()
  if (holdStartedAt === null) return 0
  return Math.max(0, now - holdStartedAt)
}

export function useSessionDuration(sessionStartedAt: number | null) {
  const now = useNow()
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
