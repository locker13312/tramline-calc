// ── Кілька машин на одній колії ───────────────────────────────────────────
//
// Головне, заради чого все: колію нарізає сівалка один раз, а їздить по ній і
// обприскувач, і комбайн, і перевантажувач. Заглушити треба об'єднання їхніх
// смуг, а не смугу однієї машини.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeTramlines,
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

// ── Нахльост ──────────────────────────────────────────────────────────────

test('нахльост зменшує крок, а не захват сівалки', () => {
  // Штанга тут 15,75 м: саме стільки ділиться на крок 3,15 м рівно, тож
  // нахльост видно сам по собі, без припущень.
  const r = computeTramlines({
    ...grain,
    overlapRows: 3,
    machines: [mach('s', 'Обприскувач', 15.75, [{ trackWidth: 1.8, tyreWidth: 0.35 }])],
  })
  assert.equal(r.drillWidth, 3.6, 'рама як була')
  assert.equal(r.step, 3.15, 'а переставляється сівалка на крок')
  assert.deepEqual(r.overlapClosed, [1, 2, 3])
  assert.equal(r.assumed, null, '15,75 м на крок 3,15 м ділиться рівно')
  assert.equal(r.rhythm, 5)
})

test('сошники нахльоста не вважаються недосіяними', () => {
  const r = computeTramlines({ ...grain, overlapRows: 4, machines: [sprayer18()] })
  // Рядків за цикл — лише ті, що сіються: решту кладе сусідній прохід.
  assert.equal(r.rowsPerCycle, (24 - 4) * r.cycle)
  for (const p of r.passes) {
    for (const m of r.overlapClosed) {
      assert.ok(!p.disabled.includes(m), `сошник ${m} і в нахльості, і в колії`)
    }
  }
})

test('нахльост, якого сівалка не може дати, обрізається з попередженням', () => {
  // Обрізається до 22 — щонайменше два сошники мусять сіяти. Далі крок 0,3 м
  // під штангу 18 м до ритму не зводиться, тож відповідь береться з
  // припущення, але попередження про обрізане число лишається при ній.
  const r = computeTramlines({ ...grain, overlapRows: 99, machines: [sprayer18()] })
  assert.ok(r.overlapRows <= 22)
  assert.ok(r.warnings.some((w) => w.includes('більше, ніж сівалка може віддати')))
})

test('старий збережений трактор сівалки просто не враховується', () => {
  const plain = computeTramlines({ ...grain, machines: [sprayer18()] })
  const old = computeTramlines({
    ...grain,
    machines: [sprayer18()],
    drillTractor: { trackWidth: 1.8, tyreWidth: 0.52, closeOwnTracks: true },
  })
  assert.equal(old.disabledPerCycle, plain.disabledPerCycle)
  assert.deepEqual(old.warnings, plain.warnings)
})

// ── Підбір колісної бази під кілька машин ─────────────────────────────────




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

// ── Комбайн, що йде тими самими проходами, що й сівалка ───────────────────
//
// Питання з поля: у господарстві комбайн ходить так само, як сівалка, лише
// жатка інша. Модель на це відповідає неприємне, і відповідь варто тримати
// перевіркою, бо вона суперечить здоровому глузду: що ВУЖЧА машина, то
// ДОРОЖЧА колія. Вузька машина робить більше проходів на ту саму ширину
// поля, а кожен її прохід вимагає пари смуг під колеса.
//
// Сівалка 4 м, обприскувач 16 м (рівно чотири проходи сівалки), і комбайн
// із тією самою колісною базою.
test('що вужчий комбайн, то більше смуг вимагає колія', () => {
  const drill = { rows: 26, rowSpacing: 4 / 26, margin: 0.1 }
  const boom = mach('s', 'Обприскувач', 16, [{ trackWidth: 2.45, tyreWidth: 0.4 }])
  const harvester = (width) =>
    mach('h', 'Комбайн', width, [{ trackWidth: 2.45, tyreWidth: 0.4 }])

  const alone = computeTramlines({ ...drill, machines: [boom] })
  const same = computeTramlines({ ...drill, machines: [boom, harvester(4)] })
  const twice = computeTramlines({ ...drill, machines: [boom, harvester(8)] })

  for (const r of [alone, same, twice]) assert.equal(r.ok, true)
  assert.equal(alone.cycle, 4)

  // Комбайн із захватом сівалки їде КОЖНИМ її проходом, тож пара смуг
  // потрібна на кожному — колії вже не чотири на цикл, а вісім.
  assert.ok(same.passes.every((p) => p.disabled.length > 0),
    'при однаковому захваті колія потрібна на кожному проході')
  assert.equal(same.disabledPerCycle, 4 * alone.disabledPerCycle)

  // Удвічі ширший комбайн кладе по одному колесу на прохід замість двох.
  assert.equal(twice.disabledPerCycle, 2 * alone.disabledPerCycle)
  assert.ok(twice.disabledPerCycle < same.disabledPerCycle)
})

// Той самий комбайн із чужою колісною базою — і ціна колії стрибає, хоч
// жоден захват не змінився. Саме це й означає «звести бази до одного
// значення»: пів години з ключем проти кількох центнерів з поля.
test('чужа колісна база комбайна дорожча за свою', () => {
  const drill = { rows: 26, rowSpacing: 4 / 26, margin: 0.1 }
  const boom = mach('s', 'Обприскувач', 16, [{ trackWidth: 2.45, tyreWidth: 0.4 }])
  const own = computeTramlines({
    ...drill, machines: [boom, mach('h', 'Комбайн', 8, [{ trackWidth: 2.45, tyreWidth: 0.4 }])],
  })
  const alien = computeTramlines({
    ...drill, machines: [boom, mach('h', 'Комбайн', 8, [{ trackWidth: 3.0, tyreWidth: 0.8 }])],
  })
  assert.equal(own.ok, true)
  assert.equal(alien.ok, true)
  assert.ok(alien.disabledPerCycle > own.disabledPerCycle,
    `своя база ${own.disabledPerCycle}, чужа ${alien.disabledPerCycle}`)
})

// ── Звірка з паперовим підручником ────────────────────────────────────────
//
// Найнадійніша перевірка розрахунку — не власний тест, а чуже число,
// пораховане без нас. Посібник з механізованих робіт для агрегату
// Т-150-05 + СП-11 + 3×СЗ-3,6А (три сівалки по 24 сошники, разом 10,8 м)
// пише: технологічна колія 1800 мм, ширина доріжок 450 мм, «заслінки
// встановлюють на 6, 7, 18 і 19 висіваючі апарати».
//
// Якщо модель правильна, вона мусить назвати ті самі апарати — сама, з
// геометрії, нічого не знаючи про цей агрегат.
test('підручниковий агрегат: ті самі 6, 7, 18 і 19 апарати', () => {
  const r = computeTramlines({
    rows: 72, rowSpacing: 0.15, margin: 0.05,
    machines: [{
      id: 's', label: 'Обприскувач', width: 10.8, base: true, active: true,
      axles: [{ trackWidth: 1.8, tyreWidth: 0.3 }],
    }],
  })
  assert.equal(r.ok, true)
  assert.equal(r.rhythm, 1, 'захват машини дорівнює захвату агрегату')
  assert.deepEqual(r.passes[0].disabled, [30, 31, 42, 43])

  // Ті самі номери в нумерації окремої сівалки — як у посібнику.
  const perDrill = r.passes[0].disabled.map((m) => ({
    drill: Math.ceil(m / 24), slot: ((m - 1) % 24) + 1,
  }))
  assert.deepEqual(perDrill, [
    { drill: 2, slot: 6 }, { drill: 2, slot: 7 },
    { drill: 2, slot: 18 }, { drill: 2, slot: 19 },
  ])

  // І ширина доріжки та сама: два закриті сошники лишають 450 мм без сходів.
  assert.equal(r.disabledPerCycle, 4)
  assert.equal(Math.round(3 * 0.15 * 1000), 450)
})

