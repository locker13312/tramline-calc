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

import { drillGeometry, minGap, overlapOf, resolveMargin, LIMITS } from './geometry.js'
import { normaliseMachines } from './machines.js'

const EPS = 1e-9
const mm = (v) => Math.round(v * 1000) / 1000

export { coulterOffsets, drillGeometry, minGap, resolveMargin, AUTO_MARGIN, LIMITS } from './geometry.js'

// Міжряддя, яким можна рахувати: сміття й нескінченність міжряддям не є.
// Нуль тут теж не міжряддя, а відсутність значення — звідси `|| minGap`
// у місцях, де воно лише підстраховка.
const spacingOf = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 && n <= LIMITS.rowSpacing ? n : 0
}

// Чого коштує заглушена крайня секція проти метра перекриття штанги.
const OFF_WEIGHT = 0.5

// ── Робочі ширини на весь парк ───────────────────────────────────────────
//
// Звузити одну машину мало. Крок колій спільний, і щойно він змінився,
// кожна машина парку мусить вкладати його цілим числом разів — інакше вона
// просто випадає з колії й їде по посіву. Саме це й ставалося: програма
// пропонувала «їдь комбайном 8,55 м», і обприскувач, який до того лягав у
// колію рівно, тихо з неї вилітав.
//
// Тому варіант — це не ширина однієї машини, а набір: крок сівалки й робоча
// ширина кожної машини під цей крок. Ширина береться найбільшою, яка в крок
// укладається: машина працює рівно тим, що має, мінус перекриття.
export function workingSets({ geo, machines, limit = 8 }) {
  const offsets = geo?.offsets ?? []
  const rows = offsets.length
  const frame = geo?.width ?? 0
  // Захват мусить бути числом, і не будь-яким: `Infinity > 0` — правда, і
  // нескінченна машина давала набір із «робочою шириною Infinity». Сюди
  // приходить і сміття з форми, тож перевірка тут, а не лише в нормалізації.
  const active = (machines ?? []).filter((m) => (
    m && m.active !== false
    && Number.isFinite(Number(m.width)) && m.width > 0 && m.width <= LIMITS.machineWidth
  )).map((m) => ({
    ...m,
    // Підбір шукає робочу ширину від розмаху машини, а не від тієї, якою
    // вона працює зараз: інакше вже поставлений спосіб звужував би список
    // наступних, і так щоразу.
    full: Number.isFinite(Number(m.fullWidth)) && m.fullWidth >= m.width
      ? Number(m.fullWidth)
      : m.width,
  }))
  if (!active.length || rows < 2 || !(frame > 0)) return []
  const lead = active.find((m) => m.base)
    || active.slice().sort((a, b) => a.width - b.width)[0]

  // Перебираємо кроки, а крок задає нахльост: скільком крайнім сошникам не
  // сіяти. Перебір іде по самих позиціях сошників, а не по «секції × міжряддя»,
  // тому однаково працює і для довільної розкладки — а колись саме на ній
  // програма й відмовлялася рахувати.
  const out = []
  for (let off = 0; off <= rows - 2; off++) {
    const o = overlapOf({ overlapRows: off }, geo)
    const step = o.step
    if (!(step > 0)) continue
    // Скільком проходів сівалки більше через нахльост: саме це за нього й
    // платять — зайвою соляркою й часом, раз на поле.
    const offPct = mm((off / (rows - off)) * 100)
    const per = active.map((m) => {
      const k = Math.floor((m.full + EPS) / step)
      const width = mm(k * step)
      const overlap = mm(m.full - width)
      return {
        id: m.id, label: m.label, was: mm(m.full), width, k, overlap,
        overlapPct: mm((overlap / m.full) * 100),
        // Перекриття більше за чверть захвату — це вже не робота, а
        // катання: машина возить по сусідньому проходу чверть себе.
        fits: k >= 1 && overlap <= m.full / 4 + EPS,
        // А чи є в неї взагалі робоча ширина під цей крок. Це інша межа:
        // перекриття в півмашини — поганий варіант, а машина, вужча за крок,
        // не варіант зовсім.
        works: k >= 1,
      }
    })
    const leadSet = per.find((x) => x.id === lead.id)
    if (!leadSet?.works) continue
    const good = per.filter((x) => x.fits)
    const overlapPct = good.length
      ? mm(good.reduce((a, x) => a + x.overlapPct, 0) / good.length)
      : leadSet.overlapPct
    out.push({
      off, rows: rows - off, step, overlapWidth: o.width, offPct,
      machines: per,
      outsiders: per.filter((x) => !x.fits),
      leadFits: leadSet.fits,
      overlapPct,
      // Ціна набору: перекриття в середньому по парку, зайвий прохід
      // сівалки — вполовину дешевший, і окремо найдорожче — машина, що з
      // колії випала. Остання не «гірший варіант», а інша задача: колію
      // нарізали, а машина по ній не їздить.
      cost: mm(overlapPct + offPct * OFF_WEIGHT + per.filter((x) => !x.fits).length * 20),
    })
  }

  // Набори, у яких головна машина працює по-людськи, і окремо — ті, де вона
  // возить по сусідньому проходу чверть себе й більше. Другі показуємо лише
  // тоді, коли перших немає: краще дорогий спосіб, ніж «колія не складеться».
  const sane = out.filter((c) => c.leadFits)
  return (sane.length ? sane : out)
    .sort((a, b) => a.cost - b.cost)
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
// MAX_RHYTHM стосується того, наскільки ритм має право вирости через *другу*
// машину. Власний ритм головної машини обмежений слабше: сівалка 2,25 м під
// штангу 36 м дає ритм 16, і це робоче поєднання — проходи рахує термінал, а
// не людина. А от коли ритм розпухає через те, що в колію заводять ще одну
// машину, це вже не рішення: візерунок замикається так рідко, що на полі його
// ніхто не витримає. Такий варіант чесніше назвати несумісністю.
//
// Але слабше — не значить ніяк. Захват 1008 м на сівалці 3,6 м давав «ритм
// 280»: формально правда, по суті нісенітниця, і ще й сотні мегабайтів на
// розрахунок. LIMITS.rhythm — стеля з запасом над усім, що існує: щоб її
// перевищити, потрібна машина, якої немає.
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
 * marginManual      запас задає людина, а не система
 * halfStart         почати поле половинним проходом сівалки
 * overlapRows       нахльост: скільки крайніх сошників закриває кожен
 *                   наступний прохід, бо йде по вже засіяному
 *
 * Повертає цикл проходів: що робити на кожному, поки візерунок не повториться.
 *
 * assume — припущення, з яким рахувати замість заданих чисел (робоча ширина
 * машини, нахльост). Їх підставляє computeTramlines нижче, коли на заданих
 * числах ритм не складається: відмова нікому не потрібна, потрібна відповідь
 * із чесно названим припущенням.
 */
function computeOnce(input, assume = null) {
  const { rowSpacing, halfStart = false } = input
  // Запас береться в одному місці на весь розрахунок: або той, що задала
  // людина, або той, який бере система. Інакше смуги машин і смуга трактора
  // сівалки могли розійтися на різні значення — на схемі це видно, а в
  // числах ні.
  const margin = resolveMargin(input)

  const warnings = []
  const geo = drillGeometry(input)
  const W = geo.width
  const offsets = geo.offsets
  const rows = geo.rows

  // Нахльост: сівалка переставляється не на свій захват, а на крок — захват
  // мінус те, чим вона заходить на вже засіяне. Далі в розрахунку W лишається
  // шириною рами (на ній стоять сошники), а кроком усього — D.
  const over = overlapOf({ overlapRows: assume?.overlapRows ?? input.overlapRows }, geo)
  // Те, що задала людина, — окремо від того, з чим рахуємо: зауваження про
  // завеликий нахльост стосується її числа, і воно однакове що з
  // припущенням, що без нього.
  const asked = overlapOf(input, geo)
  const D = over.step > 0 ? over.step : W
  if (over.rows > 0 && !(over.step > 0)) {
    warnings.push(
      `Нахльост ${over.rows} ` +
      'сошників не лишає сівалці кроку — рахую без нахльоста. Перевірте захват ' +
      'сівалки: при своїй розкладці він задається окремо.',
    )
  }
  const overRows = over.step > 0 ? over.rows : 0
  const overWidth = over.step > 0 ? over.width : 0
  if (asked.clamped) {
    warnings.push(
      `Нахльост ${asked.clamped} сошників — це більше, ніж сівалка може віддати. ` +
      `Рахую з ${asked.rows}: щонайменше два сошники мусять сіяти.`,
    )
  }

  // Числа поза межами моделі — це описка, а не велика сівалка. Відповідь на
  // неї мусить бути реченням, а не підвисанням: обсяг розрахунку залежить
  // від самих чисел, і зайвий нуль у міжрядді з'їдає пам'ять браузера.
  const outOfRange = (() => {
    const spacing = Number(input.rowSpacing)
    if (geo.overflow > 0) {
      return `Сошників більше за ${LIMITS.coulters} — стільки не має жодна сівалка. ` +
        'Перевірте, чи не зайвий нуль у кількості.'
    }
    if (Number.isFinite(spacing) && spacing > LIMITS.rowSpacing) {
      return `Міжряддя ${mm(spacing)} м — це вже не міжряддя. ` +
        `Розрахунок працює до ${LIMITS.rowSpacing} м.`
    }
    if (W > LIMITS.drillWidth) {
      return `Захват сівалки ${mm(W)} м більший за будь-який існуючий. ` +
        `Розрахунок працює до ${LIMITS.drillWidth} м.`
    }
    return null
  })()

  // Сівалки ще немає: стерте поле сошників, стерте міжряддя, недописана
  // розкладка. Це не «колія не складається» — це нема з чого її рахувати, і
  // сказати треба саме так: людина якраз зараз набирає числа, і «захват
  // сівалки 0 м не зводиться до робочого ритму» звучить як поломка.
  const noDrill = (!(W > 0) || rows < 2)
    ? 'Сівалка ще не задана: потрібні кількість сошників (щонайменше дві) і міжряддя.'
    : null

  if (outOfRange || noDrill) {
    return {
      ok: false, fail: 'drill',
      drillWidth: Number.isFinite(W) ? mm(W) : 0, step: Number.isFinite(D) ? mm(D) : 0,
      overlapRows: 0, overlapWidth: 0, ratio: 0, cycle: 0, passes: [],
      rows, coulters: offsets, machines: normaliseMachines(input), base: null, strips: [],
      warnings: [outOfRange || noDrill],
      suggestions: null,
    }
  }

  // Робочі ширини з припущення діють на весь парк: крок колій спільний, і
  // під нього підганяється кожна машина, а не лише та, під яку різали
  // колію. Її ж припущення закріплює базовою — вибирати іншу вже нема сенсу.
  const all = normaliseMachines(input).map((m) => {
    if (!assume) return m
    const width = assume.widths.get(m.id)
    return width > 0
      ? {
        ...m,
        width: mm(width),
        fullWidth: Math.max(m.fullWidth ?? m.width, m.width),
        base: m.id === assume.baseId,
        tooWide: false,
      }
      : { ...m, base: false }
  })
  // Межа на кількість машин: більше десяти на одній колії не їздить навіть у
  // найбільшому господарстві, а перебір росте як машини × варіанти × смуги.
  // Зайві не губляться молча — про них є попередження нижче.
  const active = all.filter((m) => m.active).slice(0, LIMITS.machines)
  const dropped = all.filter((m) => m.active).length - active.length
  if (dropped > 0) {
    warnings.push(
      `Машин у колії більше за ${LIMITS.machines} — останні ${dropped} в розрахунок не взяті. ` +
      'Колію нарізають під ті машини, що справді їздять по вегетації; решту краще вимкнути.',
    )
  }
  for (const m of all) {
    if (m.tooWide && m.wanted) {
      warnings.push(
        `«${m.label}»: захват ${mm(m.width)} м більший за будь-який існуючий — ` +
        'машина в розрахунок не взята. Перевірте, чи не зайвий нуль.',
      )
    }
  }

  // Машина ввімкнена, але без захвату або без жодної справної осі. Таку в
  // розрахунок не візьмеш, проте й промовчати не можна: людина стерла одне
  // поле, цифри поїхали, а причини не видно.
  for (const m of all) {
    if (!m.wanted || m.active || m.tooWide) continue
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
  for (const m of active) fracOf.set(m.id, D > 0 ? asFraction(m.width / D) : null)

  // Крок колій задає найвужча машина — і це не умовність, а умова, за якої
  // спільна колія взагалі можлива.
  //
  // Колії лягають через захват базової машини. Ширша вкладає цей крок цілим
  // числом разів і їде кожною n-ю колією. Якби кроком узяли ширшу машину,
  // вужча потрапляла б у смугу лише на частині своїх проходів, а решту часу
  // їхала б по посіву — саме тому обприскувач 18 м і комбайн 9 м дають колію
  // через 9 м, а не через 18. Господар може закріпити базовою іншу машину,
  // але за замовчуванням програма ставить ту, з якої колія складається.
  // Базовою може бути лише машина, що дає відрахований цикл. Решта стають
  // «не вкладається» з підказкою робочих захватів — як і будь-яка інша
  // машина, що не вписалася.
  const usable = active.filter((m) => {
    const f = fracOf.get(m.id)
    return f && f.p <= LIMITS.rhythm
  })
  const pinned = usable.find((m) => m.base)
  let base = pinned
    || usable.slice().sort((a, b) => a.width - b.width || a.id.localeCompare(b.id))[0]
    || active[0]
    || null

  const baseFrac = base ? fracOf.get(base.id) : null
  if (!base || !baseFrac || baseFrac.p < 1 || baseFrac.p > LIMITS.rhythm) {
    const leadWidth = base?.width ?? input.sprayerWidth ?? 0
    const ratio = D > 0 ? leadWidth / D : 0
    // Коли нахльост заданий, у реченні про невдачу мусить стояти крок, а не
    // захват рами: саме крок не поділився, і саме його міняють нахльостом.
    const stepText = overRows > 0
      ? `крок сівалки ${mm(D)} м (рама ${mm(W)} м мінус нахльост ${mm(overWidth)} м)`
      : `захват сівалки ${mm(W)} м`
    return {
      ok: false, fail: base ? 'ratio' : 'machines',
      drillWidth: mm(W), step: mm(D), overlapRows: overRows, overlapWidth: mm(overWidth),
      ratio: mm(ratio), cycle: 0, passes: [],
      rows, coulters: offsets, machines: all, base: base || null, strips: [],
      warnings: [
        !base
          ? 'Не задано жодної машини, яка поїде колією — нема під що її нарізати.'
          : baseFrac && baseFrac.p > LIMITS.rhythm
            ? `Захват «${base.label}» (${mm(leadWidth)} м) на сівалці ${mm(W)} м дав би цикл ` +
              `на ${baseFrac.p} проходів. Такого не відрахує ні механізатор, ні термінал — ` +
              'перевірте, чи не зайвий нуль у захваті.'
            : `Захват «${base.label}» (${mm(leadWidth)} м) і ${stepText} ` +
              `не зводяться до робочого ритму — виходить ${mm(ratio)} проходу. ` +
              `Колеса щоразу падатимуть у нове місце.`,
        // Попередження про незаповнені машини лишаються: саме вони часто й
        // є причиною того, що колія не складається.
        ...warnings,
      ],
      suggestions: null,
    }
  }

  // Половинний перший прохід зсуває сітку сівалки на півкроку — саме так
  // парний коефіцієнт перетворюють з двох половинок колії на одну цілу.
  const shift = halfStart ? D / 2 : 0

  // Сошники, що йдуть по нахльосту, закриті на кожному проході, крім
  // найпершого на полі: під ними вже є рядок, покладений сусіднім проходом.
  // Для циклу вони просто закриті — і саме тому не губиться жодної площі:
  // колія тут ні до чого, сіє сусід.
  const overClosed = Array.from({ length: overRows }, (_, i) => i + 1)

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

    const period = mm(k * D)                   // довжина повного циклу

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
        const left = i * D - shift
        // Сошники нахльоста пропускаємо: вони й так закриті, а рядок під
        // ними кладе сусідній прохід — і якщо колесо стало саме туди,
        // глушити доведеться той сошник сусіда, не цей. Він перевіряється
        // на своєму місці, бо позиції тут абсолютні.
        for (let j = overRows; j < rows; j++) {
          if (inAny(left + offsets[j], list)) {
            const b = i * rows + j
            mask[b >>> 5] |= 1 << (b & 31)
          }
        }
      }
      return mask
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
    const countFor = (list) => bits(maskOf(list))

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
        // Крок може бути як завгодно малим проти захвату, тож кількість
        // значень обмежуємо явно: сітка — спосіб знайти відповідь, а не
        // спосіб перебрати все на світі.
        const steps = Math.min(Math.ceil(C / g), 400)
        for (let i = 1; i < steps; i++) round.add(mm(i * g))
      }
      // Дрібний перебір теж із межею: для 36-метрової штанги це 5 см, для
      // ширшої — рівно стільки, щоб варіантів лишилося чотириста.
      const step = Math.max(0.05, C / 400)
      const fine = []
      for (let x = step; x < C - EPS; x += step) {
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

    // Бюджет на перебір. Витрачається на оцінки варіантів; коли закінчився,
    // доведення спиняється на тому, що вже знайдено. Відступи рухаються лише
    // на строге покращення, тож обірваний пошук дає гірший варіант, а не
    // хибний — і це краще, ніж форма, яка не відповідає на натискання.
    let budget = LIMITS.searchEvals

    for (let sweep = 0; sweep < 4 && movable.length && budget > 0; sweep++) {
      let moved = false
      for (const m of movable) {
        if (budget <= 0) break
        const others = orAll(
          ...fitting.filter((x) => x !== m).map((x) => masks.get(x.id)))
        const floor = bits(others)        // нижче не впасти: це ціна без машини
        const { round, fine } = phaseGrid(m.width)
        const now = phases.get(m.id)
        let best = { phase: now, cost: bits(orAll(others, masks.get(m.id))) }
        // Рушаємо з місця лише на строге покращення, тож за однакової ціни
        // лишається те, що вже стоїть, — а стоїть завжди кругле.
        for (const phase of round) {
          if (phase === now || budget-- <= 0) continue
          const cost = bits(orAll(others, maskAt(m, phase)))
          if (cost < best.cost) best = { phase, cost }
        }
        // Дрібний перебір — тільки якщо кругле не впоралося. Коли машина вже
        // не додає жодного сошника, шукати далі нема чого.
        if (best.cost > floor && budget > 0) {
          for (const phase of fine) {
            if (budget-- <= 0) break
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
      inAny, countFor, masks, orAll, bits,
      cost: bits(orAll(...fitting.map((m) => masks.get(m.id)))),
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
  // Перебираємо не всі машини як базові, а шість найвужчих: ширша за них
  // кроком колій бути не може без того, щоб вужчі з колії випали, а кожен
  // кандидат — це повна розкладка з підбором відступів.
  const candidates = pinned
    ? [pinned]
    : usable.slice().sort((a, b) => a.width - b.width || a.id.localeCompare(b.id)).slice(0, 6)
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
    inAny, masks, orAll, bits,
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
    const left = i * D - shift
    const right = left + W
    const disabled = []
    const reasons = new Map()        // id машини → сошники, що через неї глухнуть
    const clearances = []

    for (let m = overRows + 1; m <= rows; m++) {
      const x = left + offsets[m - 1]
      let hit = false
      for (const other of fitting) {
        if (inAny(x, byMachine.get(other.id))) {
          hit = true
          if (!reasons.has(other.id)) reasons.set(other.id, [])
          reasons.get(other.id).push(m)
        }
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
      for (let m = overRows + 1; m <= rows; m++) {
        if (left + offsets[m - 1] >= -EPS) sowing.push(m)
      }
    }

    passes.push({
      n: i + 1,
      from: mm(left), to: mm(right),
      // Де починається нова земля цього проходу: решта рами йде по нахльосту,
      // над рядками сусіда. Без нахльоста це просто край рами.
      newFrom: mm(left + overWidth),
      disabled,
      // Закриті нахльостом — окремим списком, бо це інша дія й інша причина:
      // їх закривають раз і на все поле, а не на конкретному проході циклу.
      overlapClosed: overClosed,
      reasons: [...reasons.entries()].map(([id, list]) => ({
        machine: id,
        label: all.find((x) => x.id === id)?.label ?? id,
        rows: list,
      })),
      clearances, partial,
      sowingRows: partial ? sowing : null,
    })
  }

  const disabledPerCycle = passes.reduce((a, p) => a + p.disabled.length, 0)
  // Рядків за цикл — лише ті, що справді сіються: сошник у нахльості не
  // пропущений рядок, а той самий рядок сусіднього проходу.
  const rowsPerCycle = (rows - overRows) * k

  // Скільки сошників глухне через кожну машину — і скільки з них виключно
  // через неї. Друге число і є ціною того, щоб завести машину в колію: решту
  // глушили б і без неї.
  const machineReports = all.map((m) => {
    const f = fracOf.get(m.id)
    const out = outsiders.find((o) => o.machine.id === m.id)
    const isFitting = fitting.includes(m)
    const report = {
      id: m.id, kind: m.kind, label: m.label, width: mm(m.width),
      fullWidth: mm(Math.max(m.fullWidth ?? m.width, m.width)),
      axles: m.axles, margin: m.margin, passesPerSeason: m.passes,
      active: m.active, base: m === base,
      // Крок колій програма вибирає сама — найвужчою машиною, — але господар
      // має право закріпити іншу. Різниця між «вибрано само» і «закріплено
      // вручну» видна лише тут: без неї прапорець у формі нічого не міняв на
      // вигляд, і виглядало це як несправна кнопка.
      basePinned: !!m.base,
      fits: isFitting,
      phase: isFitting ? phases.get(m.id) : null,
      phaseFixed: m.phase != null,
      ratio: D > 0 ? mm(m.width / D) : 0,
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
        const w = mm((n * D) / 2)
        if (w < D / 2 - EPS) continue
        const wf = asFraction(w / D)
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
    report.rowsWithout = bits(orAll(
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
  // Машина, що в колію не вклалася, — не привід її міняти. Привід працювати
  // нею вужче: найбільша ширина, яка в крок укладається, рахується тут же й
  // називається одразу. Без цього попередження виглядало як «ця машина
  // зайва», хоч насправді вона робоча — просто не на повний розмах.
  const workable = (m) => {
    const times = Math.floor((m.width + EPS) / D)
    if (times < 1) return null
    const f = asFraction(mm(times * D) / D)
    if (!f || lcm(k, f.p) > limit) return null
    return mm(times * D)
  }
  for (const o of outsiders) {
    const fit = workable(o.machine)
    warnings.push(
      (o.reason === 'ratio'
        ? `«${o.machine.label}» (${mm(o.machine.width)} м) не кратний кроку сівалки ${mm(D)} м — ` +
          'у колію не вкладається, тому в розрахунку не врахований.'
        : `«${o.machine.label}» (${mm(o.machine.width)} м) вимагав би ритму ${o.wouldBe} — ` +
          'такий цикл у кабіні не відрахувати, тому в розрахунку не врахований.')
      + (fit
        ? ` Щоб вона їздила цією ж колією, працюйте нею ${fit} м: ` +
          `${mm(o.machine.width - fit)} м піде в перекриття сусіднього проходу. ` +
          'У способах цей варіант порахований цілком.'
        : ''),
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
    stripWidth: mm(geo.custom ? minGap(offsets) : (spacingOf(rowSpacing) || minGap(offsets))),
    sprayerWidth: S,
    baseWidth: S,
    baseLabel: base.label,
    baseId: base.id,
    machines: machineReports,
    fittingCount: fitting.length,
    // Крок сівалки й нахльост: з них видно, чому відношення захватів саме
    // таке, і ними ж міряються проходи по полю.
    step: mm(D),
    overlapRows: overRows,
    overlapWidth: mm(overWidth),
    overlapClosed: overClosed,
    period,
    shift: mm(shift),
    ratio: mm(D > 0 ? base.width / D : 0),
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
    lossPct: rowsPerCycle > 0 ? mm((disabledPerCycle / rowsPerCycle) * 100) : 0,
    warnings,
    suggestions: null,
    assumed: assume,
  }
}

// ── Відповідь мусить бути завжди ──────────────────────────────────────────
//
// «Колія не складається» — чесна, але безкорисна відповідь: людина прийшла
// не дізнатися, що її числа не діляться, а дізнатися, що робити на сівбі.
// Захвати на дворі такі, які є: штангу 16 м ніхто не поміняє, міжряддя 15 см
// теж, а 16 ÷ 3,6 не поділиться ніколи — у 16 м рівно 106⅔ міжряддя.
//
// Тому коли ритм не складається, програма не спиняється, а бере найдешевше
// припущення з тих, що сама ж і пропонує: машина працює трохи вужче, а зайві
// крайні сошники йдуть у нахльост. І каже про це прямо — яке саме припущення
// і чого воно коштує. Решта варіантів лишається в «як із цього вийти», і
// будь-який підставляється у форму одним натисканням.
//
// Припущення ніколи не підмінює заданих чисел молча: воно є в `assumed`,
// названо першим рядком відповіді, і кожна його частина — те саме, що
// господар міг поставити у формі руками.
// Розрахунок строго на заданих числах: нічого не припускає, а коли ритм не
// складається — так і каже. Потрібен пошукові способів: той сам перебирає
// варіанти, і вкладений підбір усередині кожного був би тим самим перебором
// ще раз, тільки вчетверо дорожчим.
export const computeExact = (input) => computeOnce(input)

export function computeTramlines(input) {
  const direct = computeOnce(input)
  // Припущення — тільки там, де колії немає зовсім. Якщо на заданих числах
  // вона складається, міняти ці числа програма не має права: захвати ввела
  // людина, і «я порахував з іншими» на це не відповідь. Коли при живій
  // колії якась машина в неї не вклалася, про це сказано попередженням, а
  // як її туди завести — видно в способах: там це вибір, а не підміна.
  if (direct.ok || direct.fail !== 'ratio') return direct

  // Скільком машинам, яких хотіли в колії, її таки нарізано. Це і є міра
  // того, чи знайдене рішення: колія, по якій не їздить обприскувач, —
  // не рішення, навіть якщо ритм у ній гарний.
  const served = (r) => (r.ok ? r.machines.filter((m) => m.active && m.fits).length : 0)
  const asked = (r) => (r.machines ?? []).filter((m) => m.active).length

  // Машина, під яку різали колію: у відмові вона приходить окремим полем, у
  // робочій відповіді — прапорцем у звіті по машинах.
  const lead = direct.base ?? direct.machines?.find((m) => m.base) ?? null
  const geo = drillGeometry(input)
  const options = lead
    ? workingSets({
      geo,
      machines: normaliseMachines(input).filter((m) => m.active),
      limit: 8,
    })
    : []
  if (!options.length) return direct

  const already = direct.overlapRows || 0

  // Перебираємо всі набори, а не беремо перший, що склався: набір може
  // мати чудову ціну й при цьому викинути машину з колії через довгий
  // ритм — цього видно лише після повного розрахунку.
  let best = null
  for (const o of options) {
    // o.off — скільком сошникам сівалки не сіяти всього, а не на скільки
    // збільшити вже заданий нахльост: підбір щоразу йде по всій сівалці.
    // Ці крайні сошники і є нахльост: рама так само заходить на сусідній
    // прохід, але жоден рядок не сіється двічі й жоден не пропадає.
    const assume = {
      baseId: lead.id,
      baseLabel: lead.label,
      widths: new Map(o.machines.filter((m) => m.fits).map((m) => [m.id, m.width])),
      overlapRows: o.off,
      wasOverlapRows: already,
      option: o,
    }
    const next = computeOnce(input, assume)
    if (!next.ok) continue
    // Порівнюємо по порядку важливості: скільком машинам нарізано колію;
    // чи не зменшено заданий нахльост (його ставлять не для краси, а тому
    // що без підрулювання в стик не влучити); і аж потім ціна.
    const mark = [-served(next), o.off >= already ? 0 : 1, o.cost]
    if (!best || mark.some((v, i) => v < best.mark[i]
      && mark.slice(0, i).every((x, j) => x === best.mark[j]))) {
      best = { assume, next, mark }
    }
    // Усі машини в колії, нахльост не зменшений і нуль перекриття —
    // кращого не буде.
    if (served(next) === asked(next) && o.off >= already && o.cost === 0) break
  }
  if (!best) return direct

  const { assume, next } = best
  // Попередження беремо з самої відповіді, а не з прямого розрахунку: про
  // вхідні числа (обрізаний нахльост, незаповнена машина) вона каже те саме,
  // а про невдалий ритм у ній казати вже нічого — ритм складається.
  return { ...next, warnings: [assumeLine(assume, next), ...next.warnings] }
}

// Речення про припущення — те саме, що сказав би агроном: що саме я взяв,
// чому задані числа так не ділилися і чого це коштує.
function assumeLine(assume, result) {
  const o = assume.option
  const parts = [
    `Захвати на цій сівалці націло не діляться, тому рахую з припущенням.`,
  ]

  // Кожна машина, що працює вужче за свій розмах, названа окремо: це різні
  // машини й різні люди в кабінах.
  const narrowed = o.machines.filter((m) => m.fits && m.overlap > 0.001)
  if (narrowed.length) {
    parts.push(
      narrowed
        .map((m) => `«${m.label}» працює ${m.width} м замість ${m.was} м `
          + `(перекриття ${m.overlap} м, ${num1(m.overlapPct)} % кожної обробки)`)
        .join('; ')
      + '. Крайні секції на перекритті вимикають, щоб не лити двічі.',
    )
  }

  // Машина, якій під цей крок не лишилося робочої ширини: промовчати про
  // неї не можна — колія для неї не нарізана, і по полю вона піде посівом.
  if (o.outsiders.length) {
    parts.push(
      `Під цей крок не вкладається: `
      + o.outsiders.map((m) => `«${m.label}» ${m.was} м`).join(', ')
      + '. По цій колії ця машина не поїде — або ввімкніть інший спосіб,'
      + ' або приберіть її з колії свідомо.',
    )
  }
  if (o.off > 0) {
    parts.push(
      `Сівалка йде з нахльостом ${assume.overlapRows} ${coulterWord(assume.overlapRows)}:`
      + ` крок ${result.step} м замість ${result.drillWidth} м. Площа від цього не`
      + ' губиться — рядки під закритими сошниками кладе сусідній прохід.',
    )
  }
  // Нахльост заданий, але відповідь порахована з іншим. Промовчати про це
  // не можна: людина поставила своє число не для краси.
  if (assume.wasOverlapRows > 0 && assume.wasOverlapRows !== assume.overlapRows) {
    parts.push(
      `Заданих ${assume.wasOverlapRows} ${coulterWord(assume.wasOverlapRows)} нахльоста`
      + ` крок до ритму не зводять, тому в розрахунку ${assume.overlapRows}.`
      + (assume.overlapRows < assume.wasOverlapRows
        ? ' Це менше за заданий — якщо в стик без підрулювання не влучити,'
          + ' візьміть інший спосіб зі списку.'
        : ''),
    )
  }
  parts.push('Інші способи — у списку нижче; будь-який ставиться у форму одним натисканням.')
  return parts.join(' ')
}

const num1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',')
const coulterWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'сошника' : 'сошників')

// Номери сошників так, як їх бачить механізатор, коли сівалка розвернена.
//
// Поле їдуть човником: прохід туди, розворот на краю, прохід назад сусідньою
// смугою. На зворотному проході сівалка розвернена на 180°, і сошник, який на
// рамі позначений першим, опиняється з протилежного боку поля. Номер,
// названий «по полю», глушить тоді не ту секцію — і дзеркально, тобто в
// найгіршому місці: замість колії виходить друга пропущена смуга, а колія не
// нарізається зовсім.
//
// Сама геометрія від цього не міняється: незасіяні смуги лягають там само.
// Міняється лише те, яким числом їх назвати в кабіні.
export const mirrorRows = (list, rows) =>
  list.map((m) => rows + 1 - m).sort((a, b) => a - b)

// ── Усе поле ──────────────────────────────────────────────────────────────
//
// Візерунок проходів має період k · W, тож картина по всій ширині — це той
// самий цикл, повторений потрібну кількість разів. Рахуємо його явно, а не
// множенням, бо поле майже ніколи не ділиться націло: останній прохід виходить
// неповним, і саме там ховаються зайві колії та недосіяні смуги.
export function fieldPlan(
  result,
  { fieldWidth, fieldLength, rowSpacing, headland = 0, serpentine = false } = {},
) {
  // Сторона поля мусить бути числом, і скінченним. `Infinity > 0` — правда,
  // і далі вона протікала аж у відповідь: «поле Infinity га, проходів
  // Infinity». Порожнє поле — не привід показати нескінченність, тож
  // відповідь на такі числа одна: плану немає.
  const fw = Number(fieldWidth)
  const fl = Number(fieldLength)
  if (!result?.ok) return null
  if (!Number.isFinite(fw) || !(fw > 0) || !Number.isFinite(fl) || !(fl > 0)) return null
  const hRaw = Number(headland)

  const W = result.drillWidth
  const S = result.baseWidth ?? result.sprayerWidth
  const k = result.cycle
  const shift = result.shift || 0
  const offsets = result.coulters
  // Крок сівалки — не те саме, що її захват: із нахльостом вона
  // переставляється на менше, і проходів на поле виходить більше.
  const D = result.step > 0 ? result.step : W
  const over = result.overlapRows || 0
  const overWidth = result.overlapWidth || 0

  // Обсів по периметру сіють окремо й по ньому ж розвертаються, тож колія в
  // ньому не потрібна — і не влазить: комбайн і обприскувач заходять у загінку
  // вже під кутом. Робоча частина поля — те, що лишилось усередині.
  const H = Number.isFinite(hRaw) ? Math.max(0, hRaw) : 0
  const x0 = H
  const x1 = fw - H
  const workWidth = x1 - x0
  const workLength = fl - 2 * H
  if (!(workWidth > D) || !(workLength > 0)) {
    return { tooSmall: true, fieldWidth: fw, fieldLength: fl, headland: H,
      areaHa: mm((fw * fl) / 10000) }
  }

  // Поле, яке не вкладається в модель. Трапляється не з великих полів, а з
  // описок: зайвий нуль у ширині давав майже три мільйони проходів, і браузер
  // гаснув, не встигнувши нічого показати. Чесна відмова коштує нічого, а
  // підвисання коштує роботи.
  if (fw > LIMITS.fieldSide || fl > LIMITS.fieldSide
    || workWidth / D > LIMITS.fieldPasses) {
    return {
      tooBig: true, fieldWidth: fw, fieldLength: fl, headland: H,
      maxSide: LIMITS.fieldSide, maxPasses: LIMITS.fieldPasses,
      passesNeeded: Math.round(workWidth / D),
      areaHa: mm((fw * fl) / 10000),
    }
  }

  // Проходи сівалки по робочій ширині.
  //
  // Крім вимкнених секцій кожен прохід має ще одну категорію — секції, що
  // висять за межею робочої частини: на половинному першому проході й на
  // останньому, неповному. Механізаторові це та сама дія (підняти секцію),
  // але причина інша, і плутати їх не можна: вимкнена секція нарізає колію,
  // а винесена за межу просто не має де сіяти.
  const rows = offsets.length

  // Чи накриває смуга під колесом це місце поля. Потрібне лише першому
  // проходу: на ньому сошники нахльоста сіють (заходити нікуди), і якщо
  // колесо стало саме туди, глушити доведеться їх, а не сусідові.
  const period = result.period || S
  const underWheel = (local) => {
    const u = ((local % period) + period) % period
    return result.strips.some((st) => (
      (u >= st.from - EPS && u <= st.to + EPS)
      || (u - period >= st.from - EPS && u - period <= st.to + EPS)
      || (u + period >= st.from - EPS && u + period <= st.to + EPS)
    ))
  }

  const passes = []
  for (let i = 0; ; i++) {
    const from = x0 + i * D - shift
    // Нова земля проходу: з нахльостом рама заходить на засіяне сусідом, і
    // прохід, у якого нової землі вже немає, ніхто не поїде.
    const fresh0 = i === 0 ? from : from + overWidth
    if (fresh0 >= x1 - EPS) break
    const to = Math.min(from + W, x1)
    const inCycle = ((i % k) + k) % k
    const cyclePass = result.passes[inCycle]

    // Нахльост на першому проході не закривають — під ним ще немає чужого
    // рядка. Але колія не зважає на номер проходу: якщо смуга лягла саме
    // там, цей сошник глушиться, і це вже недосіяна площа.
    const first = i === 0
    const overlapClosed = first ? [] : cyclePass.overlapClosed ?? []
    const disabled = first && over > 0
      ? [
        ...Array.from({ length: over }, (_, j) => j + 1)
          .filter((m) => underWheel(i * D - shift + offsets[m - 1])),
        ...cyclePass.disabled,
      ].sort((a, b) => a - b)
      : cyclePass.disabled

    const outside = []
    const sowing = []
    for (let m = 1; m <= rows; m++) {
      const x = from + offsets[m - 1]
      if (x < x0 - EPS || x > x1 + EPS) outside.push(m)
      else if (!disabled.includes(m) && !overlapClosed.includes(m)) sowing.push(m)
    }

    // Хід човником: парні проходи їдуть назад, і сівалка на них розвернена.
    // Номери по полю лишаються ті самі (геометрія не міняється), а в кабіні
    // ті самі секції звуться дзеркально — саме їх і треба називати вголос.
    const back = serpentine && i % 2 === 1

    passes.push({
      i: i + 1,
      cycleN: inCycle + 1,
      from: mm(Math.max(from, x0)),
      to: mm(to),
      width: mm(to - Math.max(from, x0)),
      // Нова земля цього проходу — те, що він справді засіває. На повному
      // проході це крок сівалки, на останньому — скільки лишилося поля.
      fresh: mm(Math.max(0, to - Math.max(fresh0, x0))),
      full: from >= x0 - EPS && to >= from + W - EPS,
      disabled,
      overlapClosed,
      reasons: cyclePass.reasons,
      // Вимикати на цьому проході доводиться і те, і те — разом і по порядку.
      outside,
      sowing,
      tramline: disabled.length > 0,
      back,
      // Те саме, але номерами з кабіни. Без човника збігається з полем.
      cab: back
        ? {
          disabled: mirrorRows(disabled, rows),
          outside: mirrorRows(outside, rows),
          sowing: mirrorRows(sowing, rows),
          overlapClosed: mirrorRows(overlapClosed, rows),
        }
        : { disabled, outside, sowing, overlapClosed },
    })
  }

  // Колії: візерунок циклу, зсунутий на n · період. Візерунок повторюється
  // через період циклу (k проходів сівалки), а не через захват головної
  // машини: при асиметричному ритмі і при кількох машинах це різні довжини.
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
      const x = x0 + (p.i - 1) * D - shift + offsets[m - 1]
      if (x >= x0 - EPS && x <= x1 + EPS) disabledRows++
    }
  }

  const areaHa = mm((fw * fl) / 10000)
  const workingHa = mm((workWidth * workLength) / 10000)
  // Ширина недосіяної смуги — міжряддя: зерно не впало, сусіди його частково
  // переростають, але площа лишається недосіяною.
  const strip = result.stripWidth || spacingOf(rowSpacing) || result.minGap || 0
  const lostHa = mm((disabledRows * strip * workLength) / 10000)

  // Скільки окремих коридорів лягло на поле. Два колеса однієї машини — одна
  // колія; дві машини, що їдуть тією самою смугою, — теж одна.
  const lanes = new Set(strips.map((s) => s.pass)).size

  return {
    fieldWidth: fw, fieldLength: fl,
    headland: H,
    workWidth: mm(workWidth),
    workLength: mm(workLength),
    step: mm(D),
    overlapRows: over,
    overlapWidth: mm(overWidth),
    passes,
    serpentine: !!serpentine,
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
