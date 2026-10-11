// ── Кілька машин на одній колії ───────────────────────────────────────────
//
// Головне, заради чого все: колію нарізає сівалка один раз, а їздить по ній і
// обприскувач, і комбайн, і перевантажувач. Заглушити треба об'єднання їхніх
// смуг, а не смугу однієї машини.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeTramlines, suggestTracks, trackOptionsFor,
  drillGeometry, coulterOffsets, resolveMargin, AUTO_MARGIN, LIMITS,
} from '../src/lib/tramline.js'
import { normaliseMachines, defaultMachines, newMachine } from '../src/lib/machines.js'

const grain = { rows: 24, rowSpacing: 0.15, margin: 0.05 }
const mach = (id, label, width, axles, extra = {}) =>
  ({ id, label, width, axles, kind: 'other', ...extra })
const sprayer18 = (track = 1.8) => mach('s', 'Обприскувач', 18, [{ trackWidth: track, tyreWidth: 0.35 }])
const combine9 = (track = 3.0) => mach('c', 'Комбайн', 9, [{ trackWidth: track, tyreWidth: 0.8 }])

test('одна машина в списку дає те саме, що й стара коротка форма', () => {
  const short = computeTramlines({ ...grain, sprayerWidth: 18, trackWidth: 1.8, tyreWidth: 0.35 })
  const list = computeTramlines({ ...grain, machines: [sprayer18()] })
  assert.equal(list.rhythm, short.rhythm)
  assert.equal(list.disabledPerCycle, short.disabledPerCycle)
  assert.deepEqual(
    list.passes.map((p) => p.disabled),
    short.passes.map((p) => p.disabled),
  )
})

test('друга машина додає свої смуги, а не замінює чужі', () => {
  const one = computeTramlines({ ...grain, machines: [sprayer18()] })
  const two = computeTramlines({ ...grain, machines: [sprayer18(), combine9()] })
  assert.ok(two.disabledPerCycle > one.disabledPerCycle, 'комбайн не може бути безкоштовним')
})

test('кожен вимкнений сошник підписаний машиною, через яку він вимкнений', () => {
  const r = computeTramlines({ ...grain, machines: [sprayer18(), combine9()] })
  for (const p of r.passes) {
    const named = new Set(p.reasons.flatMap((x) => x.rows))
    assert.deepEqual([...named].sort((a, b) => a - b), p.disabled,
      `прохід ${p.n}: підписи не збігаються зі списком вимкнених`)
    for (const x of p.reasons) assert.ok(x.label, 'машина без назви')
  }
})

test('крок колій задає найвужча машина, а не найчастіша', () => {
  const r = computeTramlines({ ...grain, machines: [sprayer18(), combine9()] })
  const base = r.machines.find((m) => m.base)
  assert.equal(base.id, 'c', 'комбайн 9 м мусить задавати крок, а не обприскувач 18 м')
  assert.equal(r.baseWidth, 9)
})

test('закріплена базова машина лишається базовою', () => {
  const r = computeTramlines({
    ...grain,
    machines: [
      mach('s', 'Обприскувач', 18, [{ trackWidth: 1.8, tyreWidth: 0.35 }], { base: true }),
      combine9(),
    ],
  })
  assert.equal(r.machines.find((m) => m.base).id, 's')
  assert.equal(r.baseWidth, 18)
})

// Ось головне число всієї програми. Та сама пара машин коштує різну кількість
// сошників залежно лише від того, чи зведені колісні бази до одного значення.
// Пів години з ключем проти кількох центнерів з поля.
test('однакова колісна база робить другу машину безкоштовною', () => {
  const mixed = computeTramlines({ ...grain, machines: [sprayer18(1.8), combine9(3.0)] })
  const same = computeTramlines({ ...grain, machines: [sprayer18(3.0), combine9(3.0)] })
  const sprayerIn = (r) => r.machines.find((m) => m.id === 's')
  assert.ok(sprayerIn(mixed).extraRows > 0, 'різні бази — обприскувач вимагає своєї смуги')
  assert.equal(sprayerIn(same).extraRows, 0, 'однакові бази — обприскувач їде готовою')
  assert.equal(sprayerIn(same).needsOwnBand, false)
  assert.ok(same.disabledPerCycle < mixed.disabledPerCycle)
})

test('зсув сітки підбирається, а не лишається нульовим', () => {
  const r = computeTramlines({ ...grain, machines: [sprayer18(3.0), combine9(3.0)] })
  const s = r.machines.find((m) => m.id === 's')
  assert.equal(s.phase, 4.5, 'обприскувач має почати з половини кроку колій')

  // Той самий набір із нульовими відступами в усіх. Базову машину
  // закріплюємо: інакше програма обійде обмеження, обравши кроком колій
  // іншу машину, і порівнювалися б два різні візерунки.
  const zero = computeTramlines({
    ...grain,
    machines: [
      { ...sprayer18(3.0), phase: 0 },
      { ...combine9(3.0), base: true, phase: 0 },
    ],
  })
  const pinned = computeTramlines({
    ...grain,
    machines: [sprayer18(3.0), { ...combine9(3.0), base: true }],
  })
  assert.ok(zero.disabledPerCycle > pinned.disabledPerCycle,
    `нульовий зсув має бути гіршим (${zero.disabledPerCycle} проти ${pinned.disabledPerCycle})`)
})

// Відступ базової машини зсуває не її одну, а всю сітку колій: саме так
// задають «почни за два метри від краю», коли край поля нерівний.
test('заданий зсув базової машини зсуває всі колії', () => {
  const plain = computeTramlines({
    ...grain, machines: [{ ...sprayer18(), base: true }],
  })
  const moved = computeTramlines({
    ...grain, machines: [{ ...sprayer18(), base: true, phase: 1.8 }],
  })
  assert.equal(moved.machines.find((m) => m.id === 's').phase, 1.8)
  const centres = (r) => r.strips.map((s) => s.centre).sort((a, b) => a - b)
  assert.notDeepEqual(centres(moved), centres(plain))
})

test('заданий вручну зсув програма не переписує', () => {
  const r = computeTramlines({
    ...grain,
    machines: [{ ...sprayer18(3.0), phase: 1.8 }, combine9(3.0)],
  })
  const s = r.machines.find((m) => m.id === 's')
  assert.equal(s.phase, 1.8)
  assert.equal(s.phaseFixed, true)
})

test('машина, не кратна сівалці, не ламає відповідь, а виноситься окремо', () => {
  const r = computeTramlines({
    ...grain,
    machines: [
      mach('s', 'Обприскувач', 18, [{ trackWidth: 1.8, tyreWidth: 0.35 }], { base: true }),
      mach('x', 'Перевантажувач', 7.6, [{ trackWidth: 1.8, tyreWidth: 0.65 }]),
    ],
  })
  assert.equal(r.ok, true, 'колія під обприскувач мусить лишитися')
  const x = r.machines.find((m) => m.id === 'x')
  assert.equal(x.fits, false)
  assert.equal(x.reason, 'ratio')
  assert.ok(x.options.length > 0, 'має підказати робочі захвати')
  for (const w of x.options) {
    const half = (w / 3.6) * 2
    assert.ok(Math.abs(half - Math.round(half)) < 1e-9, `${w} м не кратне половині захвату сівалки`)
  }
  assert.ok(r.warnings.some((w) => w.includes('Перевантажувач')))
})

test('машина, що вимагала б непідйомного ритму, виноситься окремо', () => {
  // Сівалка 3,6 м. Комбайн 9 м дає ритм 5, трактор 10,8 м — ритм 3; разом
  // цикл замкнувся б аж через 15 проходів, і це вже не рішення, а папірець.
  // Тому в колію йде одна з них, а друга чесно лишається поза розрахунком.
  const r = computeTramlines({
    ...grain,
    machines: [combine9(), mach('t', 'Трактор', 10.8, [{ trackWidth: 1.8, tyreWidth: 0.35 }])],
  })
  assert.equal(r.ok, true)
  assert.ok(r.rhythm <= 12, `ритм ${r.rhythm}`)
  const out = r.machines.filter((m) => m.active && !m.fits)
  assert.equal(out.length, 1, 'одна з двох мусить лишитися поза колією')
  assert.equal(out[0].reason, 'rhythm')
  assert.equal(out[0].wouldBeRhythm, 15)
  assert.ok(r.warnings.some((w) => w.includes(out[0].label)))
})

// Коли ширша машина дає довгий, але власний ритм, її варто взяти кроком
// колій: так у колію вкладаються обидві машини, а цикл рахує термінал.
// Залишити вужчу базовою означало б викинути ширшу з розрахунку зовсім.
test('довгий ритм кращий за викинуту з колії машину', () => {
  const r = computeTramlines({
    ...grain,
    machines: [combine9(), mach('w', 'Обприскувач', 27, [{ trackWidth: 1.8, tyreWidth: 0.35 }])],
  })
  assert.equal(r.ok, true)
  assert.equal(r.machines.filter((m) => m.fits).length, 2, 'обидві машини мусять влізти')
  assert.equal(r.machines.find((m) => m.base).id, 'w')
  assert.equal(r.rhythm, 15)
})

test('вимкнена машина не впливає ні на що', () => {
  const on = computeTramlines({ ...grain, machines: [sprayer18(), combine9()] })
  const off = computeTramlines({
    ...grain,
    machines: [sprayer18(), { ...combine9(), active: false }],
  })
  assert.ok(off.disabledPerCycle < on.disabledPerCycle)
  assert.equal(off.machines.find((m) => m.id === 'c').reason, 'off')
  const only = computeTramlines({ ...grain, machines: [sprayer18()] })
  assert.equal(off.disabledPerCycle, only.disabledPerCycle)
})

test('дві осі машини враховуються обидві', () => {
  const one = computeTramlines({ ...grain, machines: [combine9(3.0)] })
  const two = computeTramlines({
    ...grain,
    machines: [mach('c', 'Комбайн', 9, [
      { trackWidth: 3.0, tyreWidth: 0.8 },
      { trackWidth: 2.1, tyreWidth: 0.5 },
    ])],
  })
  assert.ok(two.disabledPerCycle > one.disabledPerCycle,
    'задня вісь на іншій базі теж глушить сошники')
})

test('порожній список машин — чесна відмова, а не нулі', () => {
  const r = computeTramlines({ ...grain, machines: [] })
  assert.equal(r.ok, false)
  assert.ok(r.warnings[0].length > 0)
})

// ── Довільна розкладка сошників ───────────────────────────────────────────

test('рівномірна розкладка будується з секцій і міжряддя', () => {
  const g = drillGeometry({ rows: 12, rowSpacing: 0.7 })
  assert.equal(g.width, 8.4)
  assert.equal(g.rows, 12)
  assert.equal(g.offsets[0], 0.35)
  assert.equal(g.offsets.at(-1), 8.05)
  assert.equal(g.custom, false)
})

test('довільна розкладка задає і захват, і кількість сошників', () => {
  const g = drillGeometry({ coulters: [0.35, 1.05, 1.75, 2.45] })
  assert.equal(g.rows, 4)
  assert.equal(g.width, 2.8, 'рама симетрична: скільки до першого, стільки й після останнього')
  assert.equal(g.custom, true)
})

test('захват можна задати явно, коли рама несиметрична', () => {
  const g = drillGeometry({ coulters: [0.2, 0.9, 1.6], drillWidth: 2.4 })
  assert.equal(g.width, 2.4)
})

test('нерівномірна сівалка рахується тією самою геометрією', () => {
  // Та сама сівалка 24 × 15 см, але двох сошників у центрі немає — під слід
  // трактора. Колія обприскувача лягає туди ж, тож глушити треба не більше.
  const even = coulterOffsets({ rows: 24, rowSpacing: 0.15 })
  const gapped = even.filter((x) => x < 1.7 || x > 1.9)
  const r = computeTramlines({
    coulters: gapped, drillWidth: 3.6, margin: 0.05, machines: [sprayer18()],
  })
  assert.equal(r.ok, true)
  assert.equal(r.rows, 22)
  assert.equal(r.drillWidth, 3.6)
  assert.equal(r.rhythm, 5)
  const plain = computeTramlines({ ...grain, machines: [sprayer18()] })
  assert.ok(r.disabledPerCycle <= plain.disabledPerCycle)
})

test('найменше міжряддя видно з розкладки', () => {
  const r = computeTramlines({
    coulters: [0.3, 0.6, 1.5, 1.8], drillWidth: 2.1, margin: 0.05,
    machines: [mach('s', 'Обприскувач', 4.2, [{ trackWidth: 1.8, tyreWidth: 0.2 }])],
  })
  assert.equal(r.minGap, 0.3)
})

// ── Слід трактора сівалки ─────────────────────────────────────────────────

test('слід трактора сівалки глушить сошники на кожному проході', () => {
  const plain = computeTramlines({ ...grain, machines: [sprayer18()] })
  const own = computeTramlines({
    ...grain,
    machines: [sprayer18()],
    drillTractor: { trackWidth: 1.8, tyreWidth: 0.52, closeOwnTracks: true },
  })
  assert.ok(own.disabledPerCycle > plain.disabledPerCycle)
  // На кожному проході циклу, а не на одному: трактор їде щоразу.
  assert.equal(own.passes.every((p) => p.disabled.length > 0), true)
  assert.ok(own.passes.some((p) => p.reasons.some((x) => x.machine === 'drill-tractor')))
})

test('слід трактора сівалки за замовчуванням нічого не глушить', () => {
  const r = computeTramlines({
    ...grain,
    machines: [sprayer18()],
    drillTractor: { trackWidth: 1.8, tyreWidth: 0.52 },
  })
  const plain = computeTramlines({ ...grain, machines: [sprayer18()] })
  assert.equal(r.disabledPerCycle, plain.disabledPerCycle)
  assert.equal(r.ownBands.length, 0)
})

// ── Підбір колісної бази під кілька машин ─────────────────────────────────

test('підбір бази розрізняє машини й знаходить спільні значення', () => {
  const row = {
    rows: 12, rowSpacing: 0.7, margin: 0.02,
    machines: [
      mach('s', 'Обприскувач', 25.2, [{ trackWidth: 2.1, tyreWidth: 0.3 }]),
      mach('t', 'Трактор', 8.4, [{ trackWidth: 2.1, tyreWidth: 0.3 }]),
    ],
  }
  const a = suggestTracks(row)
  assert.equal(a.machines.length, 2)
  assert.ok(a.common.length > 0, 'має бути база, добра для обох')
  for (const t of a.common) {
    for (const m of a.machines) {
      assert.ok(m.all.some((o) => Math.abs(o.track - t) < 1e-9), `${t} м не годиться для ${m.label}`)
    }
  }
  // 2,8 м — чотири міжрядді по 70 см, колесо точно в міжряддя.
  assert.ok(a.common.some((t) => Math.abs(t - 2.8) < 1e-9))
})

test('підбір бази перевіряє всі проходи машини, не лише перший', () => {
  // Захват 4,2 м на сівалці 8,4 м — два проходи машини на один прохід
  // сівалки, і база має минати сошники в обох.
  const offsets = coulterOffsets({ rows: 12, rowSpacing: 0.7 })
  const o = trackOptionsFor({
    machine: { id: 'c', label: 'К', width: 4.2, margin: 0.02, axles: [{ trackWidth: 2.8, tyreWidth: 0.3 }] },
    offsets, W: 8.4, k: 1,
  })
  assert.ok(o.all.length > 0, 'на 70 см міжрядді варіанти мусять бути')
  for (const opt of o.all) {
    for (let j = 0; j < 2; j++) {
      for (const wheel of [(j + 0.5) * 4.2 - opt.track / 2, (j + 0.5) * 4.2 + opt.track / 2]) {
        const u = ((wheel % 8.4) + 8.4) % 8.4
        const d = Math.min(...offsets.map((x) =>
          Math.min(Math.abs(u - x), Math.abs(u - x + 8.4), Math.abs(u - x - 8.4))))
        assert.ok(d > 0.3 / 2 + 0.02 - 1e-9, `база ${opt.track}: колесо на ${wheel} м чіпає сошник (просвіт ${d})`)
      }
    }
  }
})

test('на зерновому міжрядді підбирати базу нічого — і це сказано прямо', () => {
  const o = trackOptionsFor({
    machine: { id: 'c', label: 'Комбайн', width: 9, margin: 0.02, axles: [{ trackWidth: 3, tyreWidth: 0.8 }] },
    offsets: coulterOffsets({ rows: 24, rowSpacing: 0.15 }),
    W: 3.6, k: 5,
  })
  assert.equal(o.possible, false)
  assert.ok(o.need > 0.15, 'колесо із запасом ширше за міжряддя')
  assert.deepEqual(o.options, [])
})

// ── Список машин ──────────────────────────────────────────────────────────

test('стара коротка форма читається як список з однієї машини', () => {
  const list = normaliseMachines({ sprayerWidth: 18, trackWidth: 1.8, tyreWidth: 0.35, margin: 0.05 })
  assert.equal(list.length, 1)
  assert.equal(list[0].width, 18)
  assert.equal(list[0].axles[0].trackWidth, 1.8)
  assert.equal(list[0].margin, 0.05)
})

test('машина без осей або без захвату не вважається робочою', () => {
  const list = normaliseMachines({
    machines: [
      { id: 'a', width: 18, axles: [{ trackWidth: 0, tyreWidth: 0.35 }] },
      { id: 'b', width: 0, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] },
    ],
  })
  assert.equal(list.every((m) => !m.active), true)
})

test('базова машина лишається одна, скільком би не поставили прапорець', () => {
  const list = normaliseMachines({
    machines: [
      { id: 'a', width: 18, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }], base: true },
      { id: 'b', width: 9, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }], base: true },
    ],
  })
  assert.equal(list.filter((m) => m.base).length, 1)
})

test('типовий набір машин працює без жодного введеного числа', () => {
  const r = computeTramlines({ rows: 24, rowSpacing: 0.15, machines: defaultMachines() })
  assert.equal(r.ok, true)
  assert.ok(r.machines.some((m) => m.active))
  assert.ok(r.machines.some((m) => !m.active), 'комбайн і перевантажувач спочатку вимкнені')
})

test('нова машина отримує свій id і свої осі, а не чужі', () => {
  const a = newMachine('combine')
  const b = newMachine('combine')
  assert.notEqual(a.id, b.id)
  assert.equal(a.axles.length, 2)
  a.axles[0].trackWidth = 9.9
  assert.notEqual(b.axles[0].trackWidth, 9.9)
})

// ── Запас: система чи людина ──────────────────────────────────────────────
//
// Запас з кожного боку смуги вирішує, чи глухне сошник на межі. Раніше це
// було просто поле з числом; тепер у формі прапорець, і від нього залежить,
// чиє число бере розрахунок — бо під GPS-підрулюванням запас нульовий, а на
// схилі його беруть більшим, і вгадувати за господаря програма не має права.

test('без прапорця запас бере система, а не число з форми', () => {
  assert.equal(resolveMargin({}), AUTO_MARGIN)
  assert.equal(resolveMargin({ marginManual: false, margin: 0.4 }), AUTO_MARGIN,
    'прапорець знято — число у формі не діє')
  assert.equal(resolveMargin({ marginManual: true, margin: 0.4 }), 0.4)
})

test('нульовий запас вручну — це нуль, а не «не задано»', () => {
  assert.equal(resolveMargin({ marginManual: true, margin: 0 }), 0)
})

test('комплект, записаний до появи прапорця, читається з самого числа', () => {
  // Хто вводив запас вручну, той лишив його не таким, як бере система.
  assert.equal(resolveMargin({ margin: 0.05 }), 0.05)
  assert.equal(resolveMargin({ margin: AUTO_MARGIN }), AUTO_MARGIN)
})

test('сміття замість запасу не стає запасом', () => {
  for (const bad of [NaN, Infinity, -1, 'абв', null, undefined, {}, []]) {
    const v = resolveMargin({ marginManual: true, margin: bad })
    assert.ok(Number.isFinite(v) && v >= 0 && v <= LIMITS.margin, `запас ${bad} → ${v}`)
  }
  assert.equal(resolveMargin({ marginManual: true, margin: 1e6 }), LIMITS.margin,
    'запас ширший за межу зводиться до межі')
})

test('запас задає ширину смуги, а більший запас не глушить менше', () => {
  const machines = [sprayer18(2.1)]
  let last = -1
  for (const margin of [0, 0.05, 0.1, 0.2, 0.4]) {
    const r = computeTramlines({ ...grain, marginManual: true, margin, machines })
    assert.equal(r.ok, true, `запас ${margin}`)
    assert.ok(r.disabledPerCycle >= last,
      `запас ${margin}: глушимо ${r.disabledPerCycle}, а при меншому запасі ${last}`)
    last = r.disabledPerCycle
    // Смуга під колесом — шина плюс запас з обох боків, і ніяк інакше.
    for (const s of r.strips) {
      assert.ok(Math.abs((s.to - s.from) - (0.35 + 2 * margin)) < 1e-6,
        `смуга ${s.to - s.from} при шині 0,35 і запасі ${margin}`)
    }
  }
})

test('машина зі своїм запасом не чіпає решту парку', () => {
  const list = normaliseMachines({
    marginManual: true, margin: 0.1,
    machines: [sprayer18(), { ...combine9(), margin: 0.3 }],
  })
  assert.equal(list.find((m) => m.id === 's').margin, 0.1)
  assert.equal(list.find((m) => m.id === 'c').margin, 0.3)
})
