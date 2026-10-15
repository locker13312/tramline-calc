// ── Інваріанти на випадкових наборах ──────────────────────────────────────
//
// Окремі тести перевіряють випадки, які ми вміли придумати. Цей — ті, яких не
// придумали: тисяча випадкових парків, сівалок і полів, і на кожному має
// триматися те, що тримається завжди, незалежно від чисел.
//
// Саме так знаходяться помилки на межах: захват, що майже кратний; колія,
// ширша за прохід; поле, вужче за один прохід; сошник точно на краю смуги.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTramlines, fieldPlan, suggestTracks } from '../src/lib/tramline.js'
import { economics } from '../src/lib/economics.js'

// Простий детермінований генератор: та сама послідовність на кожному запуску,
// тож упалий тест можна відтворити, а не ловити раз на десять прогонів.
function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

const SPACINGS = [0.125, 0.15, 0.19, 0.25, 0.45, 0.7, 0.75]
const WIDTHS = [4.2, 6, 7.6, 8.4, 9, 10.7, 12, 14.4, 15, 16, 18, 21, 24, 25.2, 27, 28, 32, 36]
const KINDS = ['sprayer', 'combine', 'cart', 'spreader', 'tractor']

function sample(seed) {
  const r = rng(seed)
  const pick = (list) => list[Math.floor(r() * list.length)]
  const rows = 4 + Math.floor(r() * 44)
  const rowSpacing = pick(SPACINGS)
  const count = 1 + Math.floor(r() * 4)
  const machines = Array.from({ length: count }, (_, i) => {
    const axleCount = r() < 0.25 ? 2 : 1
    return {
      id: `m${i}`,
      kind: pick(KINDS),
      label: `Машина ${i + 1}`,
      width: pick(WIDTHS),
      axles: Array.from({ length: axleCount }, () => ({
        trackWidth: 1.2 + Math.round(r() * 48) / 20,
        tyreWidth: 0.2 + Math.round(r() * 12) / 20,
      })),
      passes: 1 + Math.floor(r() * 5),
      active: r() < 0.9,
      base: false,
    }
  })
  return {
    rows, rowSpacing, machines,
    margin: Math.round(r() * 4) / 20,
    halfStart: r() < 0.3,
    overlapRows: r() < 0.35 ? 1 + Math.floor(r() * 4) : 0,
    fieldWidth: 50 + Math.floor(r() * 1200),
    fieldLength: 50 + Math.floor(r() * 1600),
    headland: Math.floor(r() * 40),
    yieldPerHa: Math.round(r() * 100) / 10,
    pricePerTon: Math.round(r() * 20000),
    passes: Math.floor(r() * 8),
    damagePct: Math.floor(r() * 100),
  }
}

const finite = (v, where) => {
  if (typeof v === 'number') {
    assert.ok(Number.isFinite(v), `${where}: ${v}`)
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => finite(x, `${where}[${i}]`))
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) finite(x, `${where}.${k}`)
  }
}

const N = 1200

test('жоден набір не валить розрахунок і не дає NaN', () => {
  for (let seed = 1; seed <= N; seed++) {
    const input = sample(seed)
    let r
    try {
      r = computeTramlines(input)
    } catch (e) {
      assert.fail(`набір ${seed} зламав розрахунок: ${e.message}`)
    }
    // base — посилання на машину з вхідних даних, його не перевіряємо.
    const { base, ...rest } = r
    finite(rest, `набір ${seed}`)
  }
})

test('вимкнені сошники завжди в межах наявних, без повторів і за порядком', () => {
  for (let seed = 1; seed <= N; seed++) {
    const input = sample(seed)
    const r = computeTramlines(input)
    if (!r.ok) continue
    for (const p of r.passes) {
      assert.deepEqual(p.disabled, [...new Set(p.disabled)], `набір ${seed}: повтори`)
      assert.deepEqual(p.disabled, [...p.disabled].sort((a, b) => a - b), `набір ${seed}: не за порядком`)
      for (const m of p.disabled) {
        assert.ok(m >= 1 && m <= r.rows, `набір ${seed}: сошник ${m} із ${r.rows}`)
      }
    }
    assert.ok(r.disabledPerCycle <= r.rowsPerCycle, `набір ${seed}: глушимо більше, ніж є`)
    assert.ok(r.lossPct >= 0 && r.lossPct <= 100, `набір ${seed}: втрата ${r.lossPct} %`)
  }
})

test('кожен підпис «через кого» збігається зі списком вимкнених', () => {
  for (let seed = 1; seed <= N; seed++) {
    const r = computeTramlines(sample(seed))
    if (!r.ok) continue
    for (const p of r.passes) {
      const named = [...new Set(p.reasons.flatMap((x) => x.rows))].sort((a, b) => a - b)
      assert.deepEqual(named, p.disabled, `набір ${seed}, прохід ${p.n}`)
    }
  }
})

// Головний інваріант усієї моделі: колія — об'єднання смуг, тож прибрати
// машину не може додати вимкнених сошників.
//
// Перевіряти це можна лише за закріпленої базової машини й заданих відступів.
// Інакше порівнюються два різні візерунки: прибрали машину — програма
// перебрала крок колій і відступи заново, сітка легла в інше місце, і більше
// вимкнених сошників там цілком законне. Саме тому базова машина тут
// закріплена, а відступи зафіксовані числом.
test('машина не може зменшити кількість вимкнених сошників', () => {
  let checked = 0
  for (let seed = 1; seed <= N; seed++) {
    const input = sample(seed)
    const live = input.machines.filter((m) => m.active)
    if (live.length < 2) continue
    // Закріплюємо найвужчу базовою й знімаємо з програми свободу вибору.
    const lead = live.slice().sort((a, b) => a.width - b.width)[0]
    const pin = (machines) => machines.map((m) => ({
      ...m, base: m.id === lead.id, phase: m.id === lead.id ? 0 : (m.width % 1) / 2,
    }))
    const full = computeTramlines({ ...input, machines: pin(input.machines) })
    if (!full.ok) continue
    for (const drop of live) {
      if (drop.id === lead.id) continue
      const less = computeTramlines({
        ...input,
        machines: pin(input.machines).map((m) => (m.id === drop.id ? { ...m, active: false } : m)),
      })
      if (!less.ok || less.cycle !== full.cycle) continue
      if (full.assumed || less.assumed || less.baseWidth !== full.baseWidth) continue
      if (less.step !== full.step) continue
      checked++
      assert.ok(
        less.disabledPerCycle <= full.disabledPerCycle,
        `набір ${seed}: без «${drop.label}» глушиться більше (${less.disabledPerCycle} проти ${full.disabledPerCycle})`,
      )
    }
  }
  assert.ok(checked > 100, `перевірено лише ${checked} пар — тест нічого не стереже`)
})

test('підібраний зсув не гірший за нульовий', () => {
  for (let seed = 1; seed <= N; seed++) {
    const input = sample(seed)
    const auto = computeTramlines(input)
    if (!auto.ok) continue
    const zero = computeTramlines({
      ...input,
      machines: input.machines.map((m) => ({ ...m, phase: 0 })),
    })
    if (!zero.ok || zero.cycle !== auto.cycle) continue
    assert.ok(
      auto.disabledPerCycle <= zero.disabledPerCycle,
      `набір ${seed}: автозсув гірший за нульовий (${auto.disabledPerCycle} проти ${zero.disabledPerCycle})`,
    )
  }
})

// Ритм головної машини може бути й довгим — його рахує термінал. Але друга
// машина не має права його розтягувати: межа або дванадцять, або те, що вже
// дала головна, якщо вона й так більша.
test('друга машина не розтягує ритм головної', () => {
  for (let seed = 1; seed <= N; seed++) {
    const input = sample(seed)
    const r = computeTramlines(input)
    if (!r.ok) continue
    assert.ok(r.rhythm >= 1, `набір ${seed}: ритм ${r.rhythm}`)
    assert.equal(r.passes.length, r.cycle)

    if (r.assumed) continue
    const lead = r.machines.find((m) => m.base)
    const alone = computeTramlines({
      ...input,
      machines: input.machines.map((m) => ({ ...m, active: m.id === lead.id, base: m.id === lead.id })),
    })
    if (!alone.ok || alone.assumed) continue
    assert.ok(
      r.rhythm <= Math.max(12, alone.rhythm),
      `набір ${seed}: ритм ${r.rhythm} при власному ритмі головної ${alone.rhythm}`,
    )
  }
})

test('план поля вкриває поле рівно раз і не виходить за межі', () => {
  for (let seed = 1; seed <= N; seed++) {
    const input = sample(seed)
    const r = computeTramlines(input)
    if (!r.ok) continue
    const p = fieldPlan(r, input)
    if (!p || p.tooSmall) continue
    finite({ ...p, passes: undefined, strips: undefined }, `набір ${seed}`)

    const x0 = p.headland
    const x1 = input.fieldWidth - p.headland
    const sum = p.passes.reduce((a, x) => a + x.fresh, 0)
    assert.ok(Math.abs(sum - p.workWidth) < 0.05,
      `набір ${seed}: проходи засівають ${sum} замість ${p.workWidth}`)
    // Рама кожного проходу не менша за його нову землю, і нахльост — це
    // різниця між ними, а не ще один прохід.
    for (const pass of p.passes) {
      assert.ok(pass.fresh <= pass.width + 1e-6,
        `набір ${seed}, прохід ${pass.i}: нової землі більше, ніж рами`)
    }
    for (const s of p.strips) {
      assert.ok(s.centre >= x0 - 1e-6 && s.centre <= x1 + 1e-6, `набір ${seed}: колія поза полем`)
      assert.ok(s.from >= x0 - 1e-6 && s.to <= x1 + 1e-6, `набір ${seed}: смуга поза полем`)
    }
    assert.ok(p.lostHa <= p.workingHa + 1e-6, `набір ${seed}: недосіяно більше, ніж є`)
    assert.ok(p.lostPct >= 0 && p.lostPct <= 100)
    // Кожен прохід поля має сошники, що сіють, вимкнені й винесені за межу —
    // і разом вони дають усі сошники сівалки, без перетину й без пропусків.
    for (const pass of p.passes) {
      const all = [...pass.sowing, ...pass.disabled, ...pass.outside]
      const uniq = new Set(all)
      assert.ok(uniq.size <= r.rows, `набір ${seed}, прохід ${pass.i}: сошників більше, ніж є`)
      for (const m of pass.disabled) {
        assert.ok(!pass.sowing.includes(m),
          `набір ${seed}, прохід ${pass.i}: сошник ${m} і сіє, і вимкнений`)
      }
      for (const m of pass.overlapClosed) {
        assert.ok(!pass.sowing.includes(m),
          `набір ${seed}, прохід ${pass.i}: сошник ${m} і сіє, і в нахльості`)
        assert.ok(!pass.disabled.includes(m),
          `набір ${seed}, прохід ${pass.i}: сошник ${m} і в колії, і в нахльості`)
      }
      assert.equal(pass.overlapClosed.length, pass.i === 1 ? 0 : r.overlapRows,
        `набір ${seed}, прохід ${pass.i}: нахльост не той`)
    }
  }
})

test('гроші або рахуються, або чесно відсутні — без NaN і мінусових площ', () => {
  for (let seed = 1; seed <= N; seed++) {
    const input = sample(seed)
    const r = computeTramlines(input)
    if (!r.ok) continue
    const p = fieldPlan(r, input)
    if (!p || p.tooSmall) continue
    const e = economics(p, r, input)
    if (!e) continue
    finite(e, `набір ${seed}`)
    assert.ok(e.without.ha >= 0 && e.withTramlines.ha >= 0, `набір ${seed}: мінусова площа`)
    assert.ok(e.without.ha <= p.workingHa + 1e-6, `набір ${seed}: витоптано більше за поле`)
    assert.equal(e.saving, e.without.uah - e.withTramlines.uah)
  }
})

test('підбір колісної бази не пропонує значень, що чіпають сошники', () => {
  for (let seed = 1; seed <= N; seed++) {
    const input = sample(seed)
    const a = suggestTracks(input)
    if (!a?.machines?.length) continue
    for (const m of a.machines) {
      if (!m.possible) {
        assert.deepEqual(m.options, [], `набір ${seed}: неможливе, але з варіантами`)
        continue
      }
      for (const o of m.options ?? []) {
        assert.ok(Number.isFinite(o.track) && o.track > 0, `набір ${seed}: база ${o.track}`)
        assert.ok(o.clearance > 0, `набір ${seed}: просвіт ${o.clearance}`)
      }
      // Спільні значення мусять бути добрими для кожної машини.
      for (const t of a.common) {
        assert.ok(m.all.some((o) => Math.abs(o.track - t) < 1e-9),
          `набір ${seed}: ${t} м у спільних, але не годиться для «${m.label}»`)
      }
    }
  }
})
