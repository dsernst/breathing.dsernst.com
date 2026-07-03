export function readLocalStorage(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeLocalStorage(key: string, value: string) {
  localStorage.setItem(key, value)
}

export function readLocalStorageNumber(key: string, fallback: number): number {
  const raw = readLocalStorage(key, String(fallback))
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}
