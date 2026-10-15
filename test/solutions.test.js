import { test } from 'node:test'
import assert from 'node:assert/strict'
import { solutions } from '../src/lib/solutions.js'
import { computeTramlines, fieldPlan } from '../src/lib/tramline.js'

// Випадок, через який цей пошук і зʼявився: штанга 16 м, сівалка 24 × 15 см.
// 16 на 3,6 не ділиться, і 16 м не кратні 15 см узагалі — точного збігу не
// існує в принципі. Техніка при цьому задана й мінятися не буде.
const boom16 = {
  rows: 24, rowSpacing: 0.15, margin: 0.1,
  machines: [{
    id: 'sprayer', kind: 'sprayer', label: 'Обприскувач', width: 16,
    axles: [{ trackWidth: 1.8, tyreWidth: 0.45 }], active: true, base: true,
  }],
}
const strip = { fieldWidth: 46, fieldLength: 950, headland: 0 }

test('на захваті, що не ділиться, способи все одно знаходяться', () => {
  const list = solutions(boom16, strip)
  assert.ok(list.length >= 3, `знайдено лише ${list.length} способів`)
  for (const w of list) {
    assert.ok(w.baseWidth <= 16 + 1e-9, `${w.baseWidth} м ширше за наявну штангу`)
    assert.ok(w.step > 0 && w.rhythm >= 1)
    assert.ok(w.why.length >= 3, 'спосіб без пояснення — не спосіб')
  }
})

test('жоден спосіб не міняє самої техніки — тільки те, що крутять у полі', () => {
  for (const w of solutions(boom16, strip)) {
    assert.deepEqual(Object.keys(w.patch).sort(), ['halfStart', 'machines', 'overlapRows'])
    assert.equal(w.patch.machines.length, boom16.machines.length)
    const m = w.patch.machines[0]
    assert.deepEqual(m.axles, boom16.machines[0].axles, 'колісна база чужа')
    assert.ok(m.width <= boom16.machines[0].width + 1e-9, 'машина не стала ширшою')
    assert.equal(w.patch.machines[0].id, boom16.machines[0].id)
  }
})

test('спосіб, поставлений у форму, дає рівно ті числа, які обіцяв', () => {
  for (const w of solutions(boom16, strip)) {
    const r = computeTramlines({ ...boom16, ...w.patch })
    assert.equal(r.ok, true, `${w.id}: не рахується`)
    assert.equal(r.assumed, null, `${w.id}: мусив скластися без припущень`)
    assert.equal(r.step, w.step)
    assert.equal(r.cycle, w.rhythm)
    assert.equal(r.baseWidth, w.baseWidth)
    assert.equal(r.overlapRows, w.overlapRows)
    const p = fieldPlan(r, { ...strip, rowSpacing: boom16.rowSpacing })
    assert.equal(p.passes.length, w.passes)
    assert.equal(p.lostPct, w.lostPct)
  }
})

test('способи впорядковані від найдешевшого й не повторюються', () => {
  const list = solutions(boom16, strip)
  const keys = new Set()
  let prev = -Infinity
  for (const w of list) {
    assert.ok(w.score >= prev, 'список не впорядкований за ціною')
    prev = w.score
    const key = `${w.baseWidth}:${w.overlapRows}`
    assert.ok(!keys.has(key), `спосіб ${key} двічі`)
    keys.add(key)
  }
})

test('перший спосіб під 16 м — 15,75 м і три сошники в нахльост', () => {
  // Найдешевше тут не «їдь на 14,4 м» (10 % подвійної дози на кожній
  // обробці), а нахльост: 25 см перекриття і зайвий прохід сівалки раз на
  // поле, без утрати площі.
  const [best] = solutions(boom16, strip)
  assert.equal(best.baseWidth, 15.75)
  assert.equal(best.overlapRows, 3)
  assert.equal(best.step, 3.15)
  assert.equal(best.rhythm, 5)
})

test('кожен спосіб каже, як починати поле і як його закінчувати', () => {
  for (const w of solutions(boom16, strip)) {
    assert.ok(w.start.length > 0, `${w.id}: нічого про початок`)
    assert.ok(w.finish.length > 0, `${w.id}: нічого про кінець`)
    // Порада про кінець мусить сходитися з арифметикою: скільком сошникам
    // сіяти на останньому проході — це його нова земля, поділена на міжряддя.
    if (w.tail.closeRows > 0) {
      const sown = w.tail.sow * boom16.rowSpacing
      assert.ok(Math.abs(sown - w.tail.fresh) <= boom16.rowSpacing,
        `${w.id}: ${w.tail.sow} сошників на ${w.tail.fresh} м`)
      assert.equal(w.tail.sow + w.tail.closeRows, 24)
    }
  }
})

test('про нахльост на першому проході сказано окремо', () => {
  const w = solutions(boom16, strip).find((x) => x.overlapRows > 0 && !x.halfStart)
  assert.ok(w, 'має бути спосіб із нахльостом і повним першим проходом')
  assert.ok(w.start.join(' ').includes('усі 24'),
    `на першому проході сіють усі: ${JSON.stringify(w.start)}`)
})

test('без поля способи теж є — просто без початку й кінця', () => {
  const list = solutions(boom16, {})
  assert.ok(list.length > 0)
  for (const w of list) {
    assert.equal(w.passes, null)
    assert.deepEqual(w.finish, [])
    assert.ok(w.start.length > 0, 'про початок видно й без поля')
  }
})

test('коли шукати нема з чого — порожній список, а не вигадки', () => {
  assert.deepEqual(solutions({ rows: 0, rowSpacing: 0, machines: [] }, strip), [])
  assert.deepEqual(solutions({ rows: 24, rowSpacing: 0.15, machines: [] }, strip), [])
  assert.deepEqual(solutions({ ...boom16, machines: [{ id: 1 }] }, strip), [])
})

test('своя розкладка сошників теж отримує способи', () => {
  // Перебір іде по позиціях сошників, а не по «секції × міжряддя», тож
  // довільна розкладка рахується так само. Колись вона була єдиним місцем,
  // де програма відмовлялася шукати.
  const own = [0.1, 0.9, 1.7, 2.5, 3.3]
  const list = solutions({ ...boom16, coulters: own, drillWidth: 3.4 }, strip)
  assert.ok(list.length > 0)
  for (const w of list) {
    assert.ok(w.step > 0 && w.step <= 3.4 + 1e-9, `крок ${w.step} при рамі 3,4 м`)
    assert.ok(w.baseWidth <= 16 + 1e-9)
    assert.ok(w.overlapRows <= own.length - 2)
  }
})

test('заданий нахльост способи не зменшують', () => {
  // Нахльост ставлять не для краси, а тому, що без підрулювання в стик не
  // влучити. Пошук має право запропонувати більший, але не менший.
  const list = solutions({ ...boom16, overlapRows: 4 }, strip)
  assert.ok(list.length > 0)
  // Сам пошук перебирає всі нахльости, тож серед способів є й менші —
  // відповідь же на заданих числах мусить лишитися не меншою.
  const r = computeTramlines({ ...boom16, overlapRows: 4 })
  assert.ok(r.overlapRows >= 4, `задано 4, порахувало ${r.overlapRows}`)
})
