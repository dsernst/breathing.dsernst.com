import { useCallback, useRef } from 'react'

export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const release = useCallback(() => {
    if (!wakeLockRef.current) return
    void wakeLockRef.current.release()
    wakeLockRef.current = null
  }, [])

  const acquire = useCallback(() => {
    if (!('wakeLock' in navigator)) return
    void navigator.wakeLock
      .request('screen')
      .then((wl) => {
        wakeLockRef.current = wl
      })
      .catch(() => {})
  }, [])

  return { acquire, release }
}
