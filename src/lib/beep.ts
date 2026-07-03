import { CONTROLLER_IDLE_WARNINGS } from '@/lib/constants'

let audioCtx: AudioContext | null = null
let testTimeoutIds: number[] = []

function getAudioContext() {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  return audioCtx
}

function tone(freq: number, gain: number, durationMs: number, startOffset = 0) {
  const ctx = getAudioContext()
  const now = ctx.currentTime + startOffset
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gainNode.gain.setValueAtTime(gain, now)
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000)
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + durationMs / 1000)
}

export function playInhaleStartBeep() {
  tone(320, 0.12, 80)
}

export function playExhaleStartBeep() {
  tone(240, 0.12, 80)
}

export function playBreathCompleteBeep() {
  tone(440, 0.1, 60)
}

export function playMissBeep() {
  tone(120, 0.18, 200)
}

export function playHoldTickBeep() {
  tone(200, 0.12, 80)
}

export function playIdleWarningBeep(gain = 0.12) {
  const ctx = getAudioContext()
  const now = ctx.currentTime
  const toneMs = gain >= 0.4 ? 0.16 : 0.12

  for (const [start, freq] of [
    [0, 880],
    [0.2, 660],
  ] as const) {
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gainNode.gain.setValueAtTime(gain, now + start)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + toneMs)
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.start(now + start)
    osc.stop(now + start + toneMs)
  }
}

export function playIdleWarningSequenceTest(onComplete?: () => void) {
  cancelIdleWarningSequenceTest()

  let delay = 0

  for (let i = 0; i < CONTROLLER_IDLE_WARNINGS.length; i++) {
    const { gain } = CONTROLLER_IDLE_WARNINGS[i]!
    testTimeoutIds.push(window.setTimeout(() => playIdleWarningBeep(gain), delay))

    const next = CONTROLLER_IDLE_WARNINGS[i + 1]
    if (!next) continue
    delay += CONTROLLER_IDLE_WARNINGS[i]!.remainingMs - next.remainingMs
  }

  if (onComplete) testTimeoutIds.push(window.setTimeout(onComplete, delay + 400))
}

export function cancelIdleWarningSequenceTest() {
  for (const id of testTimeoutIds) window.clearTimeout(id)
  testTimeoutIds = []
}
