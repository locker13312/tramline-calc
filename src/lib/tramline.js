// ── Технологічна колія ────────────────────────────────────────────────────
//
// Колію нарізає сівалка під час сівби: частину висівних секцій вимикають,
// щоб на цих смугах нічого не зійшло, і потім по них їздять машини, не
// толочачи посів.
//
// Модель одновимірна — поле в розрізі поперек напрямку руху. Координата x
// відлічується від краю поля, у метрах. Усі машини заходять з одного краю:
// сівалка кладе проходи завширшки W, машина із захватом C — проходи
// завширшки C, тому її колеса в проході j стоять на (j + 0.5) · C ± T / 2.
//
// Машин на одній колії буває кілька: обприскувач, розкидач, на жнивах —
// комбайн і перевантажувач. У кожної свій захват, своя колісна база й своя
// шина, тож заглушити треба об'єднання їхніх смуг. Жодних окремих випадків
// це не вимагає: смуги складаються в один список, і сошник глушиться, якщо
// потрапив хоч в одну.

import { drillGeometry, minGap, tractorBands } from './geometry.js'
import { normaliseMachines } from './machines.js'

const EPS = 1e-9
const mm = (v) => Math.round(v * 1000) / 1000

export { coulterOffsets, drillGeometry, minGap } from './geometry.js'

export function drillWidth(rows, rowSpacing) {
  return rows * rowSpacing
}

// Скільки проходів сівалки вкладається в один прохід обприскувача.
export function ratioOf({ rows, rowSpacing, sprayerWidth }) {
  const W = drillWidth(rows, rowSpacing)
  return W > 0 ? sprayerWidth / W : 0
}

// Ширини, за яких колія взагалі можлива: захват машини має бути цілим
// числом проходів сівалки. Коли ділиться не націло — показуємо, що поміняти.
//
// sprayerWidth тут — те, що фізично є на дворі: розмах штанги. Купувати іншу
// штангу заради колії ніхто не буде, тому головна відповідь — не «зміни
// обприскувач», а «їдь цією ж штангою вужче»: перекривай сусідній прохід і
// вимикай крайні секції. Саме так 16-метрова штанга працює на 14,4 м.
export function suggestions({ rows, rowSpacing, sprayerWidth }) {
  const W = drillWidth(rows, rowSpacing)
  const sprayerWidths = []
  for (let k = 1; k <= 12; k++) {
    const w = mm(k * W)
    if (Math.abs(w - sprayerWidth) > 0.01) {
      sprayerWidths.push({
        k,
        width: w,
        // Ширину більшу за штангу взяти нізвідки — між проходами лишиться
        // необроблена смуга. Менша означає лише перекриття.
        fits: w <= sprayerWidth + 0.01,
        overlap: mm(sprayerWidth - w),
      })
    }
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
  return {
    sprayerWidths: sprayerWidths.slice(0, 8),
    drills: drills.slice(0, 8),
    working: workingWidths({ rows, rowSpacing, boomWidth: sprayerWidth }),
  }
}

// Робочі ширини під наявну штангу: скільки секцій сівалки реально сіє (r) і
// скільки таких проходів вкладається в один прохід обприскувача (k). Перекриття
// — те, що штанга накриває двічі; його або вимикають крайніми секціями, або
// миряться з подвійною дозою на цій смузі.
//
// Звужувати сівалку означає заглушити кілька секцій з одного боку назавжди:
// рама так само перекриває сусідній прохід, але жоден рядок не сіється двічі.
export function workingWidths({ rows, rowSpacing, boomWidth, limit = 4 }) {
  if (!(boomWidth > 0) || !(rowSpacing > 0) || !(rows >= 2)) return []

  const seen = new Map()
  for (let r = rows; r >= 2; r--) {
    for (let k = 1; k <= 12; k++) {
      const w = mm(r * rowSpacing * k)
      if (w > boomWidth + 1e-9) break          // далі по k тільки ширше
      const overlap = mm(boomWidth - w)
      // Перекриття більше за чверть штанги — це вже не робота, а катання.
      if (overlap > boomWidth / 4) continue
      const prev = seen.get(w)
      // Один і той самий захват дає кілька пар (r, k); лишаємо ту, де сівалка
      // ширша — менше проходів на поле.
      if (!prev || r > prev.rows) {
        const overlapPct = mm((overlap / boomWidth) * 100)
        const offPct = mm(((rows - r) / rows) * 100)
        seen.set(w, {
          rows: r,
          off: rows - r,
          k,
          width: w,
          overlap,
          overlapPct,
          offPct,
          // Дві втрати різної природи, зведені до спільної міри: скільки
          // відсотків роботи пропадає. Перекриття — в обприскувача, заглушені
          // секції — в сівалки. Без цього список очолюють варіанти на кшталт
          // «заглуши 11 секцій із 24, зате перекриття на 15 см менше»:
          // формально найточніші, а на полі — подвоєна сівба.
          cost: mm(overlapPct + offPct),
        })
      }
    }
  }

  return [...seen.values()]
    .filter((o) => o.off * 3 <= rows)   // різати сівалку більш ніж на третину не варіант
    .sort((a, b) => a.cost - b.cost || b.rows - a.rows)
    .slice(0, limit)
}

// Найбільший спільний дільник — щоб звести відношення захватів до
// нескоротного дробу.
function gcd(a, b) { return b ? gcd(b, a % b) : a }
function lcm(a, b) { return (a * b) / gcd(a, b) }

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

// Ритм — число, яке механізатор вводить у термінал і відраховує в кабіні.
//
// Межа стосується тільки того, наскільки ритм має право вирости через *другу*
// машину. Власний ритм головної машини не обмежуємо: сівалка 2,25 м під
// штангу 36 м дає ритм 16, і це робоче поєднання — проходи рахує термінал, а
// не людина. А от коли ритм розпухає через те, що в колію заводять ще одну
// машину, це вже не рішення: візерунок замикається так рідко, що на полі його
// ніхто не витримає. Такий варіант чесніше назвати несумісністю.
const MAX_RHYTHM = 12

/**
 * Розрахунок колії.
 *
 * rows, rowSpacing  рівномірна сівалка: секцій і міжряддя
 * coulters          або довільна розкладка: позиції сошників від краю, м
 * drillWidth        захват сівалки, якщо його не видно з розкладки
 * machines          машини, що поїдуть колією: захват, осі, шини
 * sprayerWidth,
 * trackWidth,
 * tyreWidth         стара коротка форма на одну машину — досі читається
 * margin            запас з кожного боку смуги, м
 * halfStart         почати поле половинним проходом сівалки
 * drillTractor      трактор сівалки: колія, шина, чи глушити свій слід
 *
 * Повертає цикл проходів: що робити на кожному, поки візерунок не повториться.
 */
export function computeTramlines(input) {
  const { rowSpacing, margin = 0.1, halfStart = false, drillTractor = null } = input

  const warnings = []
  const geo = drillGeometry(input)
  const W = geo.width
  const offsets = geo.offsets
  const rows = geo.rows

  const all = normaliseMachines(input)
  const active = all.filter((m) => m.active)

  // Машина ввімкнена, але без захвату або без жодної справної осі. Таку в
  // розрахунок не візьмеш, проте й промовчати не можна: людина стерла одне
  // поле, цифри поїхали, а причини не видно.
  for (const m of all) {
    if (!m.wanted || m.active) continue
    warnings.push(
      !(m.width > 0)
        ? `«${m.label}»: не заданий захват, тому машина в розрахунок не взята.`
        : `«${m.label}»: не задана колісна база або шина, тому машина в розрахунок не взята.`,
    )
  }

  // Відношення захвату кожної машини до захвату сівалки. Машина без робочого
  // відношення в колію не вкладається — але це не причина не відповісти про
  // решту: колію нарізають під головну машину, а про ту, що не вклалася,
  // скажемо окремо. Інакше один неправильно введений перевантажувач гасив би
  // усю відповідь.
  const fracOf = new Map()
  for (const m of active) fracOf.set(m.id, W > 0 ? asFraction(m.width / W) : null)

  // Крок колій задає найвужча машина — і це не умовність, а умова, за якої
  // спільна колія взагалі можлива.
  //
  // Колії лягають через захват базової машини. Ширша вкладає цей крок цілим
  // числом разів і їде кожною n-ю колією. Якби кроком узяли ширшу машину,
  // вужча потрапляла б у смугу лише на частині своїх проходів, а решту часу
  // їхала б по посіву — саме тому обприскувач 18 м і комбайн 9 м дають колію
  // через 9 м, а не через 18. Господар може закріпити базовою іншу машину,
  // але за замовчуванням програма ставить ту, з якої колія складається.
  const usable = active.filter((m) => fracOf.get(m.id))
  const pinned = active.find((m) => m.base && fracOf.get(m.id))
  let base = pinned
    || usable.slice().sort((a, b) => a.width - b.width || a.id.localeCompare(b.id))[0]
    || active[0]
    || null

  const baseFrac = base ? fracOf.get(base.id) : null
  if (!base || !baseFrac || baseFrac.p < 1) {
    const leadWidth = base?.width ?? input.sprayerWidth ?? 0
    const ratio = W > 0 ? leadWidth / W : 0
    return {
      ok: false, drillWidth: mm(W), ratio: mm(ratio), cycle: 0, passes: [],
      rows, coulters: offsets, machines: all, base: base || null, strips: [],
      warnings: [
        base
          ? `Захват «${base.label}» (${mm(leadWidth)} м) і захват сівалки (${mm(W)} м) ` +
            `не зводяться до робочого ритму — виходить ${mm(ratio)} проходу. ` +
            `Колеса щоразу падатимуть у нове місце.`
          : 'Не задано жодної машини, яка поїде колією — нема під що її нарізати.',
        // Попередження про незаповнені машини лишаються: саме вони часто й
        // є причиною того, що колія не складається.
        ...warnings,
      ],
      suggestions: suggestions({ rows, rowSpacing, sprayerWidth: leadWidth }),
    }
  }

  // Половинний перший прохід зсуває сітку сівалки на пів захвату — саме так
  // парний коефіцієнт перетворюють з двох половинок колії на одну цілу.
  const shift = halfStart ? W / 2 : 0

  // Слід трактора сівалки лягає на кожному її проході, тому це не колія, а
  // постійно вимкнені сошники. Глушать їх не всі — лише ті, хто вважає, що
  // зерно в ущільненому сліді все одно пропаде.
  //
  // Рахується до вибору розкладки навмисно: ці сошники глухнуть незалежно від
  // машин, але підбір відступів мусить це бачити. Інакше оптимізатор зводить
  // не те число — старається прибрати сошник, який і так уже заглушений.
  const ownBands = drillTractor?.closeOwnTracks
    ? tractorBands({ ...drillTractor, margin: drillTractor.margin ?? margin }, W)
    : []
  const inOwn = (local) => ownBands.some((s) => local >= s.from - EPS && local <= s.to + EPS)

  // ── Розкладка під задану базову машину ──────────────────────────────────
  //
  // Усе, що залежить від вибору кроку колій, зібрано тут: довжина циклу,
  // хто вкладається, хто ні, і з якого відступу кожному починати. Функцію
  // викликають по разу на кожну машину-кандидата, бо вибір базової —
  // рішення, а не даність, і наосліп його вгадувати не варто.
  const layoutFor = (lead) => {
    const leadFrac = fracOf.get(lead.id)
    if (!leadFrac) return null

    // Довжина циклу — спільна для всіх машин: найменше число проходів
    // сівалки, після якого візерунок повторюється в кожної з них. Одна машина
    // дає звичний ритм p, дві з різними захватами — їхнє спільне кратне.
    //
    // Якщо головна машина сама дає довгий ритм, друга має право його не
    // погіршувати — але й межа не може бути нижчою за те, що вже є.
    const limit = Math.max(MAX_RHYTHM, leadFrac.p)
    let k = leadFrac.p
    const fitting = [lead]
    const outsiders = []
    // Від вужчої до ширшої: вужча ближча до кроку колій, тож її смуги мають
    // більше шансів стати спільними, і цикл росте повільніше.
    for (const m of [...active].sort((a, b) => a.width - b.width)) {
      if (m === lead) continue
      const f = fracOf.get(m.id)
      const next = f ? lcm(k, f.p) : 0
      if (!f || next > limit) {
        outsiders.push({ machine: m, reason: f ? 'rhythm' : 'ratio', wouldBe: f ? next : null })
        continue
      }
      k = next
      fitting.push(m)
    }

    const period = mm(k * W)                   // довжина повного циклу

    // Візерунок циклічний з періодом period, тож положення звужуємо до одного
    // циклу. Колесо біля межі періоду переноситься на початок — це те саме
    // місце поля, бо прохід k + 1 є проходом 1 наступного циклу.
    const wrap = (x) => ((x % period) + period) % period
    const inAny = (x, list) => {
      const u = wrap(x)
      for (const s of list) {
        if (u >= s.from - EPS && u <= s.to + EPS) return true
        if (u - period >= s.from - EPS && u - period <= s.to + EPS) return true
        if (u + period >= s.from - EPS && u + period <= s.to + EPS) return true
      }
      return false
    }

    // Смуги під колесами. Кожна машина дає по дві смуги на вісь на кожному
    // своєму проході циклу; смуга підписана машиною й віссю, щоб потім було
    // видно, хто саме змусив заглушити сошник.
    //
    // phase — з якого відступу від краю поля машина починає перший прохід.
    // Для базової він нульовий за визначенням: саме її сітка і є сіткою колій.
    const stripsOf = (m, phase = 0) => {
      const f = fracOf.get(m.id)
      const q = Math.round((k * f.q) / f.p)    // проходів цієї машини за цикл
      const out = []
      for (let j = 0; j < q; j++) {
        const centre = (j + 0.5) * m.width + phase
        m.axles.forEach((a, ai) => {
          const half = a.tyreWidth / 2 + m.margin
          for (const sign of [-1, 1]) {
            const x = wrap(centre + sign * (a.trackWidth / 2))
            out.push({
              machine: m.id, label: m.label, kind: m.kind,
              axle: ai, axleCount: m.axles.length,
              pass: j + 1, passesPerCycle: q, phase: mm(phase),
              side: sign < 0 ? 'left' : 'right',
              trackWidth: a.trackWidth, tyreWidth: a.tyreWidth,
              centre: mm(x), from: mm(x - half), to: mm(x + half),
            })
          }
        })
      }
      return out
    }

    // ── Сошники циклу як бітова маска ─────────────────────────────────────
    //
    // Підбір відступів перебирає сотні варіантів на кожну машину, і кожен
    // треба оцінити: скільки сошників за цикл під ним глухне. Складати для
    // цього списки смуг і щоразу бігати по них виходило вісімдесят мілісекунд
    // на один розрахунок — помітна затримка на кожному натисканні у формі.
    //
    // Тому кожен набір смуг зводиться до маски: біт на кожну пару «прохід ×
    // сошник». Об'єднання смуг стає побітовим АБО, а ціна — кількістю
    // одиниць. Маска кожного відступу будується один раз і лишається в кеші,
    // тож повторні проходи оптимізатора вже нічого не коштують.
    const slots = k * rows
    const words = Math.max(1, Math.ceil(slots / 32))
    const maskOf = (list) => {
      const mask = new Uint32Array(words)
      for (let i = 0; i < k; i++) {
        const left = i * W - shift
        for (let j = 0; j < rows; j++) {
          if (inAny(left + offsets[j], list)) {
            const b = i * rows + j
            mask[b >>> 5] |= 1 << (b & 31)
          }
        }
      }
      return mask
    }
    // Слід трактора не залежить ні від машин, ні від відступів: він лягає на
    // кожному проході в тому самому місці рами.
    const ownMask = new Uint32Array(words)
    if (ownBands.length) {
      for (let i = 0; i < k; i++) {
        for (let j = 0; j < rows; j++) {
          if (inOwn(offsets[j])) {
            const b = i * rows + j
            ownMask[b >>> 5] |= 1 << (b & 31)
          }
        }
      }
    }
    const orAll = (...masks) => {
      const out = new Uint32Array(words)
      for (const m of masks) for (let i = 0; i < words; i++) out[i] |= m[i]
      return out
    }
    const bits = (mask) => {
      let n = 0
      for (let i = 0; i < words; i++) {
        let v = mask[i]
        v -= (v >>> 1) & 0x55555555
        v = (v & 0x33333333) + ((v >>> 2) & 0x33333333)
        n += (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
      }
      return n
    }

    // Залишений для звітів по машинах: там рахують по разу, і читабельність
    // важливіша за швидкість.
    const countFor = (list) => bits(orAll(maskOf(list), ownMask))

    // Сітка перебору відступів не випадкова. Пів кроку колій ставить машину
    // колесо в колесо з базовою; пів захвату сівалки вирівнює її з проходами
    // сівалки; пів власного захвату — той самий «половинний перший прохід»,
    // тільки для машини. Дрібний перебір через 5 см додається на той випадок,
    // коли жодне кругле значення не влучає, а зсув на 35 см ставить колесо
    // точно в міжряддя.
    const phaseGrid = (C) => {
      const round = new Set([0])
      for (const g of [lead.width / 2, W / 2, C / 2]) {
        if (!(g > EPS)) continue
        for (let x = g; x < C - EPS; x += g) round.add(mm(x))
      }
      const fine = []
      for (let x = 0.05; x < C - EPS; x += 0.05) {
        const v = mm(x)
        if (!round.has(v)) fine.push(v)
      }
      // Круглі значення йдуть першими й окремо: дрібне візьмемо лише тоді,
      // коли воно строго виграє в круглого. «Почни з половини проходу» —
      // вказівка, яку виконають, а «почни з 2,35 м» — ні, навіть якщо вона
      // на сошник вигідніша.
      return {
        round: [...round].sort((a, b) => a - b),
        fine: fine.sort((a, b) => a - b),
      }
    }

    // З якого відступу машині починати, щоб її колеса впали в уже нарізану
    // смугу.
    //
    // Це найдорожча кнопка в усьому розрахунку. Комбайн 9 м на коліях через
    // 9 м може їхати так, що кожен його прохід центрується на колії, — або
    // так, що жоден, і тоді замість восьми сошників глушити треба тридцять.
    // Різниця лише в тому, з якого краю він почав.
    //
    // Відступи підбираються не по черзі, а покоординатним доведенням: кожна
    // машина по колу перебирає свій відступ проти вже розставлених решти,
    // поки хоч одна знаходить краще. Жадібний прохід по черзі цього не дає —
    // вигідний відступ другої машини може загнати третю в глухий кут, і тоді
    // нулі для всіх виходять дешевшими за «оптимум». Старт із нулів і рух
    // лише на строге покращення гарантують, що гіршим за нулі результат не
    // буде.
    // Відступ базової машини теж буває заданий: тоді зсувається вся сітка
    // колій — «почни обприскувач за два метри від краю» зсуває кожну колію
    // на полі. За замовчуванням нуль: колії від самого краю.
    const fixed = (m) => (m.phase != null ? mm(((m.phase % m.width) + m.width) % m.width) : null)
    const phases = new Map(fitting.map((m) => [m.id, fixed(m) ?? 0]))
    const byMachine = new Map(fitting.map((m) => [m.id, stripsOf(m, phases.get(m.id))]))
    const masks = new Map(fitting.map((m) => [m.id, maskOf(byMachine.get(m.id))]))
    const movable = fitting.filter((m) => m !== lead && m.phase == null)

    const cache = new Map()
    const maskAt = (m, phase) => {
      const key = `${m.id}:${phase}`
      let got = cache.get(key)
      if (!got) { got = maskOf(stripsOf(m, phase)); cache.set(key, got) }
      return got
    }

    for (let sweep = 0; sweep < 4 && movable.length; sweep++) {
      let moved = false
      for (const m of movable) {
        const others = orAll(ownMask,
          ...fitting.filter((x) => x !== m).map((x) => masks.get(x.id)))
        const floor = bits(others)        // нижче не впасти: це ціна без машини
        const { round, fine } = phaseGrid(m.width)
        const now = phases.get(m.id)
        let best = { phase: now, cost: bits(orAll(others, masks.get(m.id))) }
        // Рушаємо з місця лише на строге покращення, тож за однакової ціни
        // лишається те, що вже стоїть, — а стоїть завжди кругле.
        for (const phase of round) {
          if (phase === now) continue
          const cost = bits(orAll(others, maskAt(m, phase)))
          if (cost < best.cost) best = { phase, cost }
        }
        // Дрібний перебір — тільки якщо кругле не впоралося. Коли машина вже
        // не додає жодного сошника, шукати далі нема чого.
        if (best.cost > floor) {
          for (const phase of fine) {
            const cost = bits(orAll(others, maskAt(m, phase)))
            if (cost < best.cost) best = { phase, cost }
            if (best.cost === floor) break
          }
        }
        if (best.phase !== now) {
          phases.set(m.id, best.phase)
          byMachine.set(m.id, stripsOf(m, best.phase))
          masks.set(m.id, maskAt(m, best.phase))
          moved = true
        }
      }
      if (!moved) break
    }

    const strips = fitting.flatMap((m) => byMachine.get(m.id))
    return {
      lead, k, period, limit, fitting, outsiders, phases, byMachine, strips,
      inAny, countFor, masks, ownMask, orAll, bits,
      cost: bits(orAll(ownMask, ...fitting.map((m) => masks.get(m.id)))),
    }
  }

  // ── Який крок колій брати ───────────────────────────────────────────────
  //
  // Крок задає одна машина, і за замовчуванням це найвужча: тільки її захват
  // усі інші вкладають цілим числом разів. Але «найвужча» — правило, а не
  // відповідь: буває, що з іншою базовою машиною в колію вкладається більше
  // машин або глушити доводиться менше сошників. Тому пробуємо кожну й
  // беремо найкращу — спершу за кількістю машин, що влізли, потім за
  // вимкненими сошниками, і вже на рівних за вузькістю.
  //
  // Порядок критеріїв саме такий, бо інакше «найдешевшим» виявився б варіант,
  // у якому половина парку просто випала з розрахунку.
  const candidates = pinned ? [pinned] : usable
  let layout = null
  for (const c of candidates) {
    const next = layoutFor(c)
    if (!next) continue
    if (!layout
      || next.fitting.length > layout.fitting.length
      || (next.fitting.length === layout.fitting.length && next.cost < layout.cost)
      || (next.fitting.length === layout.fitting.length && next.cost === layout.cost
        && next.lead.width < layout.lead.width)) {
      layout = next
    }
  }
  if (!layout) layout = layoutFor(base)

  const {
    k, period, limit, fitting, outsiders, phases, byMachine, strips,
    inAny, masks, ownMask, orAll, bits,
  } = layout
  base = layout.lead
  const S = mm(base.width)

  for (const m of fitting) {
    const widestTrack = Math.max(...m.axles.map((a) => a.trackWidth))
    const widestTyre = Math.max(...m.axles.map((a) => a.tyreWidth))
    if (widestTrack / 2 + widestTyre / 2 + m.margin > m.width / 2 + EPS) {
      warnings.push(
        `${m.label}: колісна база ${mm(widestTrack)} м із шиною ${mm(widestTyre)} м не ` +
        `вкладається у власний прохід ${mm(m.width)} м — перевірте вхідні дані.`,
      )
    }
    for (const a of m.axles) {
      if (a.trackWidth <= a.tyreWidth) {
        warnings.push(
          `${m.label}: колісна база ${mm(a.trackWidth)} м не може бути вужчою за шину ${mm(a.tyreWidth)} м.`,
        )
      }
    }
  }

  const passes = []
  for (let i = 0; i < k; i++) {
    const left = i * W - shift
    const right = left + W
    const disabled = []
    const reasons = new Map()        // id машини → сошники, що через неї глухнуть
    const clearances = []

    for (let m = 1; m <= rows; m++) {
      const x = left + offsets[m - 1]
      let hit = false
      for (const other of fitting) {
        if (inAny(x, byMachine.get(other.id))) {
          hit = true
          if (!reasons.has(other.id)) reasons.set(other.id, [])
          reasons.get(other.id).push(m)
        }
      }
      if (ownBands.length && inAny(x - left, ownBands)) {
        hit = true
        if (!reasons.has('drill-tractor')) reasons.set('drill-tractor', [])
        reasons.get('drill-tractor').push(m)
      }
      if (hit) disabled.push(m)
    }

    // Смуга, що лягла в цей прохід, але не зачепила жодного сошника: колесо
    // проходить міжряддям. Показуємо, скільки саме залишилось до рядка —
    // на соняшнику з міжряддям 70 см це типовий і найкращий результат.
    for (const s of strips) {
      if (s.to < left - EPS || s.from > right + EPS) continue
      const touches = offsets.some((o) => {
        const x = left + o
        return x >= s.from - EPS && x <= s.to + EPS
      })
      if (touches) continue
      let nearest = Infinity
      for (const o of offsets) {
        const x = left + o
        if (x < left - EPS || x > right + EPS) continue
        nearest = Math.min(nearest, Math.abs(x - s.centre))
      }
      if (Number.isFinite(nearest)) {
        clearances.push({
          machine: s.machine, label: s.label,
          centre: s.centre, gap: mm(nearest - s.tyreWidth / 2),
        })
      }
    }

    // Перший прохід половинний — засіяна лише та половина, що на полі.
    const partial = halfStart && i === 0
    const sowing = []
    if (partial) {
      for (let m = 1; m <= rows; m++) {
        if (left + offsets[m - 1] >= -EPS) sowing.push(m)
      }
    }

    passes.push({
      n: i + 1,
      from: mm(left), to: mm(right),
      disabled,
      reasons: [...reasons.entries()].map(([id, list]) => ({
        machine: id,
        label: id === 'drill-tractor'
          ? 'слід трактора сівалки'
          : (all.find((x) => x.id === id)?.label ?? id),
        rows: list,
      })),
      clearances, partial,
      sowingRows: partial ? sowing : null,
    })
  }

  const disabledPerCycle = passes.reduce((a, p) => a + p.disabled.length, 0)
  const rowsPerCycle = rows * k

  // Скільки сошників глухне через кожну машину — і скільки з них виключно
  // через неї. Друге число і є ціною того, щоб завести машину в колію: решту
  // глушили б і без неї.
  const machineReports = all.map((m) => {
    const f = fracOf.get(m.id)
    const out = outsiders.find((o) => o.machine.id === m.id)
    const isFitting = fitting.includes(m)
    const report = {
      id: m.id, kind: m.kind, label: m.label, width: mm(m.width),
      axles: m.axles, margin: m.margin, passesPerSeason: m.passes,
      active: m.active, base: m === base,
      fits: isFitting,
      phase: isFitting ? phases.get(m.id) : null,
      phaseFixed: m.phase != null,
      ratio: W > 0 ? mm(m.width / W) : 0,
      rhythm: f ? f.p : null,
      tyreWidth: m.axles.length ? mm(Math.max(...m.axles.map((a) => a.tyreWidth))) : 0,
      // 'off' — вимкнена свідомо, 'blank' — хотіли, але нема що рахувати.
      // Для картки це різні підписи, і плутати їх не можна.
      reason: out?.reason ?? (m.active ? null : (m.wanted ? 'blank' : 'off')),
      wouldBeRhythm: out?.wouldBe ?? null,
      passesPerCycle: isFitting && f ? Math.round((k * f.q) / f.p) : null,
    }

    if (!isFitting) {
      if (!m.active) return report
      // Чим це лікується: захвати, кратні сівалці (цілі й половинні),
      // найближчі до наявного. Половинні — бо асиметричний ритм теж робочий.
      const opts = new Set()
      for (let n = 1; n <= 2 * limit; n++) {
        const w = mm((n * W) / 2)
        if (w < W / 2 - EPS) continue
        const wf = asFraction(w / W)
        if (wf && lcm(baseFrac.p, wf.p) <= limit && Math.abs(w - m.width) > 0.01) opts.add(w)
      }
      report.options = [...opts]
        .sort((a, b) => Math.abs(a - m.width) - Math.abs(b - m.width))
        .slice(0, 4)
        .sort((a, b) => a - b)
      return report
    }

    const own = byMachine.get(m.id)
    const rest = fitting.filter((x) => x !== m).flatMap((x) => byMachine.get(x.id))
    // Скільки сошників ця машина глушить сама — без сліду трактора й без
    // решти парку. Саме це число порівнюють із тим, що вона додає.
    report.rowsIfAlone = bits(masks.get(m.id))
    report.rowsWithout = bits(orAll(ownMask,
      ...fitting.filter((x) => x !== m).map((x) => masks.get(x.id))))
    report.extraRows = disabledPerCycle - report.rowsWithout
    // Чи їде машина готовою смугою іншої, чи вимагає своєї: для кожного
    // колеса дивимось, чи накриває його смуга когось іншого.
    const shared = own.filter((s) => rest.some((r) => s.from < r.to + EPS && s.to > r.from - EPS))
    report.wheels = own.length
    report.wheelsShared = shared.length
    report.needsOwnBand = own.length > 0 && shared.length < own.length
    report.touchesRows = report.rowsIfAlone > 0
    if (!report.touchesRows) {
      const gaps = passes.flatMap((p) => p.clearances.filter((c) => c.machine === m.id).map((c) => c.gap))
      report.clearance = gaps.length ? mm(Math.min(...gaps)) : null
    }
    return report
  })

  if (disabledPerCycle === 0) {
    warnings.push(
      'Жоден сошник вимикати не треба — колеса вкладаються в міжряддя. ' +
      'Перевірте лише, щоб усі машини заходили в поле з того самого краю.',
    )
  }
  const hitPassCount = passes.filter((p) => p.disabled.length > 0).length
  if (fitting.length === 1 && baseFrac.q === 1 && k % 2 === 0 && !halfStart && hitPassCount > 1) {
    warnings.push(
      'Колія розпадається на два сусідні проходи: центр машини припадає ' +
      'на стик проходів сівалки. Увімкніть половинний перший прохід, щоб ' +
      'зробити її за один.',
    )
  }
  for (const o of outsiders) {
    warnings.push(
      o.reason === 'ratio'
        ? `«${o.machine.label}» (${mm(o.machine.width)} м) не кратний сівалці ${mm(W)} м — ` +
          'у колію не вкладається, тому в розрахунку не врахований.'
        : `«${o.machine.label}» (${mm(o.machine.width)} м) вимагав би ритму ${o.wouldBe} — ` +
          'такий цикл у кабіні не відрахувати, тому в розрахунку не врахований.',
    )
  }

  // Ритм — те, що вводять у термінал сівалки. Симетричний — уся колія лягає
  // в один прохід; асиметричний — по половині на різних проходах, і саме так
  // працюють половинні відношення на кшталт 4,5.
  const symmetric = hitPassCount <= 1

  return {
    ok: true,
    drillWidth: mm(W),
    coulters: offsets,
    rows,
    custom: geo.custom,
    minGap: minGap(offsets),
    // Ширина смуги, яку лишає один вимкнений сошник. У рівномірної сівалки
    // це міжряддя; у довільної розкладки міжряддя з форми вже ні про що не
    // каже, тож беремо найменший проміжок самої розкладки.
    stripWidth: mm(geo.custom ? minGap(offsets) : (rowSpacing || minGap(offsets))),
    sprayerWidth: S,
    baseWidth: S,
    baseLabel: base.label,
    baseId: base.id,
    machines: machineReports,
    fittingCount: fitting.length,
    ownBands,
    period,
    shift: mm(shift),
    ratio: mm(W > 0 ? base.width / W : 0),
    rhythm: k,
    symmetric,
    sprayerPassesPerCycle: Math.round((k * baseFrac.q) / baseFrac.p),
    basePassesPerCycle: Math.round((k * baseFrac.q) / baseFrac.p),
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
// Візерунок проходів має період k · W, тож картина по всій ширині — це той
// самий цикл, повторений потрібну кількість разів. Рахуємо його явно, а не
// множенням, бо поле майже ніколи не ділиться націло: останній прохід виходить
// неповним, і саме там ховаються зайві колії та недосіяні смуги.
export function fieldPlan(result, { fieldWidth, fieldLength, rowSpacing, headland = 0 }) {
  if (!result?.ok || !(fieldWidth > 0) || !(fieldLength > 0)) return null

  const W = result.drillWidth
  const S = result.baseWidth ?? result.sprayerWidth
  const k = result.cycle
  const shift = result.shift || 0
  const offsets = result.coulters

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

  // Проходи сівалки по робочій ширині.
  //
  // Крім вимкнених секцій кожен прохід має ще одну категорію — секції, що
  // висять за межею робочої частини: на половинному першому проході й на
  // останньому, неповному. Механізаторові це та сама дія (підняти секцію),
  // але причина інша, і плутати їх не можна: вимкнена секція нарізає колію,
  // а винесена за межу просто не має де сіяти.
  const rows = offsets.length
  const passes = []
  for (let i = 0; ; i++) {
    const from = x0 + i * W - shift
    if (from >= x1 - EPS) break
    const to = Math.min(from + W, x1)
    const inCycle = ((i % k) + k) % k
    const cyclePass = result.passes[inCycle]
    const disabled = cyclePass.disabled

    const outside = []
    const sowing = []
    for (let m = 1; m <= rows; m++) {
      const x = from + offsets[m - 1]
      if (x < x0 - EPS || x > x1 + EPS) outside.push(m)
      else if (!disabled.includes(m)) sowing.push(m)
    }

    passes.push({
      i: i + 1,
      cycleN: inCycle + 1,
      from: mm(Math.max(from, x0)),
      to: mm(to),
      width: mm(to - Math.max(from, x0)),
      full: from >= x0 - EPS && to >= from + W - EPS,
      disabled,
      reasons: cyclePass.reasons,
      // Вимикати на цьому проході доводиться і те, і те — разом і по порядку.
      outside,
      sowing,
      tramline: disabled.length > 0,
    })
  }

  // Колії: візерунок циклу, зсунутий на n · період. Візерунок повторюється
  // через період циклу (k проходів сівалки), а не через захват головної
  // машини: при асиметричному ритмі і при кількох машинах це різні довжини.
  const period = result.period || S
  const strips = []
  const sprayerPasses = Math.ceil(workWidth / S)
  const cycles = Math.ceil(workWidth / period)
  for (let n = 0; n < cycles; n++) {
    for (const s of result.strips) {
      const centre = x0 + s.centre + n * period
      if (centre < x0 || centre > x1) continue   // колія за межами робочої частини
      strips.push({
        ...s,
        // Номер смуги — це номер проходу головної машини, що нею їде: саме
        // ним орієнтуються в кабіні, а не номером циклу.
        pass: Math.floor((centre - x0) / S) + 1,
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
      const x = x0 + (p.i - 1) * W - shift + offsets[m - 1]
      if (x >= x0 - EPS && x <= x1 + EPS) disabledRows++
    }
  }

  const areaHa = mm((fieldWidth * fieldLength) / 10000)
  const workingHa = mm((workWidth * workLength) / 10000)
  // Ширина недосіяної смуги — міжряддя: зерно не впало, сусіди його частково
  // переростають, але площа лишається недосіяною.
  const strip = result.stripWidth || rowSpacing || result.minGap
  const lostHa = mm((disabledRows * strip * workLength) / 10000)

  // Скільки окремих коридорів лягло на поле. Два колеса однієї машини — одна
  // колія; дві машини, що їдуть тією самою смугою, — теж одна.
  const lanes = new Set(strips.map((s) => s.pass)).size

  return {
    fieldWidth, fieldLength,
    headland: H,
    workWidth: mm(workWidth),
    workLength: mm(workLength),
    passes,
    strips,
    sprayerPasses,
    basePasses: sprayerPasses,
    lastSprayerPass: mm(workWidth - (sprayerPasses - 1) * S),
    tramlines: lanes,
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
// Зворотна задача до головної. Замість «у тебе колесо стало на сошник 5 —
// глуши його» програма має казати «зсунь колісну базу на 70 см, і глушити не
// доведеться нічого». Різниця між 2,1 і 2,8 м на соняшнику — це кілька
// центнерів з поля, а коштує вона пів години з ключем.
//
// Рахуємо просто: беремо кожне правдоподібне значення бази й дивимось, чи
// проходять усі колеса міжряддям. Перебір дешевший за формулу й не бреше
// на крайніх випадках.

const TRACK_MIN = 1.2
const TRACK_MAX = 3.6
const TRACK_STEP = 0.05

// Відстань від точки до найближчого сошника. Сітка сошників періодична з
// періодом захвату сівалки, тож зводимо точку в один прохід і шукаємо
// найближчу позицію в розкладці — так працює і нерівномірна сівалка.
function distanceToCoulter(x, offsets, W) {
  const u = ((x % W) + W) % W
  let best = Infinity
  for (const o of offsets) {
    best = Math.min(best, Math.abs(u - o), Math.abs(u - o + W), Math.abs(u - o - W))
  }
  return best
}

// Значення колісної бази, за яких жодне колесо машини не стає на сошник.
export function trackOptionsFor({ machine, offsets, W, k, halfStart = false, limit = 4 }) {
  const f = asFraction(machine.width / W)
  if (!f) return null
  const q = Math.round((k * f.q) / f.p)
  const shift = halfStart ? W / 2 : 0
  const tyre = Math.max(...machine.axles.map((a) => a.tyreWidth))
  const half = tyre / 2 + machine.margin
  const gap = minGap(offsets)

  // Колесо ширше за міжряддя — жодна база не врятує, тільки глушити сошники.
  if (gap > 0 && gap <= tyre + 2 * machine.margin) {
    return { possible: false, rowSpacing: gap, need: mm(tyre + 2 * machine.margin), options: [] }
  }

  const raw = []
  for (let T = TRACK_MIN; T <= TRACK_MAX + EPS; T += TRACK_STEP) {
    const t = mm(T)
    const wheels = []
    // Перевіряємо всі проходи машини в циклі, а не лише перший: в
    // асиметричному ритмі їх два, і база має минати сошники в усіх.
    for (let j = 0; j < q; j++) {
      wheels.push((j + 0.5) * machine.width - t / 2, (j + 0.5) * machine.width + t / 2)
    }
    const worst = Math.min(...wheels.map((p) => distanceToCoulter(p + shift, offsets, W)))
    if (worst <= half + EPS) continue          // колесо чіпає сошник
    raw.push({ track: t, clearance: mm(worst - tyre / 2) })
  }

  // Сусідні значення дають майже однаковий просвіт — лишаємо з кожної групи
  // те, у якого він найбільший, інакше список перетворюється на кашу.
  const merged = []
  for (const o of raw) {
    const prev = merged[merged.length - 1]
    if (prev && gap > 0 && o.track - prev.track <= gap / 2 - EPS) {
      if (o.clearance > prev.clearance) merged[merged.length - 1] = o
      continue
    }
    merged.push(o)
  }

  const now = Math.max(...machine.axles.map((a) => a.trackWidth))
  const current = merged.find((o) => Math.abs(o.track - now) < TRACK_STEP / 2) || null
  const allAxlesGood = machine.axles.every((a) =>
    merged.some((o) => Math.abs(o.track - a.trackWidth) < TRACK_STEP / 2))

  return {
    possible: merged.length > 0,
    rowSpacing: gap,
    current,
    allAxlesGood,
    all: merged,
    // Найближчі до поточної — щоб не пропонувати перебудувати міст, коли
    // вистачить пересунути колесо на одне міжряддя.
    options: merged
      .slice()
      .sort((a, b) => Math.abs(a.track - now) - Math.abs(b.track - now))
      .slice(0, limit)
      .sort((a, b) => a.track - b.track),
  }
}

// Підбір бази для кожної машини плюс значення, добрі водночас для всіх: саме
// до них зводять колісні базы в господарствах, що тримають постійні колії.
export function suggestTracks(input) {
  const geo = drillGeometry(input)
  const W = geo.width
  if (!(W > 0)) return null
  const all = normaliseMachines(input).filter((m) => m.active && m.axles.length)
  if (!all.length) return null

  const base = all.find((m) => m.base) || all[0]
  const baseFrac = asFraction(base.width / W)
  if (!baseFrac) return null
  let k = baseFrac.p
  const limit = Math.max(MAX_RHYTHM, baseFrac.p)
  const fitting = [base]
  for (const m of all) {
    if (m === base) continue
    const f = asFraction(m.width / W)
    if (!f) continue
    const next = lcm(k, f.p)
    if (next > limit) continue
    k = next
    fitting.push(m)
  }

  const per = fitting.map((m) => ({
    id: m.id, label: m.label, kind: m.kind, width: m.width,
    axles: m.axles,
    ...trackOptionsFor({ machine: m, offsets: geo.offsets, W, k, halfStart: input.halfStart }),
  }))

  // Спільні значення: ті, що минають сошники в усіх машин одночасно.
  const sets = per.filter((p) => p.all?.length).map((p) => p.all.map((o) => o.track))
  const common = sets.length
    ? sets.reduce((acc, list) => acc.filter((t) => list.some((x) => Math.abs(x - t) < EPS)))
    : []

  const lead = per.find((p) => p.id === base.id) || per[0]
  return {
    // Сумісність із колишньою одномашинною відповіддю: головна машина.
    possible: !!lead?.possible,
    rowSpacing: lead?.rowSpacing ?? geo.minGapValue,
    need: lead?.need,
    current: lead?.current ?? null,
    options: lead?.options ?? [],
    machines: per,
    common,
  }
}

// Окремої функції «друга машина» тут колись була ціла сторінка: розкидач
// перевірявся на кратність обприскувачу й отримував свою пораду. Тепер цього
// не треба — і не можна. Розкидач став рядком у списку машин, і про нього
// відповідає та сама геометрія, що й про решту: не лише чи кратний захват, а
// й чи потрапляє його колесо в нарізану смугу. Стара функція відповідала на
// першу половину питання й мовчала про другу, тобто казала «іде кожною 2-ю
// колією» навіть тоді, коли колесо йшло поряд зі смугою, по посіву.

// Ритм для пари захватів — без колії, шини й решти: саме те, що показує
// паперовий довідник виробника. Використовується таблицею поєднань.
export function rhythmOf(sprayerWidth, drill) {
  const frac = drill > 0 ? asFraction(sprayerWidth / drill) : null
  if (!frac || frac.p < 1) return null
  return { rhythm: frac.p, symmetric: frac.q === 1 && frac.p % 2 === 1 }
}
