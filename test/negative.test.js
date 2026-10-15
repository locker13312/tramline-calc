// ── Сміття на вході ───────────────────────────────────────────────────────
//
// Форму заповнює людина в полі, з телефона, однією рукою. Поле стирається,
// кома ставиться замість точки, у «захват» потрапляє літера, збережений
// комплект приходить із чужої версії. Жоден із цих випадків не має права
// впасти, видати NaN або тихо показати неправду.
//
// Тому тут навмисно неправильні дані — усі, які я зміг придумати, — і одна
// вимога до кожного: або чесна відмова, або правильне число. Третього не буває.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTramlines, fieldPlan, suggestTracks, workingSets, rhythmOf, drillGeometry } from '../src/lib/tramline.js'
import { solutions } from '../src/lib/solutions.js'
import { economics } from '../src/lib/economics.js'
import { normaliseMachines } from '../src/lib/machines.js'

const ok = { rows: 24, rowSpacing: 0.15, margin: 0.05 }
const spr = { id: 's', label: 'Обприскувач', width: 18, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] }

// Перевіряє все, що може бути числом, на справжність: NaN і Infinity в
// розмітці виглядають як поломка, бо поломкою і є.
function finite(v, where, seen = new Set()) {
  if (typeof v === 'number') {
    assert.ok(Number.isFinite(v), `${where} = ${v}`)
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => finite(x, `${where}[${i}]`, seen))
  } else if (v && typeof v === 'object') {
    if (seen.has(v)) return
    seen.add(v)
    for (const [k, x] of Object.entries(v)) finite(x, `${where}.${k}`, seen)
  }
}

// Будь-який результат мусить або чесно відмовити, або бути цілісним.
function sane(r, where) {
  assert.ok(r && typeof r === 'object', `${where}: нема результату`)
  assert.equal(typeof r.ok, 'boolean', `${where}: ok не булеве`)
  const { base, ...rest } = r
  finite(rest, where)
  assert.ok(Array.isArray(r.warnings), `${where}: нема попереджень`)
  if (!r.ok) {
    assert.ok(r.warnings.length > 0, `${where}: відмова без причини`)
    return
  }
  assert.ok(r.rows >= 0, `${where}: сошників ${r.rows}`)
  assert.ok(r.cycle >= 1, `${where}: цикл ${r.cycle}`)
  assert.equal(r.passes.length, r.cycle, `${where}: проходів не стільки, скільки цикл`)
  for (const p of r.passes) {
    for (const m of p.disabled) {
      assert.ok(Number.isInteger(m) && m >= 1 && m <= r.rows,
        `${where}: сошник ${m} при ${r.rows} сошниках`)
    }
  }
  assert.ok(r.lossPct >= 0 && r.lossPct <= 100, `${where}: втрата ${r.lossPct} %`)
  assert.ok(r.disabledPerCycle <= r.rowsPerCycle, `${where}: глушимо більше, ніж є`)
}

// ── Сівалка ───────────────────────────────────────────────────────────────

const BAD_NUMBERS = [0, -1, -0.5, NaN, Infinity, -Infinity, null, undefined, '', 'абв', '1,5', {}, []]

test('жодне зіпсоване значення сівалки не валить розрахунок', () => {
  for (const bad of BAD_NUMBERS) {
    for (const field of ['rows', 'rowSpacing', 'margin', 'drillWidth']) {
      const r = computeTramlines({ ...ok, [field]: bad, machines: [spr] })
      sane(r, `${field} = ${JSON.stringify(bad)}`)
    }
  }
})

test('гігантська й мікроскопічна сівалка не ломають нічого', () => {
  for (const [rows, spacing] of [[1, 0.15], [2, 0.01], [1000, 0.15], [24, 100], [2, 1e-9]]) {
    const r = computeTramlines({ ...ok, rows, rowSpacing: spacing, machines: [spr] })
    sane(r, `сівалка ${rows} × ${spacing}`)
  }
})

test('розкладка сошників зі сміття зводиться до чогось осмисленого', () => {
  const cases = [
    ['літери', ['а', 'б', 'в']],
    ['NaN усередині', [0.3, NaN, 0.9]],
    ['мінус', [-1, 0.3, 0.9]],
    ['порожній масив', []],
    ['одне число', [0.5]],
    ['усі однакові', [0.5, 0.5, 0.5, 0.5]],
    ['не за порядком', [2.1, 0.3, 1.2, 0.9]],
    ['рядки', ['0.3', '0.9', '1.5']],
    ['null усередині', [0.3, null, 0.9]],
    ['об\'єкти', [{}, [], 0.9, 1.5]],
    ['не масив', 'нічого'],
    ['число', 5],
    ['величезна', Array.from({ length: 2000 }, (_, i) => i * 0.15)],
  ]
  for (const [name, coulters] of cases) {
    const g = drillGeometry({ ...ok, coulters })
    finite(g, `розкладка «${name}»`)
    assert.ok(g.width >= 0, `розкладка «${name}»: захват ${g.width}`)
    assert.ok(g.rows >= 0)
    const r = computeTramlines({ ...ok, coulters, machines: [spr] })
    sane(r, `розкладка «${name}»`)
  }
})

// ── Машини ────────────────────────────────────────────────────────────────

test('список машин зі сміття не валить розрахунок', () => {
  const cases = [
    ['не масив', 'обприскувач'],
    ['число', 7],
    ['порожній', []],
    ['null усередині', [null, spr]],
    ['undefined усередині', [undefined, spr]],
    ['рядок усередині', ['обприскувач', spr]],
    ['порожній об\'єкт', [{}]],
    ['без осей', [{ id: 'a', width: 18 }]],
    ['осі не масив', [{ id: 'a', width: 18, axles: 'широкі' }]],
    ['порожні осі', [{ id: 'a', width: 18, axles: [] }]],
    ['вісь без чисел', [{ id: 'a', width: 18, axles: [{}] }]],
    ['вісь із NaN', [{ id: 'a', width: 18, axles: [{ trackWidth: NaN, tyreWidth: NaN }] }]],
    ['вісь null', [{ id: 'a', width: 18, axles: [null] }]],
    ['мінусова база', [{ id: 'a', width: 18, axles: [{ trackWidth: -2, tyreWidth: -0.3 }] }]],
    ['шина ширша за базу', [{ id: 'a', width: 18, axles: [{ trackWidth: 0.3, tyreWidth: 3 }] }]],
    ['база ширша за захват', [{ id: 'a', width: 2, axles: [{ trackWidth: 9, tyreWidth: 0.3 }] }]],
    ['захват NaN', [{ id: 'a', width: NaN, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] }]],
    ['захват Infinity', [{ id: 'a', width: Infinity, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] }]],
    ['захват мінусовий', [{ id: 'a', width: -18, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] }]],
    ['захват рядком', [{ id: 'a', width: '18', axles: [{ trackWidth: '1.8', tyreWidth: '0.35' }] }]],
    ['однакові id', [{ ...spr, id: 'x' }, { ...spr, id: 'x', width: 9 }]],
    ['без id', [{ width: 18, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] }]],
    ['двадцять машин', Array.from({ length: 20 }, (_, i) => ({ ...spr, id: `m${i}`, width: 6 + i }))],
    ['двадцять осей', [{ id: 'a', width: 18, axles: Array.from({ length: 20 }, () => ({ trackWidth: 1.8, tyreWidth: 0.35 })) }]],
    ['усі вимкнені', [{ ...spr, active: false }]],
    ['усі базові', [{ ...spr, base: true }, { ...spr, id: 'b', width: 9, base: true }]],
    ['зсув NaN', [{ ...spr, phase: NaN }]],
    ['зсув мінусовий', [{ ...spr, phase: -5 }]],
    ['зсув більший за захват', [{ ...spr, phase: 999 }]],
    ['проходи NaN', [{ ...spr, passes: NaN }]],
    ['проходи мінусові', [{ ...spr, passes: -3 }]],
    ['запас мінусовий', [{ ...spr, margin: -1 }]],
    ['запас величезний', [{ ...spr, margin: 50 }]],
  ]
  for (const [name, machines] of cases) {
    let r
    assert.doesNotThrow(() => { r = computeTramlines({ ...ok, machines }) }, `машини «${name}» впали`)
    sane(r, `машини «${name}»`)
  }
})

test('нормалізація витримує сміття й завжди повертає масив', () => {
  for (const machines of ['abc', 7, null, undefined, [null], [undefined], [{}], [[]]]) {
    let list
    assert.doesNotThrow(() => { list = normaliseMachines({ machines, sprayerWidth: 18, trackWidth: 1.8, tyreWidth: 0.35 }) },
      `нормалізація впала на ${JSON.stringify(machines)}`)
    assert.ok(Array.isArray(list))
    for (const m of list) {
      assert.equal(typeof m.id, 'string')
      assert.ok(Array.isArray(m.axles))
      assert.equal(typeof m.active, 'boolean')
      finite({ width: m.width, margin: m.margin, axles: m.axles }, 'машина')
    }
  }
})

test('базова машина завжди одна або жодної', () => {
  for (const machines of [
    [{ ...spr, base: true }, { ...spr, id: 'b', base: true }],
    [{ ...spr, base: true, active: false }, { ...spr, id: 'b' }],
    [{ ...spr, base: 'так' }],
  ]) {
    const list = normaliseMachines({ machines })
    assert.ok(list.filter((m) => m.base).length <= 1)
  }
})

// ── Нахльост ──────────────────────────────────────────────────────────────

test('зіпсований нахльост не ломає розрахунок', () => {
  for (const overlapRows of [...BAD_NUMBERS, 0, 1, 23, 24, 1000, 2.7, -3]) {
    const r = computeTramlines({ ...ok, machines: [spr], overlapRows })
    sane(r, `нахльост ${JSON.stringify(overlapRows)}`)
    assert.ok(r.overlapRows >= 0 && r.overlapRows <= 22,
      `нахльост ${JSON.stringify(overlapRows)} дав ${r.overlapRows}`)
    if (r.ok) assert.ok(r.step > 0, `нахльост ${JSON.stringify(overlapRows)}: крок ${r.step}`)
  }
})

// ── Поле ──────────────────────────────────────────────────────────────────

test('зіпсовані розміри поля дають null або цілісний план', () => {
  const r = computeTramlines({ ...ok, machines: [spr] })
  const cases = []
  for (const bad of BAD_NUMBERS) {
    cases.push({ fieldWidth: bad, fieldLength: 800, rowSpacing: 0.15 })
    cases.push({ fieldWidth: 600, fieldLength: bad, rowSpacing: 0.15 })
    cases.push({ fieldWidth: 600, fieldLength: 800, headland: bad, rowSpacing: 0.15 })
    cases.push({ fieldWidth: 600, fieldLength: 800, rowSpacing: bad })
  }
  cases.push({ fieldWidth: 1, fieldLength: 1, rowSpacing: 0.15 })
  cases.push({ fieldWidth: 1e7, fieldLength: 1e7, rowSpacing: 0.15 })
  cases.push({ fieldWidth: 600, fieldLength: 800, headland: 300, rowSpacing: 0.15 })
  cases.push({ fieldWidth: 600, fieldLength: 800, headland: 1e6, rowSpacing: 0.15 })

  for (const plot of cases) {
    let p
    assert.doesNotThrow(() => { p = fieldPlan(r, plot) }, `поле ${JSON.stringify(plot)} впало`)
    if (p == null) continue
    finite({ ...p, passes: undefined, strips: undefined }, `поле ${JSON.stringify(plot)}`)
    // tooSmall і tooBig — дві чесні відмови, а не план: у них немає ні
    // проходів, ні площ, і питати з них цілісності плану нема сенсу.
    if (p.tooSmall || p.tooBig) continue
    assert.ok(p.passes.length > 0)
    assert.ok(p.lostHa >= 0 && p.lostHa <= p.workingHa + 1e-6,
      `поле ${JSON.stringify(plot)}: недосіяно ${p.lostHa} при робочій ${p.workingHa}`)
    assert.ok(p.lostPct >= 0 && p.lostPct <= 100)
    assert.ok(p.tramlines >= 0)
    for (const pass of p.passes) {
      finite({ from: pass.from, to: pass.to, width: pass.width }, 'прохід')
      assert.ok(pass.width >= 0)
    }
  }
})

test('план не будується без розрахунку', () => {
  const plot = { fieldWidth: 600, fieldLength: 800, rowSpacing: 0.15 }
  for (const bad of [null, undefined, {}, { ok: false }, { ok: true }]) {
    assert.doesNotThrow(() => fieldPlan(bad, plot), `fieldPlan впав на ${JSON.stringify(bad)}`)
  }
  assert.equal(fieldPlan(null, plot), null)
  assert.equal(fieldPlan({ ok: false }, plot), null)
})

// ── Гроші ─────────────────────────────────────────────────────────────────

test('зіпсовані гроші дають null або цілісний рахунок, але не мінус площі', () => {
  const r = computeTramlines({ ...ok, machines: [spr] })
  const p = fieldPlan(r, { fieldWidth: 600, fieldLength: 800, rowSpacing: 0.15 })
  for (const bad of BAD_NUMBERS) {
    for (const field of ['yieldPerHa', 'pricePerTon', 'passes', 'damagePct', 'tyreWidth']) {
      const money = { yieldPerHa: 6.5, pricePerTon: 8000, passes: 4, damagePct: 70, tyreWidth: 0.35, [field]: bad }
      let e
      assert.doesNotThrow(() => { e = economics(p, r, money) }, `гроші ${field}=${JSON.stringify(bad)} впали`)
      if (!e) continue
      finite(e, `гроші ${field}=${JSON.stringify(bad)}`)
      assert.ok(e.without.ha >= 0 && e.withTramlines.ha >= 0,
        `гроші ${field}=${JSON.stringify(bad)}: мінусова площа`)
      assert.ok(e.without.ha <= p.workingHa + 1e-6)
    }
  }
  assert.equal(economics(null, r, { yieldPerHa: 1, pricePerTon: 1, passes: 1 }), null)
  assert.equal(economics(p, null, { yieldPerHa: 1, pricePerTon: 1, passes: 1 }), null)
  assert.equal(economics(p, r, {}), null)
})

test('частка втрат поза межами 0–100 не виносить рахунок за поле', () => {
  const r = computeTramlines({ ...ok, machines: [spr] })
  const p = fieldPlan(r, { fieldWidth: 600, fieldLength: 800, rowSpacing: 0.15 })
  const base = { yieldPerHa: 6.5, pricePerTon: 8000, passes: 4, tyreWidth: 0.35 }
  const low = economics(p, r, { ...base, damagePct: -50 })
  const high = economics(p, r, { ...base, damagePct: 500 })
  assert.equal(low.without.ha, 0, 'мінусова частка — це нуль витоптаного, а не мінус')
  assert.ok(high.without.ha <= p.workingHa + 1e-6, 'більше за сто відсотків — це сто')
})

// ── Підбір колісної бази ──────────────────────────────────────────────────

test('підбір бази витримує сміття', () => {
  for (const input of [
    {}, { rows: 0, rowSpacing: 0 }, { ...ok, machines: [] },
    { ...ok, machines: 'abc' }, { ...ok, machines: [null] },
    { ...ok, machines: [{ id: 'a', width: 18, axles: [] }] },
    { ...ok, rowSpacing: NaN, machines: [spr] },
    { ...ok, coulters: [], machines: [spr] },
    { ...ok, machines: [{ ...spr, width: 0 }] },
  ]) {
    let a
    assert.doesNotThrow(() => { a = suggestTracks(input) }, `підбір впав на ${JSON.stringify(input)}`)
    if (!a) continue
    finite(a, `підбір ${JSON.stringify(input)}`)
    for (const m of a.machines ?? []) {
      for (const o of m.options ?? []) assert.ok(o.track > 0 && o.clearance > 0)
    }
  }
})

// ── Способи й робочі ширини ───────────────────────────────────────────────

test('пошук способів витримує сміття у кожному полі', () => {
  for (const bad of BAD_NUMBERS) {
    for (const field of ['rows', 'rowSpacing', 'fieldWidth', 'fieldLength', 'headland', 'overlapRows']) {
      const input = { ...ok, machines: [spr], [field]: bad }
      let list
      assert.doesNotThrow(
        () => { list = solutions(input, input) },
        `способи ${field}=${JSON.stringify(bad)} впали`,
      )
      assert.ok(Array.isArray(list))
      finite(list.map((s) => ({ ...s, why: null, start: null, finish: null, patch: null })),
        `способи ${field}=${JSON.stringify(bad)}`)
      for (const s of list) {
        assert.ok(s.baseWidth > 0 && s.step > 0, `спосіб без розмірів: ${s.id}`)
        assert.ok(s.why.length > 0, `спосіб без пояснення: ${s.id}`)
      }
    }
  }
})

test('набори робочих ширин не вигадують неможливого', () => {
  for (const bad of BAD_NUMBERS) {
    for (const field of ['rows', 'rowSpacing', 'drillWidth']) {
      const geo = drillGeometry({ rows: 24, rowSpacing: 0.15, [field]: bad })
      const list = workingSets({
        geo, machines: [{ id: 's', label: 'Обприскувач', width: 16, base: true }],
      })
      assert.ok(Array.isArray(list))
      finite(list, `набори ${field}=${JSON.stringify(bad)}`)
      for (const o of list) {
        assert.ok(o.step > 0 && o.rows >= 2 && o.off >= 0)
        for (const m of o.machines) assert.ok(m.width >= 0 && m.overlap >= 0)
      }
    }
    // І на зіпсованому захваті машини: набір або є, або його немає, але
    // ніколи не «ширина NaN».
    const list = workingSets({
      geo: drillGeometry({ rows: 24, rowSpacing: 0.15 }),
      machines: [{ id: 's', label: 'Обприскувач', width: bad, base: true }],
    })
    finite(list, `захват машини ${JSON.stringify(bad)}`)
  }
})

test('ритм пари захватів або число, або нічого', () => {
  for (const a of [0, -1, NaN, Infinity, null, undefined, 'абв', 18]) {
    for (const b of [0, -1, NaN, Infinity, null, undefined, 'абв', 3.6]) {
      const got = rhythmOf(a, b)
      if (got == null) continue
      assert.ok(Number.isInteger(got.rhythm) && got.rhythm >= 1, `ритм ${a}/${b} = ${got.rhythm}`)
    }
  }
})

// ── Повний ланцюг на сміттєвих даних ──────────────────────────────────────

test('повний прогін на зіпсованих даних не падає й не бреше', () => {
  const junk = [
    {},
    { rows: NaN, rowSpacing: NaN, machines: 'abc', fieldWidth: NaN, fieldLength: NaN },
    { rows: -5, rowSpacing: -1, margin: -1, machines: [null, undefined], fieldWidth: -600, fieldLength: -800, headland: -24 },
    { rows: 0, rowSpacing: 0, machines: [], fieldWidth: 0, fieldLength: 0, yieldPerHa: 0, pricePerTon: 0, passes: 0 },
    { rows: 1e6, rowSpacing: 1e6, machines: [{ ...spr, width: 1e6 }], fieldWidth: 1e6, fieldLength: 1e6 },
    { coulters: [NaN, NaN], drillWidth: NaN, machines: [{ ...spr, width: NaN }] },
    { rows: 24, rowSpacing: 0.15, machines: [{ id: 'a' }] },
  ]
  for (const input of junk) {
    let r, p, e, a
    assert.doesNotThrow(() => {
      r = computeTramlines(input)
      p = fieldPlan(r, input)
      a = suggestTracks(input)
      e = economics(p, r, input)
    }, `повний прогін впав на ${JSON.stringify(input)}`)
    sane(r, `прогін ${JSON.stringify(input)}`)
    if (p && !p.tooSmall) finite({ ...p, passes: undefined, strips: undefined }, 'план')
    if (e) finite(e, 'гроші')
    if (a) finite(a, 'підбір')
  }
})
