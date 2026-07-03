'use client'

import { BreathKey } from '@/lib/breathMachine'

function DpadArrow({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-3 w-3"
      style={direction === 'down' ? { transform: 'rotate(180deg)' } : undefined}
      aria-hidden
    >
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
  direction: 'up' | 'down'
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
      className={`flex h-10 w-16 touch-none items-center justify-center transition-colors ${
        held ? 'bg-accent/20 text-accent' : 'text-dim hover:text-foreground/60'
      } ${interactive ? 'cursor-pointer' : ''}`}
    >
      <DpadArrow direction={direction} />
    </button>
  )
}

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
    <div className="flex flex-col items-center border border-dim/40">
      <BreathKeyButton breathKey="exhale" direction="up" held={heldKeys.has('exhale')} {...props} />
      <div className="h-px w-full bg-dim/40" aria-hidden />
      <BreathKeyButton breathKey="inhale" direction="down" held={heldKeys.has('inhale')} {...props} />
    </div>
  )
}
