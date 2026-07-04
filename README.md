# breathing.dsernst.com

A minimal breathing rhythm tracker. Press down/right buttons through each inhale and exhale, build a streak, and stay in flow with eyes open or closed.

## How it works

Press and **hold** through each phase, then **release** at the end:

| Phase  | Input                    |
| ------ | ------------------------ |
| Inhale | Hold **Down** (`f` / ↓)  |
| Exhale | Hold **Right** (`c` / →) |

The center shows **IN** / **OUT** while you're holding, and **—** in the gaps between breaths.

Works with an [8BitDo](https://www.8bitdo.com/) controller in keyboard mode (rotated). A touch D-pad in the **···** drawer is there for testing without a controller.

## UI

- **Top left** — session clock (pauses after 3s idle in a gap; resumes on next inhale)
- **Top right** — current streak and best streak
- **Center** — large beat label with a soft fade on phase changes
- **Bottom** — **···** drawer: touch controller, pause/reset, audio toggles, idle warning settings

## Streak & miss

A full inhale + exhale cycle increments the streak. A **miss** (wrong button or bad timing) resets the streak to 0 but keeps the session going.

On miss, the session clock **freezes** at the elapsed time so you can see how long that run lasted. It resets when you start the next inhale.

## Audio

Toggle in the **···** drawer:

- **Voice** — speaks "in" / "out" on press; fades from pair 1, silent by pair 5
- **Hold tone** — low drone while holding (higher pitch on inhale, lower on exhale)
- **Idle warnings** — escalating beeps in the last 30s before an 8BitDo controller auto-sleeps (15 min idle)

Miss plays a short beep. No beeps on press or release otherwise.

Audio needs a secure context. On a phone over plain HTTP, use:

```bash
npm run dev:https
```

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

