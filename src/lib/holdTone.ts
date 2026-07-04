import { BreathKey } from '@/lib/breathMachine'
import { getAudioContext } from '@/lib/beep'

const HOLD_FREQ: Record<BreathKey, number> = {
  inhale: 185,
  exhale: 140,
}

let osc: OscillatorNode | null = null
let gain: GainNode | null = null
let filter: BiquadFilterNode | null = null
let activeKey: BreathKey | null = null

export function startHoldTone(key: BreathKey) {
  if (activeKey === key && osc) return

  stopHoldTone()

  const ctx = getAudioContext()
  const now = ctx.currentTime

  filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 680

  gain = ctx.createGain()
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.16, now + 0.45)

  osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(HOLD_FREQ[key], now)

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)

  activeKey = key
}

export function stopHoldTone() {
  if (!osc || !gain) {
    activeKey = null
    return
  }

  const ctx = getAudioContext()
  const now = ctx.currentTime
  const stopping = osc

  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(0.001, now + 0.25)
  stopping.stop(now + 0.26)

  osc = null
  gain = null
  filter = null
  activeKey = null
}
