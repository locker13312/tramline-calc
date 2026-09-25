import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTramlines, suggestions } from '../src/lib/tramline.js'

const cereal = {
  rows: 24, rowSpacing: 0.15, sprayerWidth: 18,
  trackWidth: 1.8, tyreWidth: 0.35, margin: 0.05,
}

test('непарний коефіцієнт — уся колія на одному проході', () => {
  const r = computeTramlines(cereal)
  assert.equal(r.ok, true)
  assert.equal(r.ratio, 5)
  assert.equal(r.parity, 'odd')
  const hit = r.passes.filter((p) => p.disabled.length)
  assert.equal(hit.length, 1, 'колія має лягти в один прохід')
  assert.equal(hit[0].n, 3, 'у середній прохід циклу')
  assert.deepEqual(hit[0].disabled, [5, 6, 7, 8, 17, 18, 19, 20])
})

test('вимкнені секції симетричні відносно центра сівалки', () => {
  const r = computeTramlines(cereal)
  const off = r.passes.find((p) => p.disabled.length).disabled
  const mirrored = off.map((m) => cereal.rows + 1 - m).sort((a, b) => a - b)
  assert.deepEqual(mirrored, off)
})

test('парний коефіцієнт розриває колію на два сусідні проходи', () => {
  const r = computeTramlines({ ...cereal, sprayerWidth: 14.4 })
  assert.equal(r.ratio, 4)
  const hit = r.passes.filter((p) => p.disabled.length)
  assert.equal(hit.length, 2)
  assert.deepEqual(hit.map((p) => p.n), [2, 3], 'сусідні проходи')
  assert.ok(r.warnings.some((w) => w.includes('половинний')))
})

test('половинний перший прохід збирає парну колію в один прохід', () => {
  const r = computeTramlines({ ...cereal, sprayerWidth: 14.4, halfStart: true })
  const hit = r.passes.filter((p) => p.disabled.length)
  assert.equal(hit.length, 1)
  assert.equal(hit[0].disabled.length, 8, 'обидві смуги в одному проході')
  assert.equal(r.passes[0].partial, true)
  assert.ok(r.passes[0].sowingRows.length < cereal.rows)
})

// Соняшник, 12 секцій по 70 см. Центр проходу сівалки припадає на стик
// рядків, тому парна кількість міжрядь у колії (2.8 = 4 × 0.7) виводить
// колесо рівно в міжряддя, а непарна (2.1 = 3 × 0.7) — рівно на рядок.
// Різниця в 70 см колії вирішує, губити врожай чи ні.
test('колія, кратна парному числу міжрядь — колесо йде між рядками', () => {
  const r = computeTramlines({
    rows: 12, rowSpacing: 0.7, sprayerWidth: 25.2,
    trackWidth: 2.8, tyreWidth: 0.3, margin: 0.02,
  })
  assert.equal(r.ok, true)
  assert.equal(r.disabledPerCycle, 0)
  assert.equal(r.lossPct, 0)
  const gaps = r.passes.flatMap((p) => p.clearances)
  assert.ok(gaps.length > 0, 'має бути порахований просвіт до рядка')
  assert.ok(gaps.every((g) => g.gap > 0))
})

test('колія, кратна непарному числу міжрядь — колесо стає на рядок', () => {
  const r = computeTramlines({
    rows: 12, rowSpacing: 0.7, sprayerWidth: 25.2,
    trackWidth: 2.1, tyreWidth: 0.3, margin: 0.02,
  })
  const hit = r.passes.filter((p) => p.disabled.length)
  assert.equal(hit.length, 1)
  assert.deepEqual(hit[0].disabled, [5, 8], 'рядки під колесами доведеться вимкнути')
})

test('некратний захват — колія неможлива, і видно чим це лікувати', () => {
  const r = computeTramlines({ ...cereal, sprayerWidth: 20 })
  assert.equal(r.ok, false)
  assert.ok(r.warnings[0].includes('не ділиться'))
  assert.ok(r.suggestions.sprayerWidths.some((o) => o.width === 18))
})

test('втрата площі рахується від усіх рядків циклу', () => {
  const r = computeTramlines(cereal)
  assert.equal(r.rowsPerCycle, 24 * 5)
  assert.equal(r.lossPct, Math.round((8 / 120) * 100 * 1000) / 1000)
})

test('підказки не повторюють поточну ширину', () => {
  const s = suggestions({ rows: 24, rowSpacing: 0.15, sprayerWidth: 18 })
  assert.ok(!s.sprayerWidths.some((o) => Math.abs(o.width - 18) < 0.01))
})

// ── Усе поле ──────────────────────────────────────────────────────────────

import { fieldPlan } from '../src/lib/tramline.js'

const plot = { fieldWidth: 600, fieldLength: 800, rowSpacing: 0.15 }

// Ширини проходів округлені до міліметра кожна окремо, тож їхня сума гуляє
// в останньому знаку. Для геометрії поля міліметр не має значення.
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, msg + ` (${a} проти ${b})`)

test('поле розкладається на проходи сівалки, останній — неповний', () => {
  const r = computeTramlines(cereal)              // захват сівалки 3,6 м
  const p = fieldPlan(r, plot)
  assert.equal(p.passes.length, Math.ceil(600 / 3.6))
  assert.equal(p.passes[0].from, 0)
  assert.equal(p.passes.at(-1).to, 600, 'останній прохід обрізаний краєм поля')
  assert.ok(p.passes.at(-1).width < 3.6)
  close(p.passes.reduce((a, x) => a + x.width, 0), 600, 'проходи вкривають поле рівно раз')
})

test('колії не виходять за межі поля', () => {
  const p = fieldPlan(computeTramlines(cereal), plot)
  assert.ok(p.strips.length > 0)
  assert.ok(p.strips.every((s) => s.centre >= 0 && s.centre <= 600))
  assert.equal(p.tramlines, p.strips.length / 2, 'кожна колія — пара слідів')
})

test('неповний останній прохід обприскувача видно окремо', () => {
  const p = fieldPlan(computeTramlines(cereal), plot)   // 600 / 18 = 33.33
  assert.equal(p.sprayerPasses, 34)
  assert.ok(p.lastSprayerPass > 0 && p.lastSprayerPass < 18)
})

test('втрачена площа рахується по рядках цього поля, а не відсотком циклу', () => {
  const r = computeTramlines(cereal)
  const p = fieldPlan(r, plot)
  assert.equal(p.areaHa, 48)
  // 8 вимкнених рядків на цикл × 0.15 м × 800 м довжини на кожен
  assert.equal(p.lostHa, Math.round((p.disabledRows * 0.15 * 800) / 10000 * 1000) / 1000)
  assert.ok(p.lostPct > 0 && p.lostPct < 10)
})

test('довжина колій — це всі сліди на всю довжину поля', () => {
  const p = fieldPlan(computeTramlines(cereal), plot)
  assert.equal(p.tramlineKm, (p.strips.length * 800) / 1000)
})

test('половинний прохід зсуває сітку проходів по всьому полю', () => {
  const p = fieldPlan(computeTramlines({ ...cereal, halfStart: true }), plot)
  assert.equal(p.passes[0].width, 1.8, 'перший прохід — половина захвату')
  close(p.passes.reduce((a, x) => a + x.width, 0), 600, 'проходи вкривають поле')
})

test('без розмірів поля плану немає', () => {
  assert.equal(fieldPlan(computeTramlines(cereal), { ...plot, fieldWidth: 0 }), null)
  assert.equal(fieldPlan({ ok: false }, plot), null)
})
