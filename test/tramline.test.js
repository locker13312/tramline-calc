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

// ── Розворотні смуги ──────────────────────────────────────────────────────

test('обсів забирає площу з-під колії, а не додає її', () => {
  const r = computeTramlines(cereal)
  const plain = fieldPlan(r, plot)
  const withHead = fieldPlan(r, { ...plot, headland: 24 })   // 24 м ≈ два заходи

  close(withHead.workWidth, 600 - 48, 'робоча ширина')
  close(withHead.workLength, 800 - 48, 'робоча довжина')
  assert.ok(withHead.tramlines < plain.tramlines, 'колій має стати менше')
  assert.ok(withHead.lostHa < plain.lostHa, 'недосіяної площі теж менше')
  assert.equal(withHead.areaHa, plain.areaHa, 'площа самого поля не змінюється')
  assert.ok(withHead.headlandHa > 0)
  close(withHead.workingHa + withHead.headlandHa, withHead.areaHa, 'обсів + робоча = поле')
})

test('колії не залазять в обсів', () => {
  const p = fieldPlan(computeTramlines(cereal), { ...plot, headland: 24 })
  assert.ok(p.strips.every(s => s.centre >= 24 && s.centre <= 600 - 24))
  assert.ok(p.passes.every(x => x.from >= 24 - 0.001 && x.to <= 600 - 24 + 0.001))
})

test('обсів ширший за поле — плану немає, а не мінусова площа', () => {
  const p = fieldPlan(computeTramlines(cereal), { ...plot, headland: 320 })
  assert.equal(p.tooSmall, true)
})

// ── Підбір колії ──────────────────────────────────────────────────────────

import { suggestTracks, secondMachine } from '../src/lib/tramline.js'

test('на 70 см підказує колію, кратну парному числу міжрядь', () => {
  const s = suggestTracks({
    rows: 12, rowSpacing: 0.7, sprayerWidth: 25.2,
    tyreWidth: 0.32, margin: 0.1, trackWidth: 2.1,
  })
  assert.equal(s.possible, true)
  assert.equal(s.current, null, '2,1 м не проходить — саме тому й підбираємо')
  const tracks = s.options.map(o => o.track)
  assert.ok(tracks.includes(2.8), `серед варіантів має бути 2,8: ${tracks}`)
  assert.ok(s.options.every(o => o.clearance > 0))
})

test('добру колію програма визнає доброю, а не пропонує міняти', () => {
  const s = suggestTracks({
    rows: 12, rowSpacing: 0.7, sprayerWidth: 25.2,
    tyreWidth: 0.32, margin: 0.1, trackWidth: 2.8,
  })
  assert.ok(s.current, 'поточна колія має знайтись серед робочих')
  assert.ok(s.current.clearance > 0.1)
})

test('на вузькому міжрядді чесно каже, що підбирати нічого', () => {
  const s = suggestTracks({
    rows: 24, rowSpacing: 0.15, sprayerWidth: 18,
    tyreWidth: 0.35, margin: 0.05, trackWidth: 1.8,
  })
  assert.equal(s.possible, false)
  assert.ok(s.need > 0.15, 'видно, скільки міжряддя для цього треба')
  assert.deepEqual(s.options, [])
})

// ── Друга машина ──────────────────────────────────────────────────────────

test('кратний розкидач іде кожною n-ю колією', () => {
  const m = secondMachine({ sprayerWidth: 18, spreaderWidth: 36, rows: 24, rowSpacing: 0.15 })
  assert.equal(m.ok, true)
  assert.equal(m.every, 2)
})

test('некратний розкидач — видно, що поміняти з обох боків', () => {
  const m = secondMachine({ sprayerWidth: 25.2, spreaderWidth: 36, rows: 12, rowSpacing: 0.7 })
  assert.equal(m.ok, false)
  // Тут жоден захват обприскувача не влаштовує обидві машини, тому лишається
  // єдиний вихід — розкидач, кратний обприскувачу.
  assert.ok(m.spreaderOptions.some(o => o.width === 25.2 * 2))
})

test('розкидач, кратний сівалці, дає готове рішення', () => {
  const m = secondMachine({ sprayerWidth: 20, spreaderWidth: 33.6, rows: 12, rowSpacing: 0.7 })
  assert.equal(m.ok, false)
  assert.ok(m.fixes.some(f => f.sprayerWidth === 16.8 && f.every === 2),
    `серед виправлень має бути захват 16,8: ${JSON.stringify(m.fixes)}`)
})

// ── Економіка ─────────────────────────────────────────────────────────────

import { economics } from '../src/lib/economics.js'

const money = { yieldPerHa: 3, pricePerTon: 18000, passes: 4, damagePct: 70, tyreWidth: 0.35 }

test('колія коштує менше, ніж витоптування за сезон', () => {
  const r = computeTramlines(cereal)
  const p = fieldPlan(r, plot)
  const e = economics(p, r, money)
  assert.ok(e.withTramlines.uah > 0)
  assert.ok(e.without.uah > e.withTramlines.uah, 'інакше колію не було б сенсу різати')
  assert.equal(e.saving, e.without.uah - e.withTramlines.uah)
})

test('що більше обробок, то вигідніша колія', () => {
  const r = computeTramlines(cereal)
  const p = fieldPlan(r, plot)
  const one = economics(p, r, { ...money, passes: 1 })
  const six = economics(p, r, { ...money, passes: 6 })
  assert.equal(one.withTramlines.uah, six.withTramlines.uah, 'колія — разова витрата')
  assert.ok(six.without.uah > one.without.uah)
  assert.ok(six.saving > one.saving)
})

test('витоптане не може перевищити саме поле', () => {
  const r = computeTramlines(cereal)
  const p = fieldPlan(r, plot)
  const e = economics(p, r, { ...money, passes: 500 })
  assert.ok(e.without.ha <= p.workingHa)
})

test('без цін економіки немає — і вона про це мовчить, а не вигадує', () => {
  const r = computeTramlines(cereal)
  const p = fieldPlan(r, plot)
  assert.equal(economics(p, r, { ...money, pricePerTon: 0 }), null)
  assert.equal(economics(null, r, money), null)
})
