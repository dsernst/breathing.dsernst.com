'use client'

import { KEY_COLORS } from '@/lib/constants'
import { BreathKey } from '@/lib/breathMachine'

const CONTROLLER_GREEN = '#8bdf63'

function DpadArrow({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-4 w-4"
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
  const rounded = direction === 'up' ? 'rounded-t-xl' : 'rounded-b-xl'

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
      className={`flex h-12 w-24 touch-none items-center justify-center transition-all duration-100 sm:h-14 sm:w-28 ${rounded} ${
        held
          ? `${KEY_COLORS[breathKey]} text-white shadow-md`
          : 'bg-transparent text-zinc-600 hover:bg-white/40 hover:ring-2 hover:ring-black/15 active:scale-95'
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
    <div className="flex w-full max-w-xs flex-col items-center gap-4">
      <div
        className="flex flex-col items-center rounded-3xl px-3 py-2 shadow-inner"
        style={{ backgroundColor: CONTROLLER_GREEN }}
      >
        <BreathKeyButton breathKey="exhale" direction="up" held={heldKeys.has('exhale')} {...props} />
        <div className="h-1 w-20 rounded-full bg-white/50" aria-hidden />
        <BreathKeyButton breathKey="inhale" direction="down" held={heldKeys.has('inhale')} {...props} />
      </div>

      <ul className="flex w-full flex-col gap-2 text-sm text-zinc-400">
        <li className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${KEY_COLORS.inhale}`} />
          <span>
            <span className="text-zinc-300">Down</span> — hold through inhale, release
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${KEY_COLORS.exhale}`} />
          <span>
            <span className="text-zinc-300">Up</span> — hold through exhale, release
          </span>
        </li>
      </ul>

      <p className="text-center text-[10px] leading-snug text-zinc-500">
        <a
          href="https://www.amazon.com/dp/B0CDG2HKBF/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          8BitDo
        </a>{' '}
        in keyboard mode, rotated — D-pad on top
      </p>
    </div>
  )
}
