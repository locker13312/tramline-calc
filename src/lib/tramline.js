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
// Найбільший спільний дільник — щоб звести відношення захватів до
// нескоротного дробу.
function gcd(a, b) { return b ? gcd(b, a % b) : a }

// Відношення захватів як дріб p/q. Ціле число — звичайний ритм. Половина
// (4,5 · 5,5 …) — асиметричний: сівалка 4 м робить колію під обприскувач
// 18 м, глушачи то один бік, то другий, і візерунок повторюється через
// девʼять проходів замість чотирьох. Виробники такі ритми теж мають.
//
// Знаменник більший за два не беремо навмисно. Формально 3 м під 16 м дають
// «ритм 16» — візерунок, що замикається аж через три проходи обприскувача.
// Такого не робить жодна система, і механізатор такий цикл не відрахує;
// чесніше сказати «не поєднуються», ніж видати непрацездатну пораду.
function asFraction(r, maxQ = 2) {
  if (!(r > 0)) return null
  for (let q = 1; q <= maxQ; q++) {
    const p = r * q
    if (Math.abs(p - Math.round(p)) < 1e-6) {
      const P = Math.round(p)
      const g = gcd(P, q)
      return { p: P / g, q: q / g }
    }
  }
  return null
}

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
  const frac = W > 0 ? asFraction(ratio) : null
  const k = frac ? frac.p : 0            // проходів сівалки до повтору
  const q = frac ? frac.q : 0            // проходів обприскувача в тому ж циклі
  const whole = !!frac && k >= 1

  if (!whole) {
    return {
      ok: false, drillWidth: mm(W), ratio: mm(ratio), cycle: 0, passes: [],
      warnings: [
        `Захват обприскувача (${sprayerWidth} м) і захват сівалки (${mm(W)} м) ` +
        `не зводяться до робочого ритму — виходить ${mm(ratio)} проходу. ` +
        `Колеса щоразу падатимуть у нове місце.`,
      ],
      suggestions: suggestions({ rows, rowSpacing, sprayerWidth }),
    }
  }

  const S = mm(sprayerWidth)
  const period = k * W                         // довжина повного циклу
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

  // Колеса всіх проходів обприскувача, що вкладаються в один цикл. Для цілого
  // відношення такий прохід один, для половинного — два.
  const strips = []
  for (let j = 0; j < q; j++) {
    for (const centre of [(j + 0.5) * S - trackWidth / 2, (j + 0.5) * S + trackWidth / 2]) {
      strips.push({
        pass: j + 1,
        centre: mm(centre),
        from: mm(centre - half),
        to: mm(centre + half),
      })
    }
  }

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

  const hitPassCount = () => passes.filter((p) => p.disabled.length > 0).length
  const disabledPerCycle = passes.reduce((a, p) => a + p.disabled.length, 0)
  const rowsPerCycle = rows * k

  if (disabledPerCycle === 0) {
    warnings.push(
      'Жоден рядок вимикати не треба — колеса вкладаються в міжряддя. ' +
      'Перевірте лише, щоб сівалка й обприскувач заходили з того самого краю поля.',
    )
  }
  if (q === 1 && k % 2 === 0 && !halfStart && hitPassCount() > 1) {
    warnings.push(
      'Колія розпадається на два сусідні проходи: центр обприскувача припадає ' +
      'на стик проходів сівалки. Увімкніть половинний перший прохід, щоб ' +
      'зробити її за один.',
    )
  }

  // Ритм — це число, яке механізатор вводить у термінал сівалки: скільки
  // проходів до повтору візерунка. Симетричний — уся колія лягає в один
  // прохід; асиметричний — по половині на різних проходах, і саме так
  // працюють половинні відношення на кшталт 4,5.
  const hitPasses = passes.filter((p) => p.disabled.length).length
  const symmetric = hitPasses <= 1

  return {
    ok: true,
    drillWidth: mm(W),
    sprayerWidth: S,
    period: mm(period),
    shift: mm(shift),
    ratio: mm(ratio),
    rhythm: k,
    symmetric,
    sprayerPassesPerCycle: q,
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
export function fieldPlan(result, { fieldWidth, fieldLength, rowSpacing, headland = 0 }) {
  if (!result?.ok || !(fieldWidth > 0) || !(fieldLength > 0)) return null

  const W = result.drillWidth
  const S = result.sprayerWidth
  const k = result.cycle
  const shift = result.shift || 0

  // Обсів по периметру сіють окремо й по ньому ж розвертаються, тож колія в
  // ньому не потрібна — і не влазить: комбайн і обприскувач заходять у загінку
  // вже під кутом. Робоча частина поля — те, що лишилось усередині.
  const H = Math.max(0, headland)
  const x0 = H
  const x1 = fieldWidth - H
  const workWidth = x1 - x0
  const workLength = fieldLength - 2 * H
  if (workWidth <= W || workLength <= 0) {
    return { tooSmall: true, fieldWidth, fieldLength, headland: H,
      areaHa: mm((fieldWidth * fieldLength) / 10000) }
  }

  // Проходи сівалки по робочій ширині
  const passes = []
  for (let i = 0; ; i++) {
    const from = x0 + i * W - shift
    if (from >= x1 - EPS) break
    const to = Math.min(from + W, x1)
    const inCycle = ((i % k) + k) % k
    passes.push({
      i: i + 1,
      cycleN: inCycle + 1,
      from: mm(Math.max(from, x0)),
      to: mm(to),
      width: mm(to - Math.max(from, x0)),
      full: from >= x0 - EPS && to >= from + W - EPS,
      disabled: result.passes[inCycle].disabled,
    })
  }

  // Колії: візерунок першого проходу обприскувача, зсунутий на j · S.
  // Візерунок повторюється через період циклу (k проходів сівалки), а не
  // через захват обприскувача: при асиметричному ритмі це різні довжини.
  const period = result.period || S
  const strips = []
  const sprayerPasses = Math.ceil(workWidth / S)
  const cycles = Math.ceil(workWidth / period)
  for (let n = 0; n < cycles; n++) {
    for (const s of result.strips) {
      const centre = x0 + s.centre + n * period
      if (centre < x0 || centre > x1) continue   // колія за межами робочої частини
      strips.push({
        pass: n * result.sprayerPassesPerCycle + s.pass,
        centre: mm(centre),
        from: mm(Math.max(x0 + s.from + n * period, x0)),
        to: mm(Math.min(x0 + s.to + n * period, x1)),
      })
    }
  }

  // Втрачену площу рахуємо по фактично вимкнених рядках цього поля, а не
  // відсотком від циклу: неповний останній прохід дає інше число.
  let disabledRows = 0
  for (const p of passes) {
    for (const m of p.disabled) {
      const x = x0 + (p.i - 1) * W - shift + (m - 0.5) * rowSpacing
      if (x >= x0 - EPS && x <= x1 + EPS) disabledRows++
    }
  }

  const areaHa = mm((fieldWidth * fieldLength) / 10000)
  const workingHa = mm((workWidth * workLength) / 10000)
  const lostHa = mm((disabledRows * rowSpacing * workLength) / 10000)

  return {
    fieldWidth, fieldLength,
    headland: H,
    workWidth: mm(workWidth),
    workLength: mm(workLength),
    passes,
    strips,
    sprayerPasses,
    lastSprayerPass: mm(workWidth - (sprayerPasses - 1) * S),
    tramlines: strips.length / 2,
    tramlineKm: mm((strips.length * workLength) / 1000),
    disabledRows,
    areaHa,
    workingHa,
    headlandHa: mm(areaHa - workingHa),
    lostHa,
    lostPct: areaHa > 0 ? mm((lostHa / areaHa) * 100) : 0,
  }
}

// ── Підбір колії ──────────────────────────────────────────────────────────
//
// Зворотна задача до головної. Замість «у тебе колесо стало на рядок 5 —
// глуши його» програма має казати «зсунь колію на 70 см, і глушити не
// доведеться нічого». Різниця між 2,1 і 2,8 м колії на соняшнику — це
// кілька центнерів з поля, а коштує вона пів години з ключем.
//
// Рахуємо просто: беремо кожне правдоподібне значення колії й дивимось, чи
// проходять обидва колеса міжряддям. Перебір дешевший за формулу й не бреше
// на крайніх випадках.

const TRACK_MIN = 1.2
const TRACK_MAX = 3.6
const TRACK_STEP = 0.05

// Відстань від точки до найближчого центра рядка всередині проходу сівалки.
// Рядки лежать періодично через міжряддя, починаючи з півміжряддя від краю.
function distanceToRow(x, rowSpacing) {
  const u = ((x % rowSpacing) + rowSpacing) % rowSpacing
  return Math.abs(u - rowSpacing / 2)
}

export function suggestTracks({
  rows, rowSpacing, sprayerWidth, tyreWidth, margin = 0.1, trackWidth, halfStart = false,
}) {
  const W = drillWidth(rows, rowSpacing)
  const frac = W > 0 ? asFraction(sprayerWidth / W) : null
  if (!frac || frac.p < 1) return null

  const S = mm(sprayerWidth)
  const half = tyreWidth / 2 + margin
  const shift = halfStart ? W / 2 : 0

  // Колесо ширше за міжряддя — жодна колія не врятує, тільки глушити рядки.
  if (rowSpacing <= tyreWidth + 2 * margin) {
    return { possible: false, rowSpacing, need: mm(tyreWidth + 2 * margin), options: [] }
  }

  const options = []
  for (let T = TRACK_MIN; T <= TRACK_MAX + EPS; T += TRACK_STEP) {
    const t = mm(T)
    // Те саме положення коліс, що й у головному розрахунку.
    // Перевіряємо всі проходи обприскувача циклу, а не лише перший: в
    // асиметричному ритмі їх два, і колія має минати рядки в обох.
    const wheels = []
    for (let j = 0; j < frac.q; j++) {
      wheels.push((j + 0.5) * S - t / 2, (j + 0.5) * S + t / 2)
    }
    const worst = Math.min(...wheels.map(p => distanceToRow(p + shift, rowSpacing)))
    if (worst <= half + EPS) continue          // колесо чіпає рядок
    options.push({ track: t, clearance: mm(worst - tyreWidth / 2) })
  }

  // Сусідні значення дають майже однаковий просвіт — лишаємо з кожної групи
  // те, у якого він найбільший, інакше список перетворюється на кашу.
  const merged = []
  for (const o of options) {
    const prev = merged[merged.length - 1]
    if (prev && o.track - prev.track <= rowSpacing / 2 - EPS) {
      if (o.clearance > prev.clearance) merged[merged.length - 1] = o
      continue
    }
    merged.push(o)
  }

  const current = trackWidth != null
    ? merged.find(o => Math.abs(o.track - trackWidth) < TRACK_STEP / 2) || null
    : null

  return {
    possible: merged.length > 0,
    rowSpacing,
    current,                       // поточна колія вже добра?
    // Найближчі до поточної — щоб не пропонувати перебудувати міст, коли
    // вистачить пересунути колесо на одне міжряддя.
    options: merged
      .slice()
      .sort((a, b) => Math.abs(a.track - (trackWidth ?? 2.2)) - Math.abs(b.track - (trackWidth ?? 2.2)))
      .slice(0, 4)
      .sort((a, b) => a.track - b.track),
  }
}

// ── Друга машина на тих самих коліях ──────────────────────────────────────
//
// Розкидач добрив мусить їздити по вже нарізаних коліях, інакше він толочить
// посів і вся затія втрачає сенс. Колії лежать через захват обприскувача, тож
// розкидач потрапляє в них лише тоді, коли його захват кратний обприскувачу —
// і тоді він користується кожною n-ю колією.
export function secondMachine({ sprayerWidth, spreaderWidth, rows, rowSpacing }) {
  if (!(spreaderWidth > 0) || !(sprayerWidth > 0)) return null
  const W = drillWidth(rows, rowSpacing)
  const ratio = spreaderWidth / sprayerWidth
  const n = Math.round(ratio)
  const fits = Math.abs(ratio - n) < 1e-6 && n >= 1

  if (fits) {
    return {
      ok: true, every: n, spreaderWidth, sprayerWidth,
      note: n === 1
        ? 'Захвати збігаються — розкидач іде кожною колією.'
        : `Розкидач іде кожною ${n}-ю колією.`,
    }
  }

  // Що поміняти: захват обприскувача має бути кратним захвату сівалки і
  // водночас укладатися в захват розкидача ціле число разів.
  const fixes = []
  for (let k = 1; k <= 12; k++) {
    const S = mm(k * W)
    if (S <= 0) continue
    const r = spreaderWidth / S
    if (Math.abs(r - Math.round(r)) < 1e-6 && Math.round(r) >= 1) {
      fixes.push({ sprayerWidth: S, k, every: Math.round(r) })
    }
  }

  // Буває, що жоден захват обприскувача не влаштовує обидві машини — тоді
  // єдиний вихід із іншого боку: підібрати розкидач, кратний обприскувачу.
  const spreaderOptions = []
  for (let n = 1; n <= 4; n++) {
    const w = mm(n * sprayerWidth)
    if (Math.abs(w - spreaderWidth) > 0.01) spreaderOptions.push({ width: w, every: n })
  }

  return {
    ok: false, spreaderWidth, sprayerWidth, ratio: mm(ratio),
    fixes: fixes.slice(0, 6),
    spreaderOptions: spreaderOptions.slice(0, 4),
  }
}

// Ритм для пари захватів — без колії, шини й решти: саме те, що показує
// паперовий довідник виробника. Використовується таблицею поєднань.
export function rhythmOf(sprayerWidth, drill) {
  const frac = drill > 0 ? asFraction(sprayerWidth / drill) : null
  if (!frac || frac.p < 1) return null
  return { rhythm: frac.p, symmetric: frac.q === 1 && frac.p % 2 === 1 }
}
