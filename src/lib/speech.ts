import { BreathKey } from '@/lib/breathMachine'

export function speakBreathPhase(phase: 'in' | 'out') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(phase)
  utterance.rate = 0.72
  utterance.volume = 0.65
  window.speechSynthesis.speak(utterance)
}

export function cancelSpeech() {
  window.speechSynthesis?.cancel()
}

export function breathKeyToSpeech(key: BreathKey): 'in' | 'out' {
  return key === 'inhale' ? 'in' : 'out'
}
