/** Halves each pair; silent by pair 5. Tied to streak — resets on miss. */
export function speechVolumeForBreathPair(pair: number): number {
  if (pair >= 5) return 0
  return 0.5 ** (pair - 1)
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
  console.assert(speechVolumeForBreathPair(2) === 0.5)
  console.assert(speechVolumeForBreathPair(3) === 0.25)
  console.assert(speechVolumeForBreathPair(4) === 0.125)
  console.assert(speechVolumeForBreathPair(5) === 0)
}
