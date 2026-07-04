'use client'

import { startTransition, useCallback, useEffect, useState } from 'react'
import { STORAGE_HOLD_TONE, STORAGE_SPEECH_LABELS } from '@/lib/constants'
import { readLocalStorage, writeLocalStorage } from '@/lib/localStorage'

function loadBool(key: string, fallback: boolean) {
  return readLocalStorage(key, String(fallback)) === 'true'
}

export function useBreathAudioPrefs() {
  const [speechLabels, setSpeechLabels] = useState(true)
  const [holdTone, setHoldTone] = useState(true)

  useEffect(() => {
    startTransition(() => {
      setSpeechLabels(loadBool(STORAGE_SPEECH_LABELS, true))
      setHoldTone(loadBool(STORAGE_HOLD_TONE, true))
    })
  }, [])

  const toggleSpeechLabels = useCallback(() => {
    setSpeechLabels((v) => {
      const next = !v
      writeLocalStorage(STORAGE_SPEECH_LABELS, String(next))
      return next
    })
  }, [])

  const toggleHoldTone = useCallback(() => {
    setHoldTone((v) => {
      const next = !v
      writeLocalStorage(STORAGE_HOLD_TONE, String(next))
      return next
    })
  }, [])

  return { speechLabels, holdTone, toggleSpeechLabels, toggleHoldTone }
}

export function BreathAudioSettings({
  speechLabels,
  holdTone,
  toggleSpeechLabels,
  toggleHoldTone,
}: {
  speechLabels: boolean
  holdTone: boolean
  toggleSpeechLabels: () => void
  toggleHoldTone: () => void
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      <button type="button" onClick={toggleSpeechLabels} className="cursor-pointer hover:text-foreground">
        voice {speechLabels ? 'on' : 'off'}
      </button>
      <button type="button" onClick={toggleHoldTone} className="cursor-pointer hover:text-foreground">
        tone {holdTone ? 'on' : 'off'}
      </button>
    </div>
  )
}
