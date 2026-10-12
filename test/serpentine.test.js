// ── Хід човником ──────────────────────────────────────────────────────────
//
// Поле їдуть не в один бік: прохід туди, розворот на краю, прохід назад
// сусідньою смугою. На зворотному проході сівалка розвернена на 180°, і
// сошник, позначений на рамі першим, опиняється з протилежного боку поля.
//
// Смуги від цього не зсуваються — геометрія поля та сама. Міняється те, яким
// числом назвати ті самі секції в кабіні. Назвати їх по полю, коли машина
// розвернена, означає заглушити дзеркальні — тобто не нарізати колію зовсім,
// а лишити другу порожню смугу поруч.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTramlines, fieldPlan, mirrorRows } from '../src/lib/tramline.js'

const grain = { rows: 24, rowSpacing: 0.15, margin: 0.05 }
const sprayer = {
  id: 's', label: 'Обприскувач', kind: 'sprayer', width: 18,
  axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }],
}
const field = { fieldWidth: 300, fieldLength: 800, rowSpacing: 0.15, headland: 0 }

const plan = (extra = {}) =>
  fieldPlan(computeTramlines({ ...grain, machines: [sprayer] }), { ...field, ...extra })

test('дзеркало рахує від іншого борту й лишає список упорядкованим', () => {
  assert.deepEqual(mirrorRows([5, 8], 24), [17, 20])
  assert.deepEqual(mirrorRows([1], 24), [24])
  assert.deepEqual(mirrorRows([24], 24), [1])
  assert.deepEqual(mirrorRows([], 24), [])
  // Дзеркало від дзеркала — те саме, з чого почали.
  assert.deepEqual(mirrorRows(mirrorRows([3, 9, 14], 24), 24), [3, 9, 14])
})

test('без човника номери в кабіні ті самі, що по полю', () => {
  const p = plan()
  assert.equal(p.serpentine, false)
  for (const pass of p.passes) {
    assert.equal(pass.back, false)
    assert.deepEqual(pass.cab.disabled, pass.disabled)
    assert.deepEqual(pass.cab.sowing, pass.sowing)
    assert.deepEqual(pass.cab.outside, pass.outside)
  }
})

test('з човником назад їдуть парні проходи, і тільки вони перераховані', () => {
  const p = plan({ serpentine: true })
  assert.equal(p.serpentine, true)

  for (const pass of p.passes) {
    assert.equal(pass.back, pass.i % 2 === 0, `прохід ${pass.i}`)
    const expect = pass.back ? mirrorRows(pass.disabled, grain.rows) : pass.disabled
    assert.deepEqual(pass.cab.disabled, expect, `прохід ${pass.i}`)
  }
})

test('човник не рухає жодної смуги: міняються лише номери', () => {
  const straight = plan()
  const snake = plan({ serpentine: true })

  assert.deepEqual(snake.strips, straight.strips)
  assert.equal(snake.disabledRows, straight.disabledRows)
  assert.equal(snake.lostHa, straight.lostHa)
  assert.equal(snake.tramlines, straight.tramlines)
  assert.deepEqual(
    snake.passes.map((p) => p.disabled),
    straight.passes.map((p) => p.disabled),
  )
})

test('на зворотному проході номер із кабіни відповідає тій самій смузі поля', () => {
  const p = plan({ serpentine: true })
  const back = p.passes.find((pass) => pass.back && pass.tramline)
  assert.ok(back, 'мав бути зворотний прохід із колією')

  // Секція n з кабіни — це секція (rows + 1 − n) по полю. Беремо номери з
  // кабіни, повертаємо їх назад у поле й вимагаємо збігу зі списком поля:
  // саме ця рівність і є обіцянкою, яку дає перерахунок.
  assert.deepEqual(mirrorRows(back.cab.disabled, grain.rows), back.disabled)
})

test('кількість вимкнених не залежить від напрямку проходу', () => {
  const p = plan({ serpentine: true })
  for (const pass of p.passes) {
    assert.equal(pass.cab.disabled.length, pass.disabled.length)
    assert.equal(pass.cab.sowing.length, pass.sowing.length)
  }
})

test('порожнє поле не ламається від човника', () => {
  const p = fieldPlan(computeTramlines({ ...grain, machines: [sprayer] }), {
    ...field, fieldWidth: 0, serpentine: true,
  })
  // Поля немає — немає й плану: порожнеча тут чесніша за нуль проходів.
  assert.ok(p === null || p.tooSmall || !p.passes?.length)
})
