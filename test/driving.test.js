import { test } from 'node:test'
import assert from 'node:assert/strict'
import { passOrder, headlandFor, DRIVE_MODES } from '../src/lib/driving.js'
import { computeTramlines, fieldPlan } from '../src/lib/tramline.js'

// ── Порядок заїздів ───────────────────────────────────────────────────────
//
// Головне, що тут не має права зламатися: кожна смуга поля проїжджається
// рівно один раз. Пропустити смугу означає лишити поле недосіяним, проїхати
// двічі — засіяти його двічі, і те й те програма мусила б помітити.

test('кожен спосіб руху проїжджає кожну смугу рівно раз', () => {
  for (const mode of DRIVE_MODES.map((m) => m.key)) {
    for (const n of [1, 2, 3, 7, 8, 15, 40]) {
      for (const land of [0, 2, 4, 6]) {
        const order = passOrder(n, { mode, land })
        assert.equal(order.length, n, `${mode}/${land}: ${order.length} заїздів на ${n} смуг`)
        assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i),
          `${mode}/${land}: смуги проїхані не по разу`)
      }
    }
  }
})

test('підряд — це просто від краю до краю', () => {
  assert.deepEqual(passOrder(5, { mode: 'row' }), [0, 1, 2, 3, 4])
})

test('через одну — туди кожною другою, назад пропущеними', () => {
  // Доїхав до краю кожною другою смугою й повертаєшся, закриваючи пропуски.
  assert.deepEqual(passOrder(7, { mode: 'skip' }), [0, 2, 4, 6, 5, 3, 1])
  assert.deepEqual(passOrder(6, { mode: 'skip' }), [0, 2, 4, 5, 3, 1])
})

test('загінками — те саме, але всередині кожної загінки', () => {
  assert.deepEqual(passOrder(8, { mode: 'lands', land: 4 }), [0, 2, 3, 1, 4, 6, 7, 5])
  // Остання загінка буває неповною — це не привід пропустити смугу.
  assert.deepEqual(passOrder(7, { mode: 'lands', land: 4 }), [0, 2, 3, 1, 4, 6, 5])
})

test('сміття замість способу руху — це рух підряд, а не падіння', () => {
  for (const mode of [null, undefined, 'абв', 7, {}]) {
    assert.deepEqual(passOrder(4, { mode }), [0, 1, 2, 3])
  }
  assert.deepEqual(passOrder(0, { mode: 'skip' }), [])
  assert.deepEqual(passOrder(-5, { mode: 'skip' }), [])
})

// ── Порядок і напрямок разом ──────────────────────────────────────────────

const grain = {
  rows: 24, rowSpacing: 0.15, margin: 0.05,
  machines: [{
    id: 's', label: 'Обприскувач', width: 18, base: true, active: true,
    axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }],
  }],
}
const field = { fieldWidth: 60, fieldLength: 800, rowSpacing: 0.15, headland: 0 }

test('напрямок береться з номера заїзду, а не з місця смуги', () => {
  const r = computeTramlines(grain)
  const p = fieldPlan(r, { ...field, serpentine: true, drive: 'skip' })

  // Другий заїзд — це третя смуга поля, і сівалка на ній розвернена.
  const second = p.passes.find((x) => x.entry === 2)
  assert.equal(second.i, 3, 'через одну другий заїзд — третя смуга')
  assert.equal(second.back, true, 'на другому заїзді сівалка розвернена')

  // А третя смуга при русі підряд — це третій заїзд, і сівалка на ній
  // розвернена не буде.
  const row = fieldPlan(r, { ...field, serpentine: true, drive: 'row' })
  const third = row.passes.find((x) => x.i === 3)
  assert.equal(third.entry, 3)
  assert.equal(third.back, false)
})

test('номери в кабіні дзеркаляться рівно на зворотних заїздах', () => {
  const r = computeTramlines(grain)
  for (const drive of ['row', 'skip', 'lands']) {
    const p = fieldPlan(r, { ...field, serpentine: true, drive, land: 4 })
    for (const pass of p.passes) {
      assert.equal(pass.back, pass.entry % 2 === 0, `${drive}, заїзд ${pass.entry}`)
      if (pass.back) {
        assert.deepEqual(pass.cab.disabled, pass.disabled.map((m) => 25 - m).sort((a, b) => a - b))
      } else {
        assert.deepEqual(pass.cab.disabled, pass.disabled)
      }
    }
  }
})

test('порядок руху не чіпає геометрії — ті самі смуги й та сама втрата', () => {
  const r = computeTramlines(grain)
  const plain = fieldPlan(r, { ...field, drive: 'row' })
  for (const drive of ['skip', 'lands']) {
    const other = fieldPlan(r, { ...field, drive, land: 4 })
    assert.equal(other.passes.length, plain.passes.length)
    assert.equal(other.lostHa, plain.lostHa, `${drive}: інша втрачена площа`)
    assert.deepEqual(
      other.passes.map((x) => [x.i, x.from, x.disabled.join(',')]),
      plain.passes.map((x) => [x.i, x.from, x.disabled.join(',')]),
      `${drive}: смуги зсунулися`,
    )
  }
})

test('кожен заїзд має свій номер, і їх рівно стільки, скільки смуг', () => {
  const r = computeTramlines(grain)
  const p = fieldPlan(r, { ...field, drive: 'lands', land: 6 })
  const entries = p.passes.map((x) => x.entry).sort((a, b) => a - b)
  assert.deepEqual(entries, p.passes.map((_, i) => i + 1))
})

// ── Поворотна смуга ───────────────────────────────────────────────────────

test('обсів рахується проходами сівалки, а не на око', () => {
  // Правило з підручника: під петльовий розворот односівалкового агрегату —
  // чотири робочі проходи, під безпетльовий — три; багатосівалковому на
  // прохід менше.
  assert.deepEqual(headlandFor({ step: 3.6, turn: 'loop' }), {
    passes: 4, width: 14.4, turn: 'loop', label: 'З петлею (грушоподібний)',
  })
  assert.equal(headlandFor({ step: 3.6, turn: 'free' }).width, 10.8)
  assert.equal(headlandFor({ step: 3.6, turn: 'loop', wide: true }).width, 10.8)
  assert.equal(headlandFor({ step: 3.15, turn: 'loop' }).width, 12.6)

  // Обсів завжди цілим числом проходів: інакше остання смуга ляже не там.
  for (const step of [3.6, 3.15, 2.85, 7.7]) {
    const h = headlandFor({ step, turn: 'loop' })
    assert.ok(Math.abs(h.width / step - h.passes) < 1e-9)
  }
})

test('без кроку сівалки обсіву не порахувати — і це сказано, а не вигадано', () => {
  for (const bad of [0, -1, NaN, Infinity, null, undefined, 'абв']) {
    assert.equal(headlandFor({ step: bad }), null)
  }
})

// ── Маршрути на карті ─────────────────────────────────────────────────────

import { machineRoutes } from '../src/lib/driving.js'

test('сівалка на карті проїжджає кожну смугу раз і в порядку заїздів', () => {
  const r = computeTramlines(grain)
  for (const drive of ['row', 'skip', 'lands']) {
    const p = fieldPlan(r, { ...field, drive, land: 4 })
    const routes = machineRoutes(p, r)
    assert.equal(routes.drill.passes.length, p.passes.length)
    assert.deepEqual(routes.drill.passes.map((x) => x.pass.entry), p.passes.map((_, i) => i + 1))
    // Напрям чергується: кожен наступний заїзд — після розвороту.
    routes.drill.passes.forEach((x, i) => assert.equal(x.up, i % 2 === 0))
  }
})

test('машина на карті їде точно посередині своїх колій', () => {
  const r = computeTramlines(grain)
  const p = fieldPlan(r, field)
  const routes = machineRoutes(p, r)
  const s = routes.machines.find((m) => m.id === 's')
  assert.ok(s.passes.length > 0)
  // Кожне колесо обприскувача мусить стояти в нарізаній смузі поля.
  const strips = p.strips.filter((x) => x.machine === 's')
  for (const pass of s.passes) {
    for (const wheel of [pass.x - 0.9, pass.x + 0.9]) {
      if (wheel < 0.2 || wheel > field.fieldWidth - 0.2) continue
      assert.ok(strips.some((x) => wheel >= x.from - 1e-6 && wheel <= x.to + 1e-6),
        `колесо на ${wheel} м не в смузі`)
    }
  }
})

test('без плану маршрутів немає — і без падіння', () => {
  assert.equal(machineRoutes(null, null), null)
  assert.equal(machineRoutes({ passes: [] }, { ok: true }), null)
})
