// ── Способи засіяти це поле наявною технікою ──────────────────────────────
//
// Головне правило: техніка задана й мінятися не буде. Штанга 16 м — це
// 16 м, міжряддя 15 см — це 15 см, і те, що 16 на 3,6 не ділиться, не
// причина сказати «купіть іншу машину». Причина — шукати спосіб.
//
// Способів насправді багато, і всі вони з того самого набору ручок, які
// механізатор і так крутить на полі:
//
//   робоча ширина   машина їде вужче за свій розмах і перекриває сусідній
//                   прохід — 16-метрова штанга працює на 15,75 або 14,4 м;
//   нахльост        сівалка заходить на вже засіяне, а крайні сошники на
//                   ньому закриті — крок стає меншим за захват;
//   половинний      перше проходження половиною сівалки зсуває всю сітку на
//   перший прохід   півкроку й часто збирає розірвану колію в один прохід;
//   відступ машини  з якого місця починає перший прохід та машина, під яку
//                   різали колію.
//
// Кожне поєднання цих ручок — окремий спосіб, і його можна порахувати до
// кінця: скільки площі недосіяно, скільки хімії ляже двічі, скільки зайвих
// проходів сівалки, чи збирається колія в один прохід і чим скінчиться
// поле. Тут перебираються всі поєднання, кожне рахується тим самим
// розрахунком, що й головна відповідь, і лишаються найдешевші.
//
// Відповідь на «як починати й як закінчувати» теж звідси, а не від
// користувача: перший і останній проходи вважаються окремо, бо вони єдині,
// у кого сусід лише з одного боку.

import { computeExact, fieldPlan, workingSets } from './tramline.js'
import { drillGeometry, minGap } from './geometry.js'
import { normaliseMachines } from './machines.js'
import { plural } from './format.js'

const mm = (v) => Math.round(v * 1000) / 1000

// Скільки поєднань має право перебрати пошук. Кожне — повний розрахунок із
// підбором відступів і розкладкою поля, тож межа тут не про смак: форма
// перераховується на кожне натискання, і півсекунди затримки видно.
const MAX_CANDIDATES = 14

// ── Чим один спосіб гірший за інший ───────────────────────────────────────
//
// Усе зводиться до відсотків роботи, але вони різної ваги, і ця різниця —
// не математика, а агрономія:
//
//   недосіяна площа   те, через що й існує колія. Платиться зерном і раз на
//                     сезон уже не відіграється — найдорожче.
//   перекриття штанги подвійна доза на смузі, і то на кожній обробці за
//                     сезон. Дорого, але це хімія, не врожай.
//   зайвий прохід     нахльост не губить ні зерна, ні площі: рядки під
//   сівалки           закритими сошниками кладе сусідній прохід. Платиться
//                     соляркою й часом, один раз на поле.
//   колія на два      колію різати доводиться на двох сусідніх проходах
//   проходи           замість одного. Площа та сама, помилитися легше.
//   вузький останній  смуга в метр на краю поля: сіяти її нічим, а не сіяти
//   прохід            шкода. Лікується, але краще не мати.
const WEIGHT = {
  lost: 2,
  boom: 1,
  extraPass: 0.5,
  split: 0.6,
  tail: 1.5,
  longRhythm: 0.5,
  // Машина, яка в цей крок не вкладається, по колії не поїде — поїде
  // посівом. Це не «трохи гірше», це не те, про що просили.
  outsider: 20,
}

// Поле, на якому ще нічого не задано, — не причина не шукати способів:
// геометрія проходу від розміру поля не залежить. Тоді просто немає розділу
// про початок і кінець.
const hasField = (f) => Number(f?.fieldWidth) > 0 && Number(f?.fieldLength) > 0

/**
 * Способи засіяти задане поле заданою технікою, від найдешевшого.
 *
 * input — та сама форма, що й у головного розрахунку
 * field — { fieldWidth, fieldLength, headland, serpentine }
 *
 * Кожен спосіб несе `patch` — рівно ті зміни у формі, якими його ввімкнути.
 * Нічого іншого спосіб не міняє: ні техніки, ні міжряддя, ні культури.
 */
export function solutions(input, field = {}, limit = 5) {
  const geo = drillGeometry(input)
  const rows = geo.rows
  // Міжряддя потрібне лише пораді про кінець поля (скільком сошникам не
  // сіяти на останньому проході). Сам перебір кроків іде по позиціях
  // сошників, тож довільна розкладка перебирається так само, як рівномірна.
  const spacing = geo.custom ? geo.minGapValue ?? minGap(geo.offsets) : Number(input.rowSpacing)
  if (!(geo.width > 0) || rows < 2) return []

  const machines = normaliseMachines(input).filter((m) => m.active)
  if (!machines.length) return []
  const lead = machines.find((m) => m.base)
    || machines.slice().sort((a, b) => a.width - b.width)[0]
  if (!lead || !(lead.width > 0)) return []

  // Набори робочих ширин на весь парк — від найдешевшого. Беремо з запасом,
  // бо найдешевший за перекриттям не завжди найдешевший по полю: вирішує
  // те, куди стане колесо, а це видно лише після розрахунку.
  const sets = workingSets({ geo, machines, limit: 6 })
  if (!sets.length) return []

  // Перебір у два кола, і це не передчасна оптимізація, а те, без чого
  // форма починає відставати від пальців: розкладка поля — найдорожча
  // частина (на полі 600 м це сто шістдесят проходів по кожному сошнику),
  // і робити її для всіх двадцяти поєднань, щоб показати пʼять, означало б
  // тридцять мілісекунд на кожне натискання. Тому спершу всі поєднання
  // міряються самим циклом — ціна колії від розміру поля не залежить, — а
  // поле розкладається лише для тих, що дійшли до списку.
  const found = []
  let spent = 0
  for (const o of sets) {
    // Половинний перший прохід рахується в парі з повним, а не окремо:
    // сказати про нього щось правдиве можна лише порівнявши з тим самим
    // способом без нього. Інакше виходить «увімкніть, бо так краще».
    const pair = {}
    for (const halfStart of [false, true]) {
      if (spent >= MAX_CANDIDATES) break
      // Половинний прохід рахуємо не завжди, а лише там, де він може щось
      // змінити: він зсуває сітку на півкроку, а це вирішує тоді, коли
      // колія розпалася на два проходи або коли цикл парний і центр машини
      // припадає на стик. Решту разів це був би той самий розрахунок
      // удвічі — і півсекунди затримки на чотирьох машинах.
      if (halfStart && pair[0] && pair[0].result.symmetric && pair[0].result.cycle % 2) continue
      spent++
      // Патч міняє рівно те, що крутять у полі: нахльост сівалки, перший
      // прохід і робочу ширину кожної машини. Машині, якій під цей крок не
      // лишилося ширини, захват не чіпаємо — вона просто лишається поза
      // колією, і спосіб про це скаже прямо.
      const patch = {
        overlapRows: o.off,
        halfStart,
        machines: machines.map((m) => {
          const w = o.machines.find((x) => x.id === m.id)
          // Розмах машини зберігається окремо від робочої ширини: спосіб
          // міняє друге, а перше лишається тим, що стоїть у дворі.
          const full = Math.max(m.fullWidth ?? m.width, m.width)
          return w?.fits
            ? { ...m, width: w.width, fullWidth: full, base: m.id === lead.id }
            : { ...m, fullWidth: full, base: false }
        }),
      }
      // Рахуємо строго: спосіб, у якому розрахунок сам щось припустив,
      // способом не є — пошук мусить видавати те, що складається на числах
      // самого способу.
      const result = computeExact({ ...input, ...patch })
      if (!result.ok) continue
      pair[halfStart ? 1 : 0] = { o, halfStart, patch, result, lead, spacing }
    }
    for (const key of [0, 1]) {
      const cand = pair[key]
      if (!cand) continue
      found.push({ ...cand, other: pair[key === 1 ? 0 : 1] ?? null })
    }
  }

  // Поле розкладається лише для тих, що мають шанс дійти до списку — і вже
  // на розкладці ціна уточнюється: саме з неї видно, чим скінчиться поле.
  // Половинний і повний перший прохід тут ще не зливаються: грубій ціні
  // кінець поля не видно, а він між ними й вирішує.
  const shortlist = found
    .sort((a, b) => rough(a) - rough(b))
    .slice(0, limit + 5)
    .map((cand) => {
      const layout = (r) => (hasField(field)
        ? fieldPlan(r, { ...field, rowSpacing: input.rowSpacing })
        : null)
      const plan = layout(cand.result)
      // Пару з іншим першим проходом теж розкладаємо: інакше порівняння
      // «з половинним і без» брало б недосів від поля в одного й недосів від
      // циклу в другого — і показувало виграш, якого немає.
      const other = cand.other ? { ...cand.other, plan: layout(cand.other.result) } : null
      return plan && (plan.tooSmall || plan.tooBig) ? null : { ...cand, plan, other }
    })
    .filter(Boolean)
    .map((cand) => describe(cand))

  // Два способи з однаковою робочою шириною й однаковим нахльостом — це
  // один спосіб, записаний двічі. Лишаємо дешевший; за однакової ціни —
  // той, що без половинного проходу, бо його ще й робити не треба.
  const seen = new Map()
  for (const way of shortlist) {
    const key = `${way.baseWidth}:${way.overlapRows}`
    const prev = seen.get(key)
    if (!prev || way.score < prev.score) seen.set(key, way)
  }

  return [...seen.values()]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s, i) => ({ ...s, n: i + 1 }))
}

// Груба ціна поєднання — усе, що видно без розкладки поля. Недосіяна площа
// тут цикловa: по полю вона виходить майже та сама, бо візерунок циклу й
// повторюється по всій ширині.
function rough({ o, result, halfStart }) {
  return result.lossPct * WEIGHT.lost
    + o.overlapPct * WEIGHT.boom
    + o.offPct * WEIGHT.extraPass
    + (result.symmetric ? 0 : WEIGHT.split)
    + (result.cycle > 8 ? WEIGHT.longRhythm : 0)
    + outsidersOf(o, result).length * WEIGHT.outsider
    // За однакової ціни половинний прохід програє: це ще одна дія в полі.
    + (halfStart ? 0.001 : 0)
}

// Машини, що лишилися поза колією. Набір міряє це по кроку, а розрахунок —
// ще й по ритму: машина може вкладатися в крок і все одно випасти, бо цикл
// із нею розтягується так, що його ніхто не відрахує. Правда — друге.
function outsidersOf(o, result) {
  return (result.machines ?? []).filter((m) => m.active && !m.fits)
}

// Один спосіб, порахований до кінця й описаний словами.
function describe({ o, halfStart, patch, result, plan, lead, spacing, other = null }) {
  const step = result.step
  const lostPct = plan ? plan.lostPct : result.lossPct
  const split = !result.symmetric
  const tail = tailOf(result, plan, spacing)

  const outsiders = outsidersOf(o, result)
  const score = mm(
    lostPct * WEIGHT.lost
    + o.overlapPct * WEIGHT.boom
    + o.offPct * WEIGHT.extraPass
    + (split ? WEIGHT.split : 0)
    + tail.penalty * WEIGHT.tail
    + (result.cycle > 8 ? WEIGHT.longRhythm : 0)
    + outsiders.length * WEIGHT.outsider,
  )

  return {
    id: `${result.baseWidth}-${o.off}-${halfStart ? 'half' : 'full'}`,
    patch,
    score,
    // Що саме крутимо, числами.
    baseId: lead.id,
    baseLabel: lead.label,
    baseWidth: result.baseWidth,
    baseWas: mm(Math.max(lead.fullWidth ?? lead.width, lead.width)),
    boomOverlap: mm(Math.max(lead.fullWidth ?? lead.width, lead.width) - result.baseWidth),
    baseFull: mm(Math.max(lead.fullWidth ?? lead.width, lead.width)),
    boomOverlapPct: o.overlapPct,
    // Хто працює якою шириною й хто лишився поза колією — по машинах.
    machines: o.machines.map((m) => ({ ...m })),
    served: (result.machines ?? []).filter((m) => m.active && m.fits).length,
    wanted: (result.machines ?? []).filter((m) => m.active).length,
    outsiders: outsiders.map((m) => ({ id: m.id, label: m.label, width: m.width })),
    overlapRows: o.off,
    overlapWidth: result.overlapWidth,
    halfStart,
    step,
    drillWidth: result.drillWidth,
    rhythm: result.cycle,
    symmetric: result.symmetric,
    disabledPerCycle: result.disabledPerCycle,
    lostPct,
    lostHa: plan ? plan.lostHa : null,
    passes: plan ? plan.passes.length : null,
    tramlines: plan ? plan.tramlines : null,
    // Чим цей спосіб відрізняється — рядками, які можна прочитати вголос.
    why: why({ o, halfStart, result, plan, lead, other }),
    start: startAdvice(result, o, halfStart, plan),
    finish: tail.advice,
    tail,
  }
}


// ── Початок поля ──────────────────────────────────────────────────────────
//
// Перший прохід єдиний, у кого немає сусіда з того боку, куди заходить
// нахльост. Тому на ньому сіють усім, чим є — заходити ще нікуди, — і саме
// це питають найчастіше: «а на першому як?».
function startAdvice(result, o, halfStart, plan) {
  const lines = []
  const firstPass = plan?.passes?.[0] ?? null

  if (halfStart) {
    lines.push(
      'Починати половинним проходом: сівалка заходить у поле половиною захвату, '
      + 'сіють тільки ті сошники, що над полем, решта піднята. Уся сітка від '
      + 'цього зсувається на півкроку — саме тим цей спосіб і відрізняється '
      + 'від такого самого з повним першим проходом.',
    )
    if (firstPass?.sowing?.length) {
      lines.push(
        `На цьому полі на першому проході сіє ${count(firstPass.sowing.length)} `
        + `із ${result.rows}: ${firstPass.outside.length} за межею поля.`,
      )
    }
  } else {
    lines.push(
      'Починати повним проходом від краю поля — '
      + 'рамою точно по межі, щоб крайній сошник ліг по краю.',
    )
  }

  if (o.off > 0 && !halfStart) {
    lines.push(
      `На першому проході сіють усі ${result.rows}: нахльосту немає — заходити `
      + `нікуди. З другого проходу й далі закривають ${count(o.off)} з того краю, `
      + 'яким сівалка заходить на засіяне.',
    )
  } else if (o.off > 0) {
    lines.push(
      `З другого проходу й далі закривають ${count(o.off)} з того краю, яким `
      + 'сівалка заходить на засіяне: саме вони й ідуть по чужих рядках.',
    )
  }
  return lines
}

// ── Кінець поля ───────────────────────────────────────────────────────────
//
// Поле не ділиться на проходи націло майже ніколи, і останній прохід
// виходить вузьким. Це не дрібниця: смуга в метр — це або сівалка з
// піднятими секціями, або недосіяний край, видний з дороги.
//
// Лікується тим самим нахльостом, тільки разовим: на останньому проході
// закривають більше сошників і заходять глибше на засіяне. Скільком саме —
// рахується точно, бо нова земля останнього проходу відома до сантиметра.
function tailOf(result, plan, spacing) {
  if (!plan || !plan.passes?.length) return { penalty: 0, advice: [], fresh: null }

  const step = result.step
  const last = plan.passes.at(-1)
  const fresh = last.fresh ?? last.width
  const short = step > 0 ? Math.max(0, 1 - fresh / step) : 0

  const advice = []
  if (short < 0.08) {
    advice.push(
      `Останній прохід виходить повним — ${num(fresh)} м нової землі з ${num(step)} м `
      + 'кроку. Край поля закривається без хитрощів.',
    )
    return { penalty: 0, advice, fresh, short, closeRows: 0, sow: result.rows }
  }

  // Скільком сошникам не сіяти на останньому проході, щоб рама йшла по полю,
  // а не висіла за межею.
  const closeRows = spacing > 0
    ? Math.min(result.rows - 1, Math.max(0, Math.round((result.drillWidth - fresh) / spacing)))
    : 0
  const sow = Math.max(1, result.rows - closeRows)

  advice.push(
    `Останнім проходом лишається засіяти ${num(fresh)} м — менше за крок `
    + `${num(step)} м. Так буває майже завжди: поле не ділиться націло.`,
  )
  advice.push(
    `Рівний край дає разовий нахльост: підтягнути сівалку рамою до самої межі `
    + `й закрити з боку засіяного ${count(closeRows)} — сіє останні ${count(sow)}. `
    + 'Тоді нічого не висить за межею й нічого не сіється двічі.',
  )
  advice.push(
    'Другий спосіб — залишити як є: вивісити раму за межу й підняти секції, '
    + 'що опинилися за межею поля. Так швидше, але край засівається не рівно.',
  )
  return { penalty: short, advice, fresh, short, closeRows, sow }
}

// Чим цей спосіб є — кілька рядків, кожен про одну ручку.
function why({ o, halfStart, result, plan, lead, other }) {
  const lines = []

  // Хто якою шириною працює — по кожній машині, бо це різні машини й різні
  // люди в кабінах. Машина без перекриття теж названа: «працює повним»  —
  // це добра новина, і її мусить бути видно.
  for (const m of o.machines.filter((x) => x.fits)) {
    lines.push(m.overlap > 0.001
      ? `«${m.label}» працює ${num(m.width)} м зі своїх ${num(m.was)} м — `
        + `${num(m.overlap)} м іде в перекриття сусіднього проходу `
        + `(${pct(m.overlapPct)} % кожної обробки за сезон).`
      : `«${m.label}» працює на повний захват ${num(m.width)} м — перекриття `
        + 'немає, нічого не ллється двічі.')
  }

  // Машина, що в цей крок не вкладається. Промовчати про неї не можна:
  // колію їй не нарізано, і по полю вона піде посівом.
  const out = outsidersOf(o, result)
  if (out.length) {
    lines.push(
      `Поза колією: ${out.map((m) => `«${m.label}» ${num(m.width)} м`).join(', ')} — `
      + 'для цієї машини колія не нарізана, вона піде по посіву.',
    )
  }

  if (o.off > 0) {
    lines.push(
      `Сівалка з нахльостом ${count(o.off)}: крок ${num(result.step)} м замість `
      + `${num(result.drillWidth)} м. Площа не губиться — рядки під закритими `
      + `сошниками кладе сусідній прохід, але проходів на поле на `
      + `${pct(o.offPct)} % більше.`,
    )
  } else {
    lines.push('Сівалка йде своїм захватом, без нахльоста — проходів найменше.')
  }

  const hit = result.passes.filter((p) => p.disabled.length).length
  lines.push(
    `Ритм ${result.cycle}: `
    + (hit <= 1
      ? `уся колія лягає в один прохід із ${result.cycle} — у кабіні це одна дія.`
      : `глушити доводиться на ${hit} проходах із ${result.cycle}.`),
  )

  // Про половинний прохід — тільки те, що видно з порівняння з тим самим
  // способом без нього. «Увімкніть, бо так краще» тут не відповідь.
  if (halfStart && other) {
    // Обидва числа з одного джерела: обидва від поля або обидва від циклу.
    const byField = !!(plan && other.plan)
    const was = byField ? other.plan.lostPct : other.result.lossPct
    const now = byField ? plan.lostPct : result.lossPct
    const hitWas = other.result.passes.filter((p) => p.disabled.length).length
    if (hitWas > hit) {
      lines.push(
        `Половинний перший прохід збирає колію з ${hitWas} проходів в ${hit} — `
        + 'через нього цей спосіб і кращий за такий самий із повним першим.',
      )
    } else if (now < was - 0.01) {
      lines.push(
        `Половинний перший прохід зсуває сітку на півкроку, і колія проходить `
        + `ближче до міжрядь: недосіву ${pct(now)} % замість ${pct(was)} %.`,
      )
    } else if (plan && other.plan && plan.passes.at(-1).fresh > other.plan.passes.at(-1).fresh) {
      lines.push(
        'Половинний перший прохід рівніше розкладає поле: останній прохід '
        + `виходить ${num(plan.passes.at(-1).fresh)} м замість `
        + `${num(other.plan.passes.at(-1).fresh)} м.`,
      )
    } else {
      lines.push('Перший прохід половинний — сітка зсунута на півкроку.')
    }
  }

  return lines
}

const num = (v) => String(Math.round(v * 1000) / 1000).replace('.', ',')
const pct = (v) => String(Math.round(v * 10) / 10).replace('.', ',')
const count = (n) => `${n} ${plural(n, 'сошник', 'сошники', 'сошників')}`
