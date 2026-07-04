/** Pairs 1–2 full; 3–7 fade; 8+ silent. Tied to streak — resets on miss. */
export function speechVolumeForBreathPair(pair: number): number {
  if (pair <= 2) return 1
  if (pair > 7) return 0
  return Math.max(0.05, 0.8 - ((pair - 3) / 4) * 0.75)
}

export function speakBreathPhase(phase: 'in' | 'out', breathPair: number) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  const volume = speechVolumeForBreathPair(breathPair)
  if (volume <= 0) return

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(phase)
  utterance.rate = 0.72
  utterance.volume = volume
  window.speechSynthesis.speak(utterance)
}

export function cancelSpeech() {
  window.speechSynthesis?.cancel()
}

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
  console.assert(speechVolumeForBreathPair(1) === 1)
  console.assert(speechVolumeForBreathPair(2) === 1)
  console.assert(speechVolumeForBreathPair(7) === 0.05)
  console.assert(speechVolumeForBreathPair(8) === 0)
}
