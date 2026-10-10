// The whole calculation runs in the browser on every keystroke, so it has to
// stay under a frame. Worst realistic case: four machines, none pinned, every
// phase searched.
import { computeTramlines, fieldPlan, suggestTracks } from '../src/lib/tramline.js'
import { economics } from '../src/lib/economics.js'
import { newMachine } from '../src/lib/machines.js'
import { DEFAULTS } from '../src/lib/presets.js'

const cases = {
  'default (1 machine)': { ...DEFAULTS },
  'four machines, cereal': {
    ...DEFAULTS,
    machines: [
      newMachine('sprayer', { width: 18, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] }),
      newMachine('combine', { width: 9 }),
      newMachine('cart', { width: 9 }),
      newMachine('spreader', { width: 18 }),
    ],
  },
  'wide drill, 48 coulters': {
    ...DEFAULTS, rows: 48, rowSpacing: 0.125,
    machines: [
      newMachine('sprayer', { width: 24 }),
      newMachine('combine', { width: 12 }),
      newMachine('cart', { width: 12 }),
    ],
  },
}

for (const [name, input] of Object.entries(cases)) {
  const run = () => {
    const r = computeTramlines(input)
    const p = fieldPlan(r, input)
    suggestTracks(input)
    economics(p, r, input)
  }
  run()
  const t = process.hrtime.bigint()
  const n = 30
  for (let i = 0; i < n; i++) run()
  const ms = Number(process.hrtime.bigint() - t) / 1e6 / n
  console.log(`${ms.toFixed(1)} ms   ${name}`)
}
