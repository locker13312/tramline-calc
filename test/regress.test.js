// ── Баги, що вже були ─────────────────────────────────────────────────────
//
// Кожен тест тут стоїть за конкретною помилкою, яку знайшли на живій
// програмі. Вони не перевіряють геометрію — для неї є свої файли, — а
// стережуть ті дрібниці, через які правильний розрахунок показував неправду
// або тихо брав не ті дані.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTramlines, fieldPlan, drillGeometry } from '../src/lib/tramline.js'
import { normaliseMachines } from '../src/lib/machines.js'

const grain = { rows: 24, rowSpacing: 0.15, margin: 0.05 }
const sprayer = (extra = {}) => ({
  id: 's', kind: 'sprayer', label: 'Обприскувач', width: 18,
  axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }], ...extra,
})

// Стерте поле захвату робило машину непридатною, і вона просто випадала з
// розрахунку: цифри вгорі змінювалися, а причини не було видно ніде.
test('ввімкнена машина без захвату не зникає мовчки, а дає попередження', () => {
  const r = computeTramlines({
    ...grain,
    machines: [sprayer(), { id: 'c', label: 'Комбайн', width: 0, axles: [{ trackWidth: 3, tyreWidth: 0.8 }] }],
  })
  assert.equal(r.ok, true)
  const c = r.machines.find((m) => m.id === 'c')
  assert.equal(c.active, false)
  assert.equal(c.reason, 'blank', 'це не «вимкнена свідомо», а «не заповнена»')
  assert.ok(r.warnings.some((w) => w.includes('Комбайн') && w.includes('захват')),
    `мусить бути попередження: ${JSON.stringify(r.warnings)}`)
})

test('ввімкнена машина без колісної бази теж дає попередження', () => {
  const r = computeTramlines({
    ...grain,
    machines: [sprayer(), { id: 'c', label: 'Комбайн', width: 9, axles: [{ trackWidth: 0, tyreWidth: 0.8 }] }],
  })
  const c = r.machines.find((m) => m.id === 'c')
  assert.equal(c.reason, 'blank')
  assert.ok(r.warnings.some((w) => w.includes('Комбайн') && w.includes('колісна база')))
})

// Вимкнена свідомо — це інша причина, і підпис у картці інший.
test('свідомо вимкнена машина не вважається незаповненою', () => {
  const r = computeTramlines({
    ...grain,
    machines: [sprayer(), { id: 'c', label: 'Комбайн', width: 9, active: false,
      axles: [{ trackWidth: 3, tyreWidth: 0.8 }] }],
  })
  assert.equal(r.machines.find((m) => m.id === 'c').reason, 'off')
  assert.equal(r.warnings.some((w) => w.includes('Комбайн')), false,
    'про свідомо вимкнену машину попереджати нема про що')
})

test('незаповнена машина не ламає навіть відмову', () => {
  // Головна машина не ділиться на сівалку — відповіді немає; попередження про
  // незаповнену другу машину мусить дожити до цієї відмови, бо часто саме
  // воно і є причиною.
  const r = computeTramlines({
    ...grain,
    machines: [sprayer({ width: 20, base: true }), { id: 'c', label: 'Комбайн', width: 0, axles: [] }],
  })
  assert.equal(r.ok, false)
  assert.ok(r.warnings.length >= 2)
  assert.ok(r.warnings.some((w) => w.includes('Комбайн')))
})

// Явний захват діяв і в рівномірному режимі: задав 2,4 м для своєї розкладки,
// повернувся до секцій із міжряддям — а захват лишився прилиплий.
test('явний захват діє лише для своєї розкладки сошників', () => {
  const even = drillGeometry({ rows: 24, rowSpacing: 0.15, drillWidth: 2.4 })
  assert.equal(even.width, 3.6, 'рівномірна сівалка — це секції × міжряддя, і нічого іншого')
  assert.equal(even.custom, false)

  const own = drillGeometry({ coulters: [0.2, 0.9, 1.6], drillWidth: 2.4 })
  assert.equal(own.width, 2.4, 'для своєї розкладки явний захват потрібен')
  assert.equal(own.custom, true)
})

test('одна позиція сошника — це ще не розкладка, а недописана розкладка', () => {
  const g = drillGeometry({ rows: 24, rowSpacing: 0.15, coulters: [1.5] })
  assert.equal(g.custom, false)
  assert.equal(g.rows, 24, 'поки позицій менше двох, працює рівномірна сівалка')
  assert.equal(g.width, 3.6)
})

// Недосіяна смуга — це міжряддя. Для своєї розкладки міжряддя з форми вже ні
// про що не каже, і площа рахувалася не з того числа.
test('ширина недосіяної смуги береться з розкладки, а не з форми', () => {
  const r = computeTramlines({
    coulters: [0.3, 0.6, 1.5, 1.8], drillWidth: 2.1, rowSpacing: 0.7, margin: 0.05,
    machines: [{ id: 's', label: 'Обприскувач', width: 4.2, base: true,
      axles: [{ trackWidth: 1.8, tyreWidth: 0.2 }] }],
  })
  assert.equal(r.custom, true)
  assert.equal(r.stripWidth, 0.3, 'найменший проміжок розкладки, а не 0,7 з форми')

  const even = computeTramlines({ ...grain, machines: [sprayer()] })
  assert.equal(even.custom, false)
  assert.equal(even.stripWidth, 0.15, 'у рівномірної — міжряддя')
})

test('втрачена площа рахується за шириною смуги цієї розкладки', () => {
  const input = {
    coulters: [0.3, 0.6, 1.5, 1.8], drillWidth: 2.1, rowSpacing: 0.7, margin: 0.05,
    machines: [{ id: 's', label: 'Обприскувач', width: 4.2, base: true,
      axles: [{ trackWidth: 1.8, tyreWidth: 0.2 }] }],
  }
  const r = computeTramlines(input)
  const p = fieldPlan(r, { fieldWidth: 420, fieldLength: 800, rowSpacing: input.rowSpacing })
  if (!p || p.tooSmall || !p.disabledRows) return
  const expected = Math.round((p.disabledRows * r.stripWidth * p.workLength) / 10000 * 1000) / 1000
  assert.equal(p.lostHa, expected, 'площа має йти від 0,3 м, а не від 0,7 м з форми')
})

// Прапорець «хочу цю машину» і «машина придатна» — різні речі, і список
// мусить повертати обидва.
test('нормалізація розрізняє «хочу» і «придатна»', () => {
  const list = normaliseMachines({
    machines: [
      { id: 'a', width: 18, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] },
      { id: 'b', width: 0, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] },
      { id: 'c', width: 9, active: false, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] },
    ],
  })
  const by = (id) => list.find((m) => m.id === id)
  assert.equal(by('a').wanted, true)
  assert.equal(by('a').active, true)
  assert.equal(by('b').wanted, true, 'людина її хотіла')
  assert.equal(by('b').active, false, 'але рахувати нічого')
  assert.equal(by('c').wanted, false)
  assert.equal(by('c').active, false)
})

// Захват, заданий рядком із форми, має читатися як число.
test('захват рядком з форми не робить машину непридатною', () => {
  const list = normaliseMachines({
    machines: [{ id: 'a', width: '18', axles: [{ trackWidth: '1.8', tyreWidth: '0.35' }] }],
  })
  assert.equal(list[0].active, true)
  assert.equal(list[0].width, 18)
  assert.equal(list[0].axles[0].trackWidth, 1.8)
})
