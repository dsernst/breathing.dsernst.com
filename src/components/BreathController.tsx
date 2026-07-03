'use client'

import { BreathKey } from '@/lib/breathMachine'

function DpadArrow({ direction }: { direction: 'down' | 'right' }) {
  const rotation = direction === 'down' ? 'rotate(180deg)' : 'rotate(90deg)'

  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" style={{ transform: rotation }} aria-hidden>
      <path d="M6 2 L10 9 H2 Z" fill="currentColor" />
    </svg>
  )
}

function BreathKeyButton({
  breathKey,
  direction,
  held,
  interactive,
  onKeyDown,
  onKeyUp,
}: {
  breathKey: BreathKey
  direction: 'down' | 'right'
  held: boolean
  interactive: boolean
  onKeyDown: (key: BreathKey) => void
  onKeyUp: (key: BreathKey) => void
}) {
  const label = breathKey === 'inhale' ? 'Inhale' : 'Exhale'

  return (
    <button
      type="button"
      disabled={!interactive}
      aria-label={label}
      onPointerDown={(e) => {
        if (!interactive) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        onKeyDown(breathKey)
      }}
      onPointerUp={(e) => {
        if (!interactive) return
        e.preventDefault()
        onKeyUp(breathKey)
      }}
      onPointerCancel={() => onKeyUp(breathKey)}
      className={`flex h-10 w-10 touch-none items-center justify-center transition-colors ${
        held ? 'bg-accent/20 text-accent' : 'text-dim hover:text-foreground/60'
      } ${interactive ? 'cursor-pointer' : ''}`}
    >
      <DpadArrow direction={direction} />
    </button>
  )
}

/** Down + right — adjacent on the D-pad, minimal finger travel. */
export default function BreathController({
  heldKeys,
  interactive,
  onKeyDown,
  onKeyUp,
}: {
  heldKeys: Set<BreathKey>
  interactive: boolean
  onKeyDown: (key: BreathKey) => void
  onKeyUp: (key: BreathKey) => void
}) {
  const props = { interactive, onKeyDown, onKeyUp }

  return (
    <div className="inline-grid grid-cols-2 grid-rows-2 border border-dim/40">
      <div aria-hidden />
      <BreathKeyButton breathKey="exhale" direction="right" held={heldKeys.has('exhale')} {...props} />
      <BreathKeyButton breathKey="inhale" direction="down" held={heldKeys.has('inhale')} {...props} />
      <div aria-hidden />
    </div>
  )
}
