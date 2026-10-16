import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTramlines } from '../src/lib/tramline.js'

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

test('некратний захват не спиняє розрахунок — береться припущення', () => {
  const r = computeTramlines({ ...cereal, sprayerWidth: 20 })
  assert.equal(r.ok, true, 'відповідь мусить бути завжди')
  assert.ok(r.assumed, 'і мусить бути сказано, що це припущення')
  assert.ok(r.baseWidth <= 20, 'машина працює своїм захватом або вужче')
  assert.ok(r.warnings[0].includes('націло не діляться'),
    `перше слово відповіді — про припущення: ${r.warnings[0]}`)
})

test('припущення — це рівно те, що людина могла поставити руками', () => {
  const r = computeTramlines({ ...cereal, sprayerWidth: 20 })
  // Кожна машина припущення — та сама машина, тільки вужча. Ставимо ці
  // числа у форму руками й мусимо отримати ту саму відповідь, без жодного
  // припущення в ній.
  const same = computeTramlines({
    ...cereal,
    overlapRows: r.assumed.overlapRows,
    drillStep: r.assumed.step,
    machines: r.assumed.option.machines.filter((m) => m.fits).map((m) => ({
      id: m.id, label: m.label, width: m.width, base: m.id === r.assumed.baseId,
      axles: [{ trackWidth: cereal.trackWidth, tyreWidth: cereal.tyreWidth }],
    })),
    margin: cereal.margin,
  })
  assert.equal(same.ok, true)
  assert.equal(same.assumed, null, 'на цих числах припускати вже нічого')
  assert.equal(same.rhythm, r.rhythm)
  assert.equal(same.step, r.step)
  assert.deepEqual(same.passes.map((p) => p.disabled), r.passes.map((p) => p.disabled))
})

test('втрата площі рахується від усіх рядків циклу', () => {
  const r = computeTramlines(cereal)
  assert.equal(r.rowsPerCycle, 24 * 5)
  assert.equal(r.lossPct, Math.round((8 / 120) * 100 * 1000) / 1000)
})

test('коли захват ділиться, жодних припущень не береться', () => {
  const r = computeTramlines(cereal)
  assert.equal(r.assumed, null)
  assert.equal(r.suggestions, null)
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

import { rhythmOf } from '../src/lib/tramline.js'




// ── Друга машина ──────────────────────────────────────────────────────────
//
// Розкидач перевірявся окремою функцією на кратність обприскувачу. Тепер він
// просто машина в списку, і перевірка з нього строгіша: мало бути кратним —
// колесо мусить ще й упасти в нарізану смугу. Тести на це живуть у
// machines.test.js; тут лишилася лише та частина, яку стара функція
// перевіряла правильно, — кратність сама по собі.

test('кратний розкидач іде кожною n-ю колією', () => {
  const r = computeTramlines({
    rows: 24, rowSpacing: 0.15, margin: 0.05,
    machines: [
      { id: 's', label: 'Обприскувач', width: 18, base: true,
        axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] },
      { id: 'd', label: 'Розкидач', width: 36,
        axles: [{ trackWidth: 1.8, tyreWidth: 0.55 }] },
    ],
  })
  assert.equal(r.ok, true)
  const spreader = r.machines.find((m) => m.id === 'd')
  assert.equal(spreader.fits, true)
  // Захват удвічі більший за крок колій, тож на цикл обприскувача припадає
  // пів проходу розкидача: він іде кожною другою колією.
  assert.equal(r.machines.find((m) => m.id === 's').passesPerCycle, 2)
  assert.equal(spreader.passesPerCycle, 1)
})

test('некратний розкидач виноситься з колії, а не вдає, що вклався', () => {
  const r = computeTramlines({
    rows: 12, rowSpacing: 0.7, margin: 0.05,
    machines: [
      { id: 's', label: 'Обприскувач', width: 25.2, base: true,
        axles: [{ trackWidth: 2.1, tyreWidth: 0.3 }] },
      { id: 'd', label: 'Розкидач', width: 36,
        axles: [{ trackWidth: 1.8, tyreWidth: 0.55 }] },
    ],
  })
  const spreader = r.machines.find((m) => m.id === 'd')
  assert.equal(spreader.fits, false)
  assert.ok(spreader.options.length > 0, 'має підказати робочі захвати')
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

// ── Ритм ──────────────────────────────────────────────────────────────────
//
// Ритм — число проходів до повтору візерунка; саме його механізатор вводить
// у термінал сівалки. Половинні відношення захватів (4,5 · 5,5) дають
// асиметричний ритм: на одному проході глушать один бік, на іншому другий.
// Так роблять серійні сівалки, тож відмовляти в такій комбінації не можна.

test('ціле відношення дає симетричний ритм, що дорівнює відношенню', () => {
  const r = computeTramlines(cereal)          // 18 / 3,6 = 5
  assert.equal(r.rhythm, 5)
  assert.equal(r.symmetric, true)
  assert.equal(r.sprayerPassesPerCycle, 1)
})

test('половинне відношення не відмова, а асиметричний ритм', () => {
  // Сівалка 4 м (32 × 12,5 см) під обприскувач 18 м — 4,5 проходу.
  const r = computeTramlines({
    rows: 32, rowSpacing: 0.125, sprayerWidth: 18,
    trackWidth: 1.8, tyreWidth: 0.35, margin: 0.05,
  })
  assert.equal(r.ok, true, 'таку комбінацію серійні сівалки роблять')
  assert.equal(r.rhythm, 9, 'візерунок повторюється через 9 проходів')
  assert.equal(r.sprayerPassesPerCycle, 2, 'на два проходи обприскувача')
  assert.equal(r.symmetric, false)
  assert.ok(r.passes.filter(p => p.disabled.length).length > 2,
    'колія збирається з половинок на різних проходах')
})

test('у циклі рівно стільки колій, скільки проходів обприскувача', () => {
  const r = computeTramlines({
    rows: 32, rowSpacing: 0.125, sprayerWidth: 18,
    trackWidth: 1.8, tyreWidth: 0.35, margin: 0.05,
  })
  assert.equal(r.strips.length, 2 * r.sprayerPassesPerCycle, 'по два сліди на прохід')
  assert.equal(r.period, 9 * r.drillWidth)
})

test('асиметричний ритм розкладається на поле без розривів', () => {
  const r = computeTramlines({
    rows: 32, rowSpacing: 0.125, sprayerWidth: 18,
    trackWidth: 1.8, tyreWidth: 0.35, margin: 0.05,
  })
  const p = fieldPlan(r, { fieldWidth: 600, fieldLength: 800, rowSpacing: 0.125, headland: 0 })
  assert.ok(p.strips.every(s => s.centre >= 0 && s.centre <= 600))
  // Колії стоять через захват обприскувача по всій ширині.
  const centres = p.strips.map(s => s.centre).sort((a, b) => a - b)
  const pairs = []
  for (let i = 0; i < centres.length; i += 2) pairs.push((centres[i] + centres[i + 1]) / 2)
  for (let i = 1; i < pairs.length; i++) {
    close(pairs[i] - pairs[i - 1], 18, 'відстань між сусідніми коліями')
  }
})

test('несумісні захвати дають відповідь, а не відмову', () => {
  const r = computeTramlines({ ...cereal, sprayerWidth: 20 })   // 5,55 проходу
  assert.equal(r.ok, true)
  assert.ok(r.assumed, 'але з припущенням, і воно назване')
})

test('непрактичні ритми не видаються за робочі', () => {
  // 3 м під 16 м формально дає візерунок на 16 проходів, що замикається аж
  // через три проходи обприскувача. Жодна система так не працює, і людина
  // такий цикл не відрахує — має бути чесна відмова.
  assert.equal(rhythmOf(16, 3), null)
  assert.equal(rhythmOf(21, 4), null)
  assert.equal(rhythmOf(20, 3), null)

  // А половинні ритми лишаються — це справжня практика.
  assert.deepEqual(rhythmOf(18, 4), { rhythm: 9, symmetric: false })
  assert.deepEqual(rhythmOf(18, 6), { rhythm: 3, symmetric: true })
  assert.deepEqual(rhythmOf(24, 6), { rhythm: 4, symmetric: false })
})

import { workingSets, drillGeometry } from '../src/lib/tramline.js'

// Набори робочих ширин під один обприскувач 16 м на сівалці 24 × 15 см.
const sets16 = (limit = 4) => workingSets({
  geo: drillGeometry({ rows: 24, rowSpacing: 0.15 }),
  machines: [{ id: 's', label: 'Обприскувач', width: 16, base: true }],
  limit,
})
const lead16 = (set) => set.machines[0]

// ── Штанга 16 м на сівалці 3,6 м ──────────────────────────────────────────
//
// Випадок із життя: 24 секції по 15 см дають 3,6 м, а штанга 16 м. 16 не
// ділиться на 3,6, і 16 м не кратні 15 см узагалі — нахльостом у цілих
// сошниках точного збігу не існує. Але крок сівалки задає розмітка, а не
// рама: 16 / 5 = 3,2 м, і штанга працює всіми 16 м. Господар так і просив —
// обприскувач без перекриття, підлаштовується сівалка.

const boom16 = { rows: 24, rowSpacing: 0.15, sprayerWidth: 16 }

test('штанга 16 м на сівалці 3,6 м — штанга працює всіма 16 м', () => {
  const r = computeTramlines({ ...boom16, trackWidth: 2.45, tyreWidth: 0.4, margin: 0.05 })
  assert.equal(r.ok, true)
  assert.equal(r.baseWidth, 16, 'перекриття штанги бути не мусить')
  assert.equal(r.exactStep, true)
  assert.equal(r.step, 3.2)
  assert.equal(r.period, 16)
  assert.equal(r.rhythm, 5)
  // Три закриті сошники дають стик 20 см — найближче до 15 см із можливих
  // (два закриті дали б 5 см, майже здвоєний рядок).
  assert.equal(r.overlapRows, 3)
  assert.equal(r.joint, 0.2)
})

test('обприскувач 16 м, база 1,8 м, шина 0,45 — колеса в колії, ніде не по рядку', () => {
  const r = computeTramlines({ rows: 24, rowSpacing: 0.15,
    machines: [{ id: 's', kind: 'sprayer', label: 'Обприскувач', width: 16,
      axles: [{ trackWidth: 1.8, tyreWidth: 0.45 }] }] })
  assert.equal(r.baseWidth, 16)
  assert.equal(r.period, 16)
  // Колеса на 8 ± 0,9 м: жоден сошник, що сіє, у смугу шини не потрапив.
  for (const p of r.passes) {
    for (let m = 1; m <= 24; m++) {
      if (p.disabled.includes(m) || p.overlapClosed.includes(m)) continue
      const x = p.from + r.coulters[m - 1]
      for (const c of [8 - 0.9, 8 + 0.9]) {
        assert.ok(Math.abs(x - c) > 0.225, `прохід ${p.n}, сошник ${m} під колесом`)
      }
    }
  }
})

test('робоча ширина не перевищує наявний захват', () => {
  for (const set of sets16()) {
    const m = lead16(set)
    assert.ok(m.width <= 16, `${m.width} м ширше за штангу`)
    assert.equal(m.overlap, Math.round((16 - m.width) * 1000) / 1000)
    assert.equal(m.width, Math.round(m.k * set.step * 1000) / 1000)
  }
})

test('перший набір під 16 м — точний крок 3,2 м, штанга вся', () => {
  // Раніше тут першим стояло 14,4 м: заглушені секції важили стільки ж,
  // скільки перекриття штанги. Але це різні гроші. Перекриття — подвійна
  // доза на смузі, і то на кожній обробці за сезон; нахльост — зайвий
  // прохід сівалки раз на поле, без утрати площі. Тому вага половинна, і
  // перший варіант став той, у якого перекриття 25 см, а не 1,6 м. А тепер
  // і 25 см немає: крок 3,2 м ділить 16 м рівно.
  const [best] = sets16()
  assert.equal(best.exact, true)
  assert.equal(best.off, 3)
  assert.equal(best.step, 3.2)
  assert.equal(lead16(best).width, 16)
  assert.equal(lead16(best).k, 5)
  assert.equal(lead16(best).overlap, 0)
  // Звичний нахльост 15,75 м нікуди не дівся — він у списку далі.
  assert.ok(sets16(8).some((o) => !o.exact && lead16(o).width === 15.75))
})

test('набір без жодного нахльоста теж лишається в списку', () => {
  const plain = sets16(8).find((o) => o.off === 0)
  assert.ok(plain, 'має бути чим працювати й не чіпаючи сівалку')
  assert.equal(plain.step, 3.6)
  assert.equal(lead16(plain).width, 14.4)
  assert.equal(lead16(plain).k, 4)
})

test('дорогі набори показуються лише тоді, коли дешевих немає', () => {
  // Перекриття в чверть захвату й більше — погана робота, і поки є
  // нормальні набори, таких у списку немає.
  for (const set of sets16(8)) {
    assert.ok(set.leadFits, `${lead16(set).overlap} м перекриття — це вже катання`)
  }
  // Але для машини 1,5 м при сівалці 3,6 м нормальних наборів не існує
  // зовсім, і тоді краще дорогий спосіб, ніж «колія не складеться».
  const narrow = workingSets({
    geo: drillGeometry({ rows: 24, rowSpacing: 0.15 }),
    machines: [{ id: 's', label: 'Обприскувач', width: 1.5, base: true }],
  })
  assert.ok(narrow.length > 0, 'спосіб мусить знайтися й тут')
  assert.ok(narrow[0].step <= 1.5 + 1e-9)
})

test('кожен запропонований набір справді дає колію', () => {
  for (const set of sets16(8)) {
    const o = lead16(set)
    const r = computeTramlines({
      rows: 24, rowSpacing: 0.15, overlapRows: set.off, sprayerWidth: o.width,
      drillStep: set.exact ? set.step : null,
      trackWidth: 2.45, tyreWidth: 0.4, margin: 0.05,
    })
    assert.equal(r.ok, true, `${o.width} м не дає ритму`)
    assert.equal(r.assumed, null, `${o.width} м: мусило скластися без припущень`)
    assert.equal(r.rhythm, o.k)
    assert.equal(r.step, Math.round(set.step * 1000) / 1000)
    assert.ok(r.disabledPerCycle > 0, `${o.width} м: нема чого глушити`)
  }
})

// ── Проходи по конкретному полю ───────────────────────────────────────────

const field260 = {
  rows: 24, rowSpacing: 0.15, sprayerWidth: 14.4,
  trackWidth: 2.45, tyreWidth: 0.4, margin: 0.05, halfStart: true,
}

test('кожен прохід поля має свій номер і свій список секцій', () => {
  const r = computeTramlines(field260)
  const plan = fieldPlan(r, { fieldWidth: 260, fieldLength: 800, rowSpacing: 0.15, headland: 0 })

  assert.deepEqual(plan.passes.map((p) => p.i), plan.passes.map((_, n) => n + 1))
  for (const p of plan.passes) {
    // Секція або сіє, або вимкнена під колію, або висить за межею поля —
    // третього не дано, і жодна не може потрапити у два списки одразу.
    const all = [...p.sowing, ...p.disabled, ...p.outside]
    assert.equal(new Set(all).size, all.length, `прохід ${p.i}: секція в двох списках`)
    assert.equal(all.length, 24, `прохід ${p.i}: загубилась секція`)
  }
})

test('колію нарізає кожен k-й прохід, решта сіють усім', () => {
  const r = computeTramlines(field260)
  const plan = fieldPlan(r, { fieldWidth: 260, fieldLength: 800, rowSpacing: 0.15, headland: 0 })
  const hit = plan.passes.filter((p) => p.tramline).map((p) => p.i)

  assert.ok(hit.length > 0)
  // Половинний перший прохід збирає колію в один прохід циклу, тож номери
  // йдуть рівним кроком у чотири проходи.
  for (let n = 1; n < hit.length; n++) assert.equal(hit[n] - hit[n - 1], r.cycle)
  assert.equal(plan.passes.filter((p) => !p.tramline).length, plan.passes.length - hit.length)
})

test('за межею поля секції опиняються лише скраю', () => {
  const r = computeTramlines(field260)
  const plan = fieldPlan(r, { fieldWidth: 260, fieldLength: 800, rowSpacing: 0.15, headland: 0 })
  const partial = plan.passes.filter((p) => p.outside.length)

  for (const p of partial) {
    assert.ok(p.i === 1 || p.i === plan.passes.length,
      `прохід ${p.i} усередині поля не може виходити за межу`)
  }
})

// ── Нахльост на засіяне ───────────────────────────────────────────────────
//
// Між проходами має лишитися рівно міжряддя, а без підрулювання в це не
// влучити. Тому заходять на засіяне навмисно й закривають крайні сошники.
// Головне, що з цього мусить вийти на полі: рядки йдуть однаково по всій
// ширині — ні пропуску між проходами, ні рядка, засіяного двічі.

const overlapped = {
  rows: 24, rowSpacing: 0.15, overlapRows: 3, margin: 0.1,
  machines: [{
    id: 'sprayer', label: 'Обприскувач', width: 15.75, base: true, active: true,
    axles: [{ trackWidth: 1.8, tyreWidth: 0.45 }],
  }],
}

test('з нахльостом рядки по полю йдуть однаково — без пропусків і без подвійних', () => {
  const r = computeTramlines(overlapped)
  assert.equal(r.ok, true)
  assert.equal(r.step, 3.15)
  const p = fieldPlan(r, { fieldWidth: 46, fieldLength: 950, headland: 0, rowSpacing: 0.15 })

  const sown = []
  for (const pass of p.passes) {
    const left = (pass.i - 1) * r.step - r.shift
    for (const m of pass.sowing) sown.push(Math.round((left + r.coulters[m - 1]) * 1000) / 1000)
  }
  const sorted = [...sown].sort((a, b) => a - b)
  assert.equal(new Set(sorted).size, sorted.length, 'якийсь рядок засіяно двічі')
  for (const x of sorted) {
    // Усі рядки стоять на одній сітці з міжряддям 15 см, від краю поля.
    const off = Math.abs((x / 0.15) % 1 - 0.5)
    assert.ok(off < 1e-6, `рядок ${x} стоїть не на сітці`)
  }
  // Пропуски бувають лише там, де сошник вимкнений під колію: інших розривів
  // у сходах бути не має.
  const disabledPos = new Set()
  for (const pass of p.passes) {
    const left = (pass.i - 1) * r.step - r.shift
    for (const m of pass.disabled) {
      disabledPos.add(Math.round((left + r.coulters[m - 1]) * 1000) / 1000)
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.round((sorted[i] - sorted[i - 1]) * 1000) / 1000
    if (gap <= 0.15 + 1e-9) continue
    for (let x = sorted[i - 1] + 0.15; x < sorted[i] - 1e-9; x = Math.round((x + 0.15) * 1000) / 1000) {
      assert.ok(disabledPos.has(Math.round(x * 1000) / 1000),
        `між ${sorted[i - 1]} і ${sorted[i]} пропуск, якого не просили`)
    }
  }
})

test('сошник нахльоста стоїть точно на рядку сусіднього проходу', () => {
  const r = computeTramlines(overlapped)
  const rows = r.coulters
  for (let j = 0; j < r.overlapRows; j++) {
    // Прохід i, сошник j — та сама точка, що прохід i−1, сошник 24−3+j.
    const mine = r.step + rows[j]
    const neighbour = rows[r.rows - r.overlapRows + j]
    assert.ok(Math.abs(mine - neighbour) < 1e-9,
      `сошник ${j + 1} нахльоста: ${mine} проти ${neighbour}`)
  }
})

test('на першому проході поля сошники нахльоста сіють', () => {
  const r = computeTramlines(overlapped)
  const p = fieldPlan(r, { fieldWidth: 46, fieldLength: 950, headland: 0, rowSpacing: 0.15 })
  assert.deepEqual(p.passes[0].overlapClosed, [], 'заходити першому проходу нікуди')
  for (const m of r.overlapClosed) {
    assert.ok(p.passes[0].sowing.includes(m) || p.passes[0].disabled.includes(m),
      `сошник ${m} на першому проході не робить нічого`)
  }
  // А далі — закриті на кожному.
  for (const pass of p.passes.slice(1)) {
    assert.deepEqual(pass.overlapClosed, r.overlapClosed, `прохід ${pass.i}`)
  }
})

test('нахльост не вважається недосіяною площею', () => {
  // Закон збереження поля: кожен метр робочої ширини або засіяний, або
  // недосіяний під колію. Сошники нахльоста не можуть потрапити ні в те, ні
  // в інше двічі — саме цим вони й відрізняються від вимкнених.
  const r = computeTramlines(overlapped)
  const p = fieldPlan(r, { fieldWidth: 46, fieldLength: 950, headland: 0, rowSpacing: 0.15 })
  const sown = p.passes.reduce((a, x) => a + x.sowing.length, 0)
  assert.equal(p.disabledRows, p.passes.reduce((a, x) => a + x.disabled.length, 0))
  const covered = (sown + p.disabledRows) * 0.15
  assert.ok(Math.abs(covered - p.workWidth) < 0.15,
    `рядки вкривають ${covered} м із ${p.workWidth} м`)
  assert.equal(p.lostHa, Math.round((p.disabledRows * 0.15 * p.workLength) / 10000 * 1000) / 1000)

  // І головне: більший нахльост сам по собі недосіву не додає. Поле те саме,
  // робоча ширина та сама — міняється лише те, скільком сошникам не сіяти по
  // чужих рядках.
  const more = computeTramlines({ ...overlapped, overlapRows: 7, machines: [{
    ...overlapped.machines[0], width: 15.3,
  }] })
  const pMore = fieldPlan(more, { fieldWidth: 46, fieldLength: 950, headland: 0, rowSpacing: 0.15 })
  assert.equal(more.overlapRows, 7)
  assert.ok(pMore.passes.length > p.passes.length, 'нахльост — це зайві проходи')
  assert.ok(pMore.lostHa < p.workingHa / 5, `недосів ${pMore.lostHa} га — завеликий`)
})
