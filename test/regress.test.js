// ── Баги, що вже були ─────────────────────────────────────────────────────
//
// Кожен тест тут стоїть за конкретною помилкою, яку знайшли на живій
// програмі. Вони не перевіряють геометрію — для неї є свої файли, — а
// стережуть ті дрібниці, через які правильний розрахунок показував неправду
// або тихо брав не ті дані.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTramlines, fieldPlan, drillGeometry } from '../src/lib/tramline.js'
import { normaliseMachines } from '../src/lib/machines.js'

const grain = { rows: 24, rowSpacing: 0.15, margin: 0.05 }
const sprayer = (extra = {}) => ({
  id: 's', kind: 'sprayer', label: 'Обприскувач', width: 18,
  axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }], ...extra,
})

// Стерте поле захвату робило машину непридатною, і вона просто випадала з
// розрахунку: цифри вгорі змінювалися, а причини не було видно ніде.
test('ввімкнена машина без захвату не зникає мовчки, а дає попередження', () => {
  const r = computeTramlines({
    ...grain,
    machines: [sprayer(), { id: 'c', label: 'Комбайн', width: 0, axles: [{ trackWidth: 3, tyreWidth: 0.8 }] }],
  })
  assert.equal(r.ok, true)
  const c = r.machines.find((m) => m.id === 'c')
  assert.equal(c.active, false)
  assert.equal(c.reason, 'blank', 'це не «вимкнена свідомо», а «не заповнена»')
  assert.ok(r.warnings.some((w) => w.includes('Комбайн') && w.includes('захват')),
    `мусить бути попередження: ${JSON.stringify(r.warnings)}`)
})

test('ввімкнена машина без колісної бази теж дає попередження', () => {
  const r = computeTramlines({
    ...grain,
    machines: [sprayer(), { id: 'c', label: 'Комбайн', width: 9, axles: [{ trackWidth: 0, tyreWidth: 0.8 }] }],
  })
  const c = r.machines.find((m) => m.id === 'c')
  assert.equal(c.reason, 'blank')
  assert.ok(r.warnings.some((w) => w.includes('Комбайн') && w.includes('колісна база')))
})

// Вимкнена свідомо — це інша причина, і підпис у картці інший.
test('свідомо вимкнена машина не вважається незаповненою', () => {
  const r = computeTramlines({
    ...grain,
    machines: [sprayer(), { id: 'c', label: 'Комбайн', width: 9, active: false,
      axles: [{ trackWidth: 3, tyreWidth: 0.8 }] }],
  })
  assert.equal(r.machines.find((m) => m.id === 'c').reason, 'off')
  assert.equal(r.warnings.some((w) => w.includes('Комбайн')), false,
    'про свідомо вимкнену машину попереджати нема про що')
})

test('незаповнена машина не губиться в припущенні', () => {
  // Головна машина не ділиться на сівалку, тож відповідь береться з
  // припущення. Попередження про незаповнену другу машину мусить дожити й
  // до неї: часто саме воно і є причиною того, що ритм не склався.
  const r = computeTramlines({
    ...grain,
    machines: [sprayer({ width: 20, base: true }), { id: 'c', label: 'Комбайн', width: 0, axles: [] }],
  })
  assert.equal(r.ok, true)
  assert.ok(r.assumed)
  assert.ok(r.warnings.length >= 2)
  assert.ok(r.warnings.some((w) => w.includes('Комбайн')),
    `про незаповнену машину не сказано: ${JSON.stringify(r.warnings)}`)
})

// Явний захват діяв і в рівномірному режимі: задав 2,4 м для своєї розкладки,
// повернувся до секцій із міжряддям — а захват лишився прилиплий.
test('явний захват діє лише для своєї розкладки сошників', () => {
  const even = drillGeometry({ rows: 24, rowSpacing: 0.15, drillWidth: 2.4 })
  assert.equal(even.width, 3.6, 'рівномірна сівалка — це секції × міжряддя, і нічого іншого')
  assert.equal(even.custom, false)

  const own = drillGeometry({ coulters: [0.2, 0.9, 1.6], drillWidth: 2.4 })
  assert.equal(own.width, 2.4, 'для своєї розкладки явний захват потрібен')
  assert.equal(own.custom, true)
})

test('одна позиція сошника — це ще не розкладка, а недописана розкладка', () => {
  const g = drillGeometry({ rows: 24, rowSpacing: 0.15, coulters: [1.5] })
  assert.equal(g.custom, false)
  assert.equal(g.rows, 24, 'поки позицій менше двох, працює рівномірна сівалка')
  assert.equal(g.width, 3.6)
})

// Недосіяна смуга — це міжряддя. Для своєї розкладки міжряддя з форми вже ні
// про що не каже, і площа рахувалася не з того числа.
test('ширина недосіяної смуги береться з розкладки, а не з форми', () => {
  const r = computeTramlines({
    coulters: [0.3, 0.6, 1.5, 1.8], drillWidth: 2.1, rowSpacing: 0.7, margin: 0.05,
    machines: [{ id: 's', label: 'Обприскувач', width: 4.2, base: true,
      axles: [{ trackWidth: 1.8, tyreWidth: 0.2 }] }],
  })
  assert.equal(r.custom, true)
  assert.equal(r.stripWidth, 0.3, 'найменший проміжок розкладки, а не 0,7 з форми')

  const even = computeTramlines({ ...grain, machines: [sprayer()] })
  assert.equal(even.custom, false)
  assert.equal(even.stripWidth, 0.15, 'у рівномірної — міжряддя')
})

test('втрачена площа рахується за шириною смуги цієї розкладки', () => {
  const input = {
    coulters: [0.3, 0.6, 1.5, 1.8], drillWidth: 2.1, rowSpacing: 0.7, margin: 0.05,
    machines: [{ id: 's', label: 'Обприскувач', width: 4.2, base: true,
      axles: [{ trackWidth: 1.8, tyreWidth: 0.2 }] }],
  }
  const r = computeTramlines(input)
  const p = fieldPlan(r, { fieldWidth: 420, fieldLength: 800, rowSpacing: input.rowSpacing })
  if (!p || p.tooSmall || !p.disabledRows) return
  const expected = Math.round((p.disabledRows * r.stripWidth * p.workLength) / 10000 * 1000) / 1000
  assert.equal(p.lostHa, expected, 'площа має йти від 0,3 м, а не від 0,7 м з форми')
})

// Прапорець «хочу цю машину» і «машина придатна» — різні речі, і список
// мусить повертати обидва.
test('нормалізація розрізняє «хочу» і «придатна»', () => {
  const list = normaliseMachines({
    machines: [
      { id: 'a', width: 18, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] },
      { id: 'b', width: 0, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] },
      { id: 'c', width: 9, active: false, axles: [{ trackWidth: 1.8, tyreWidth: 0.35 }] },
    ],
  })
  const by = (id) => list.find((m) => m.id === id)
  assert.equal(by('a').wanted, true)
  assert.equal(by('a').active, true)
  assert.equal(by('b').wanted, true, 'людина її хотіла')
  assert.equal(by('b').active, false, 'але рахувати нічого')
  assert.equal(by('c').wanted, false)
  assert.equal(by('c').active, false)
})

// Захват, заданий рядком із форми, має читатися як число.
test('захват рядком з форми не робить машину непридатною', () => {
  const list = normaliseMachines({
    machines: [{ id: 'a', width: '18', axles: [{ trackWidth: '1.8', tyreWidth: '0.35' }] }],
  })
  assert.equal(list[0].active, true)
  assert.equal(list[0].width, 18)
  assert.equal(list[0].axles[0].trackWidth, 1.8)
})

// Розкладка з літер замість чисел лишала сівалку без жодного сошника, але із
// живим захватом: програма рахувала колію на полі, де сіяти нічим, і бодро
// повідомляла «глушити нічого» — при NaN у відсотку недосіяного.
test('розкладка без жодного числа повертає до рівномірної сівалки', () => {
  const g = drillGeometry({ rows: 24, rowSpacing: 0.15, coulters: ['а', 'б', 'в'] })
  assert.equal(g.rows, 24, 'сошники беруться з рівномірної розкладки')
  assert.equal(g.custom, false, 'і це не «своя розкладка»')
  assert.equal(g.width, 3.6)

  const r = computeTramlines({ ...grain, coulters: ['а', 'б', 'в'], machines: [sprayer()] })
  assert.equal(r.ok, true)
  assert.ok(Number.isFinite(r.lossPct), `втрата ${r.lossPct}`)
  assert.equal(r.rows, 24)
})

// Нахльост рахується в метрах від позицій сошників, і зіпсоване число
// робило крок NaN: далі весь розрахунок ішов у нікуди.
test('зіпсований нахльост не робить крок NaN', () => {
  for (const overlapRows of [NaN, Infinity, -5, 2.4, null, undefined, true]) {
    const r = computeTramlines({ ...grain, machines: [sprayer()], overlapRows })
    assert.ok(Number.isFinite(r.step) && r.step > 0, `нахльост ${overlapRows}: крок ${r.step}`)
    assert.ok(Number.isInteger(r.overlapRows) && r.overlapRows >= 0,
      `нахльост ${overlapRows} дав ${r.overlapRows}`)
  }
})

// `Infinity > 0` — правда, і нескінченна ширина поля протікала далі: «поле
// Infinity га», «проходів Infinity».
test('нескінченна сторона поля — це не поле, а відсутність плану', () => {
  const r = computeTramlines({ ...grain, machines: [sprayer()] })
  for (const bad of [Infinity, -Infinity, NaN, null, 'абв']) {
    assert.equal(fieldPlan(r, { fieldWidth: bad, fieldLength: 800, rowSpacing: 0.15 }), null,
      `ширина ${bad}`)
    assert.equal(fieldPlan(r, { fieldWidth: 600, fieldLength: bad, rowSpacing: 0.15 }), null,
      `довжина ${bad}`)
  }
})

// Нахльост більший за сівалку обрізався молча, а далі відповідь бралася з
// припущення — і в ній від заданого числа не лишалося й слова.
test('обрізаний нахльост не губиться в припущенні', () => {
  const r = computeTramlines({ ...grain, machines: [sprayer()], overlapRows: 99 })
  assert.equal(r.ok, true)
  assert.ok(r.overlapRows <= 22, `нахльост ${r.overlapRows} при 24 сошниках`)
  assert.ok(r.warnings.some((w) => w.includes('більше, ніж сівалка може віддати')),
    `мусить бути попередження: ${JSON.stringify(r.warnings)}`)
})

// Закріплений головним обприскувач 12 м на сівалці 3,6 м не ділився, і
// головним мовчки ставав комбайн 9 м: колію різали під комбайн, а обприскувач
// їхав по посіву. Знайдено незалежною перевіркою «колеса проти рядків».
test('закріплена головна машина не підміняється тією, що поділилася', () => {
  const r = computeTramlines({
    ...grain,
    machines: [
      sprayer({ width: 12, base: true, axles: [{ trackWidth: 1.4, tyreWidth: 0.3 }] }),
      { id: 'c', kind: 'combine', label: 'Комбайн', width: 9,
        axles: [{ trackWidth: 2.9, tyreWidth: 0.8 }] },
    ],
  })
  assert.equal(r.ok, true)
  assert.equal(r.baseId, 's', `колію різали під «${r.baseLabel}»`)
  assert.equal(r.machines.find((m) => m.id === 's').fits, true, 'обприскувач поза колією')
  assert.ok(r.assumed, 'без припущення 12 м на 3,6 м не ділиться')
  assert.match(r.warnings[0], /припущенням/)
})

// Поле рівно на один прохід сівалки (і вужче) діставало відмову «обсів
// зʼїдає поле цілком», хоча обсіву не було: умова вимагала, щоб робоча
// частина була ширшою за крок. Вузьку смугу сіють одним неповним проходом.
test('поле на один прохід і вужче має план, а не відмову', () => {
  const r = computeTramlines({ ...grain, machines: [sprayer({ base: true })] })
  for (const width of [0.5, 2, 3.6, 5]) {
    const p = fieldPlan(r, { fieldWidth: width, fieldLength: 100, rowSpacing: 0.15 })
    assert.ok(p && !p.tooSmall, `поле ${width} м: плану немає`)
    assert.equal(p.passes.length, Math.ceil(width / 3.6 - 1e-9), `поле ${width} м`)
    const sown = p.passes.reduce((s, x) => s + x.sowing.length, 0)
    assert.equal(sown, Math.round(width / 0.15), `поле ${width} м: засіяно ${sown} рядків`)
  }
  const eaten = fieldPlan(r, { fieldWidth: 40, fieldLength: 100, headland: 20, rowSpacing: 0.15 })
  assert.equal(eaten.tooSmall, true, 'обсів на все поле — тоді відмова')
})

// Спосіб із половинним першим проходом писав «недосіву 4,5 % замість 5,2 %»,
// хоча половинний прохід нічого не міняв: 4,5 — недосів від поля, 5,2 — від
// циклу, і порівнювалися саме вони. Знайдено на проді: сівалка 24 × 15 см,
// обприскувач 24 м, колісна база 3 м, шина 0,5 м.
test('виграш від половинного проходу міряється одним і тим самим числом', async () => {
  const { solutions } = await import('../src/lib/solutions.js')
  const input = {
    ...grain, margin: 0.1,
    machines: [sprayer({ width: 24, base: true, axles: [{ trackWidth: 3, tyreWidth: 0.5 }] })],
  }
  const field = { fieldWidth: 600, fieldLength: 800, headland: 24 }
  for (const way of solutions(input, field)) {
    const claim = way.why.find((l) => l.includes('недосіву'))
    if (!claim) continue
    const [now, was] = [...claim.matchAll(/(\d+(?:,\d+)?) %/g)].map((m) => Number(m[1].replace(',', '.')))
    const plain = fieldPlan(computeTramlines({ ...input, ...way.patch, halfStart: false }),
      { ...field, rowSpacing: 0.15 })
    assert.ok(Math.abs(was - plain.lostPct) < 0.06,
      `«замість ${was} %», а без половинного проходу недосів ${plain.lostPct} %`)
    assert.ok(now < was, claim)
  }
})
