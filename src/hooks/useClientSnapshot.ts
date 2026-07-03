import { useSyncExternalStore } from 'react'

export function useClientSnapshot<T>(getSnapshot: () => T, serverSnapshot: T) {
  return useSyncExternalStore(
    () => () => {},
    getSnapshot,
    () => serverSnapshot,
  )
}
