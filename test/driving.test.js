import { test } from 'node:test'
import assert from 'node:assert/strict'
import { machineRoutes } from '../src/lib/driving.js'
import { computeTramlines, fieldPlan } from '../src/lib/tramline.js'

// ── Маршрути на карті ─────────────────────────────────────────────────────
//
// Поле їдуть човником: прохід туди, розворот за межею поля, прохід назад
// сусідньою смугою. Карта мусить показувати саме ті проходи, які рахує
// список, і машини — точно по коліях, а не намальовані поруч.

const grain = {
  rows: 24, rowSpacing: 0.15, margin: 0.05,
  machines: [{
    id: 's', label: 'Обприскувач', width: 18, base: true, active: true,
    axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }],
  }],
}
const field = { fieldWidth: 60, fieldLength: 800, rowSpacing: 0.15, serpentine: true }

test('сівалка на карті проїжджає кожну смугу раз, від краю, туди й назад', () => {
  const r = computeTramlines(grain)
  const p = fieldPlan(r, field)
  const routes = machineRoutes(p, r)
  assert.equal(routes.drill.passes.length, p.passes.length)
  assert.deepEqual(routes.drill.passes.map((x) => x.pass.i), p.passes.map((x) => x.i))
  routes.drill.passes.forEach((x, i) => {
    assert.equal(x.up, i % 2 === 0, 'кожен наступний прохід — після розвороту')
    // Зворотний прохід на карті — той самий, що в списку названий «назад».
    assert.equal(x.pass.back, !x.up)
  })
})

test('на зворотному проході номери сошників дзеркальні — як їх видно з кабіни', () => {
  const r = computeTramlines(grain)
  const p = fieldPlan(r, field)
  for (const pass of p.passes) {
    if (pass.back) {
      assert.deepEqual(pass.cab.disabled, pass.disabled.map((m) => 25 - m).sort((a, b) => a - b))
    } else {
      assert.deepEqual(pass.cab.disabled, pass.disabled)
    }
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
