// Перевірка рендером.
//
// Браузерного прогону тут немає, тож компоненти збираються й малюються в
// рядок на сервері: будь-яка помилка в розмітці, звернення до неіснуючого
// поля чи NaN у SVG вилазять одразу, а не в полі. Сценарії ті самі, які
// людина й зустріне: один обприскувач, парк із чотирьох машин, несумісні
// захвати, довільна розкладка сошників.

import { renderToString } from 'react-dom/server'
import Calculator from '../src/components/Calculator'
import { DEFAULTS } from '../src/lib/presets'
import { newMachine, defaultMachines } from '../src/lib/machines'

const noop = () => {}

const scenarios = {
  'типовий старт': { ...DEFAULTS },

  'соняшник, нічого не глушити': {
    ...DEFAULTS, crop: 'sunflower', rows: 12, rowSpacing: 0.7,
    machines: [newMachine('sprayer', { width: 25.2, axles: [{ trackWidth: 2.8, tyreWidth: 0.3 }] })],
    margin: 0.02,
  },

  'повний парк': {
    ...DEFAULTS,
    machines: [
      newMachine('sprayer', { width: 18, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] }),
      newMachine('combine', { width: 9 }),
      newMachine('cart', { width: 9 }),
      newMachine('spreader', { width: 18, axles: [{ trackWidth: 1.8, tyreWidth: 0.55 }] }),
    ],
  },

  'несумісні захвати': {
    ...DEFAULTS, rows: 24, rowSpacing: 0.15,
    machines: [newMachine('sprayer', { width: 20 })],
  },

  'машина поза ритмом': {
    ...DEFAULTS,
    machines: [
      newMachine('sprayer', { width: 18, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] }),
      newMachine('cart', { width: 7.6 }),
    ],
  },

  'довільна розкладка сошників': {
    ...DEFAULTS,
    coulters: [0.075, 0.225, 0.375, 0.525, 0.675, 0.825, 0.975, 1.125,
      2.475, 2.625, 2.775, 2.925, 3.075, 3.225, 3.375, 3.525],
    drillWidth: 3.6,
    machines: [newMachine('sprayer', { width: 18, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] })],
  },

  'слід трактора глушимо': {
    ...DEFAULTS,
    drillTractor: { trackWidth: 1.8, tyreWidth: 0.52, closeOwnTracks: true },
  },

  'асиметричний ритм': {
    ...DEFAULTS, rows: 10, rowSpacing: 0.4,
    machines: [newMachine('sprayer', { width: 18, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] })],
  },

  'півметрове поле': { ...DEFAULTS, fieldWidth: 40, fieldLength: 60, headland: 24 },

  'порожній парк': { ...DEFAULTS, machines: [] },

  'усе по нулях': {
    ...DEFAULTS, rows: 0, rowSpacing: 0, fieldWidth: 0, fieldLength: 0,
    yieldPerHa: 0, pricePerTon: 0, passes: 0, machines: [],
  },

  'стара збережена форма без списку машин': {
    crop: 'wheat', rows: 24, rowSpacing: 0.15, sprayerWidth: 18,
    trackWidth: 1.8, tyreWidth: 0.35, margin: 0.1, halfStart: false,
    fieldWidth: 600, fieldLength: 800, headland: 24,
    yieldPerHa: 6.5, pricePerTon: 8000, passes: 4, damagePct: 70,
  },

  'половинний перший прохід': { ...DEFAULTS, halfStart: true },

  'типові машини з defaultMachines': { ...DEFAULTS, machines: defaultMachines() },
}

let failed = 0
for (const [name, input] of Object.entries(scenarios)) {
  try {
    const html = renderToString(<Calculator input={input} setInput={noop} />)
    const bad = []
    if (/NaN/.test(html)) bad.push('NaN у розмітці')
    if (/undefined/.test(html)) bad.push('undefined у розмітці')
    if (/Infinity/.test(html)) bad.push('Infinity у розмітці')
    if (html.length < 200) bad.push('майже порожній вивід')
    if (bad.length) { failed++; console.log(`FAIL  ${name}: ${bad.join(', ')}`) }
    else console.log(`ok    ${name}  (${html.length} символів)`)
  } catch (e) {
    failed++
    console.log(`CRASH ${name}: ${e.message}`)
  }
}
console.log(failed ? `\n${failed} сценаріїв зламані` : '\nусі сценарії малюються')
process.exit(failed ? 1 : 0)
