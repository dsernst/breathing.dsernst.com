import { useCallback, useState } from 'react'
import { useClientSnapshot } from '@/hooks/useClientSnapshot'

function isLikelyTouchDevice() {
  if (typeof window === 'undefined') return false
  return navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches
}

let speechPrimed = false

function unlockAudioSession() {
  if (typeof window === 'undefined') return
  if (speechPrimed || !window.speechSynthesis) return
  speechPrimed = true
  window.speechSynthesis.getVoices()
  const utterance = new SpeechSynthesisUtterance('\u200b')
  utterance.volume = 0.01
  utterance.rate = 10
  window.speechSynthesis.speak(utterance)
}

export function useTouchAudioGate() {
  const isTouchDevice = useClientSnapshot(isLikelyTouchDevice, false)
  const [audioReady, setAudioReady] = useState(false)

  const enableAudio = useCallback(() => {
    unlockAudioSession()
    setAudioReady(true)
  }, [])

  return {
    isTouchDevice,
    needsAudioGate: isTouchDevice && !audioReady,
    enableAudio,
  }
}
