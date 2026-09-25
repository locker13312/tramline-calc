// ── Технологічна колія ────────────────────────────────────────────────────
//
// Колію нарізає сівалка під час сівби: частину висівних секцій вимикають,
// щоб на цих смугах нічого не зійшло, і потім обприскувач та розкидач їздять
// по них, не толочачи посів.
//
// Модель одновимірна — поле в розрізі поперек напрямку руху. Координата x
// відлічується від краю поля, у метрах. Сівалка й обприскувач заходять з
// одного краю: сівалка кладе проходи завширшки W, обприскувач — S = k · W,
// тому його колеса в проході j стоять на (j + 0.5) · S ± T / 2.
//
// Усе інше — наслідки цієї геометрії, тож парний і непарний коефіцієнт k
// рахуються однією формулою, без окремих випадків.

const EPS = 1e-9
const mm = (v) => Math.round(v * 1000) / 1000

export function drillWidth(rows, rowSpacing) {
  return rows * rowSpacing
}

// Скільки проходів сівалки вкладається в один прохід обприскувача.
export function ratioOf({ rows, rowSpacing, sprayerWidth }) {
  const W = drillWidth(rows, rowSpacing)
  return W > 0 ? sprayerWidth / W : 0
}

// Ширини, за яких колія взагалі можлива: захват обприскувача має бути цілим
// числом проходів сівалки. Коли ділиться не націло — показуємо, що поміняти.
export function suggestions({ rows, rowSpacing, sprayerWidth }) {
  const W = drillWidth(rows, rowSpacing)
  const sprayerWidths = []
  for (let k = 1; k <= 12; k++) {
    const w = mm(k * W)
    if (Math.abs(w - sprayerWidth) > 0.01) sprayerWidths.push({ k, width: w })
  }
  // Та сама задача з іншого боку: залишаємо обприскувач, підбираємо сівалку.
  const drills = []
  for (let k = 1; k <= 12; k++) {
    const exactRows = sprayerWidth / (k * rowSpacing)
    const r = Math.round(exactRows)
    if (r >= 2 && Math.abs(exactRows - r) < 1e-6 && r !== rows) {
      drills.push({ k, rows: r, width: mm(r * rowSpacing) })
    }
  }
  return { sprayerWidths: sprayerWidths.slice(0, 8), drills: drills.slice(0, 8) }
}

/**
 * Розрахунок колії.
 *
 * rows         кількість висівних секцій (сошників) на сівалці
 * rowSpacing   міжряддя, м
 * sprayerWidth ширина захвату обприскувача, м
 * trackWidth   колія обприскувача — відстань між центрами коліс, м
 * tyreWidth    ширина шини, м
 * margin       запас з кожного боку смуги, м
 * halfStart    почати поле половинним проходом сівалки
 *
 * Повертає цикл проходів: що робити на кожному, поки візерунок не повториться.
 */
export function computeTramlines({
  rows,
  rowSpacing,
  sprayerWidth,
  trackWidth,
  tyreWidth,
  margin = 0.1,
  halfStart = false,
}) {
  const warnings = []
  const W = drillWidth(rows, rowSpacing)
  const ratio = W > 0 ? sprayerWidth / W : 0
  const k = Math.round(ratio)
  const whole = W > 0 && Math.abs(ratio - k) < 1e-6 && k >= 1

  if (!whole) {
    return {
      ok: false, drillWidth: mm(W), ratio: mm(ratio), cycle: 0, passes: [],
      warnings: [
        `Захват обприскувача (${sprayerWidth} м) не ділиться націло на захват сівалки ` +
        `(${mm(W)} м) — виходить ${mm(ratio)} проходу. Колія без цього неможлива: ` +
        `колеса щоразу падатимуть у нове місце.`,
      ],
      suggestions: suggestions({ rows, rowSpacing, sprayerWidth }),
    }
  }

  const S = k * W
  const half = tyreWidth / 2 + margin          // піврозмір смуги під одне колесо
  // Половинний перший прохід зсуває сітку сівалки на пів захвату — саме так
  // парний коефіцієнт перетворюють з двох половинок колії на одну цілу.
  const shift = halfStart ? W / 2 : 0

  if (trackWidth / 2 + half > S / 2) {
    warnings.push('Колія обприскувача ширша за його ж прохід — перевірте вхідні дані.')
  }
  if (trackWidth <= tyreWidth) {
    warnings.push('Колія обприскувача не може бути вужчою за шину.')
  }

  // Колеса першого проходу обприскувача. Далі візерунок повторюється з періодом S.
  const wheels = [S / 2 - trackWidth / 2, S / 2 + trackWidth / 2]
  const strips = wheels.map((centre) => ({
    centre: mm(centre),
    from: mm(centre - half),
    to: mm(centre + half),
  }))

  const passes = []
  for (let i = 0; i < k; i++) {
    const left = i * W - shift
    const right = left + W
    const disabled = []
    const clearances = []

    for (let m = 1; m <= rows; m++) {
      const x = left + (m - 0.5) * rowSpacing        // центр рядка секції m
      for (const s of strips) {
        if (x >= s.from - EPS && x <= s.to + EPS) { disabled.push(m); break }
      }
    }

    // Смуга, що лягла в цей прохід, але не зачепила жодного рядка: колесо
    // проходить міжряддям. Показуємо, скільки саме залишилось до рядка —
    // на соняшнику з міжряддям 70 см це типовий і найкращий результат.
    for (const s of strips) {
      if (s.to < left - EPS || s.from > right + EPS) continue
      const touches = disabled.some((m) => {
        const x = left + (m - 0.5) * rowSpacing
        return x >= s.from - EPS && x <= s.to + EPS
      })
      if (touches) continue
      let nearest = Infinity
      for (let m = 1; m <= rows; m++) {
        const x = left + (m - 0.5) * rowSpacing
        if (x < left - EPS || x > right + EPS) continue
        nearest = Math.min(nearest, Math.abs(x - s.centre))
      }
      if (Number.isFinite(nearest)) {
        clearances.push({ centre: s.centre, gap: mm(nearest - tyreWidth / 2) })
      }
    }

    // Перший прохід половинний — засіяна лише та половина, що на полі.
    const partial = halfStart && i === 0
    const sowing = []
    if (partial) {
      for (let m = 1; m <= rows; m++) {
        if (left + (m - 0.5) * rowSpacing >= -EPS) sowing.push(m)
      }
    }

    passes.push({
      n: i + 1,
      from: mm(left), to: mm(right),
      disabled, clearances, partial,
      sowingRows: partial ? sowing : null,
    })
  }

  const disabledPerCycle = passes.reduce((a, p) => a + p.disabled.length, 0)
  const rowsPerCycle = rows * k

  if (disabledPerCycle === 0) {
    warnings.push(
      'Жоден рядок вимикати не треба — колеса вкладаються в міжряддя. ' +
      'Перевірте лише, щоб сівалка й обприскувач заходили з того самого краю поля.',
    )
  }
  if (passes.filter((p) => p.disabled.length > 0).length > 1 && !halfStart) {
    warnings.push(
      'Колія розпадається на два сусідні проходи (парний коефіцієнт). ' +
      'Увімкніть половинний перший прохід, щоб зробити її за один.',
    )
  }

  return {
    ok: true,
    drillWidth: mm(W),
    sprayerWidth: mm(S),
    shift: mm(shift),
    ratio: k,
    cycle: k,
    parity: k % 2 === 0 ? 'even' : 'odd',
    strips,
    passes,
    disabledPerCycle,
    rowsPerCycle,
    lossPct: mm((disabledPerCycle / rowsPerCycle) * 100),
    warnings,
    suggestions: null,
  }
}

// ── Усе поле ──────────────────────────────────────────────────────────────
//
// Візерунок проходів має період S = k · W, тож картина по всій ширині — це той
// самий цикл, повторений потрібну кількість разів. Рахуємо його явно, а не
// множенням, бо поле майже ніколи не ділиться націло: останній прохід виходить
// неповним, і саме там ховаються зайві колії та недосіяні смуги.
export function fieldPlan(result, { fieldWidth, fieldLength, rowSpacing }) {
  if (!result?.ok || !(fieldWidth > 0) || !(fieldLength > 0)) return null

  const W = result.drillWidth
  const S = result.sprayerWidth
  const k = result.cycle
  const shift = result.shift || 0

  // Проходи сівалки по всій ширині поля
  const passes = []
  for (let i = 0; ; i++) {
    const from = i * W - shift
    if (from >= fieldWidth - EPS) break
    const to = Math.min(from + W, fieldWidth)
    const inCycle = ((i % k) + k) % k
    passes.push({
      i: i + 1,
      cycleN: inCycle + 1,
      from: mm(Math.max(from, 0)),
      to: mm(to),
      width: mm(to - Math.max(from, 0)),
      full: from >= -EPS && to >= from + W - EPS,
      disabled: result.passes[inCycle].disabled,
    })
  }

  // Колії: візерунок першого проходу обприскувача, зсунутий на j · S.
  const strips = []
  const sprayerPasses = Math.ceil(fieldWidth / S)
  for (let j = 0; j < sprayerPasses; j++) {
    for (const s of result.strips) {
      const centre = s.centre + j * S
      if (centre < 0 || centre > fieldWidth) continue   // колія за межами поля
      strips.push({
        pass: j + 1,
        centre: mm(centre),
        from: mm(Math.max(s.from + j * S, 0)),
        to: mm(Math.min(s.to + j * S, fieldWidth)),
      })
    }
  }

  // Втрачену площу рахуємо по фактично вимкнених рядках цього поля, а не
  // відсотком від циклу: неповний останній прохід дає інше число.
  let disabledRows = 0
  for (const p of passes) {
    for (const m of p.disabled) {
      const x = (p.i - 1) * W - shift + (m - 0.5) * rowSpacing
      if (x >= -EPS && x <= fieldWidth + EPS) disabledRows++
    }
  }

  const areaHa = mm((fieldWidth * fieldLength) / 10000)
  const lostHa = mm((disabledRows * rowSpacing * fieldLength) / 10000)

  return {
    fieldWidth, fieldLength,
    passes,
    strips,
    sprayerPasses,
    lastSprayerPass: mm(fieldWidth - (sprayerPasses - 1) * S),
    tramlines: strips.length / 2,
    tramlineKm: mm((strips.length * fieldLength) / 1000),
    disabledRows,
    areaHa,
    lostHa,
    lostPct: areaHa > 0 ? mm((lostHa / areaHa) * 100) : 0,
  }
}
