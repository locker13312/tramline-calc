// The answer runs in the browser on every keystroke, so it has to stay under
// a frame. Worst realistic case: four machines, none pinned, every phase
// searched.
//
// The way search is timed apart on purpose: it is dozens of full
// calculations and the UI runs it on a deferred value, so it is allowed to
// take a few frames while the answer itself stays instant.
import { computeTramlines, fieldPlan } from '../src/lib/tramline.js'
import { solutions } from '../src/lib/solutions.js'
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
  // Захват, що не ділиться: відповідь береться з припущення, тобто розрахунок
  // крутиться по кілька разів, а поряд іде повний перебір способів.
  'boom that does not divide': {
    ...DEFAULTS,
    machines: [
      newMachine('sprayer', { width: 16, axles: [{ trackWidth: 1.8, tyreWidth: 0.45 }] }),
      newMachine('combine', { width: 9 }),
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

const time = (fn) => {
  fn()
  const t = process.hrtime.bigint()
  const n = 30
  for (let i = 0; i < n; i++) fn()
  return Number(process.hrtime.bigint() - t) / 1e6 / n
}

for (const [name, input] of Object.entries(cases)) {
  const answer = time(() => {
    const r = computeTramlines(input)
    const p = fieldPlan(r, input)
    economics(p, r, input)
  })
  const ways = time(() => solutions(input, input))
  console.log(`${answer.toFixed(1)} ms answer + ${ways.toFixed(1)} ms ways   ${name}`)
}
