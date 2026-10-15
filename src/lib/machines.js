// ── Машини, що поїдуть нарізаною колією ───────────────────────────────────
//
// Колію нарізають один раз, на сівбі, а їздить по ній не одна машина:
// обприскувач, розкидач, на жнивах — комбайн і бункер-перевантажувач. Кожна
// має свій захват, свою колісну базу й свою шину, і заглушити доводиться
// об'єднання їхніх смуг, а не смугу однієї «головної» машини.
//
// Тому машина тут не особливий випадок у коді, а рядок у списку, який
// заповнює господар. Додали перевантажувач з колією 1,8 м — розрахунок
// одразу інший, без правок у математиці.

import { LIMITS, resolveMargin } from './geometry.js'

// Типові машини українських господарств — щоб не вбивати цифри руками.
// Будь-яке значення у формі перебивається власним.
//
// passes — скільки разів за сезон машина проходить полем. Потрібне тільки
// грошам: саме стільки разів вона толочила б посів, якби колії не було.
export const MACHINE_KINDS = [
  {
    kind: 'sprayer', label: 'Обприскувач', passes: 4,
    width: 25.2, axles: [{ trackWidth: 2.25, tyreWidth: 0.32 }],
    hint: 'Задає крок колій: саме його захват визначає, через скільки метрів лягає смуга.',
  },
  {
    kind: 'spreader', label: 'Розкидач добрив', passes: 2,
    width: 24, axles: [{ trackWidth: 1.8, tyreWidth: 0.55 }],
    hint: 'Захват має бути кратним обприскувачу, інакше в колію він потрапляє не щоразу.',
  },
  {
    kind: 'combine', label: 'Комбайн', passes: 1,
    width: 9, axles: [{ trackWidth: 3.0, tyreWidth: 0.8 }, { trackWidth: 2.55, tyreWidth: 0.5 }],
    hint: 'Дві осі з різною колією. Стоячу культуру комбайн не топче — жатка ріже перед колесами; у колію його заводять проти ущільнення ґрунту.',
  },
  {
    kind: 'cart', label: 'Бункер-перевантажувач', passes: 1,
    width: 9, axles: [{ trackWidth: 1.8, tyreWidth: 0.65 }],
    hint: 'Саме ця машина топче культуру на жнивах, бо ходить збоку від комбайна. Захват беріть як у комбайна — вона йде його проходом.',
  },
  {
    kind: 'tractor', label: 'Трактор з агрегатом', passes: 1,
    width: 12, axles: [{ trackWidth: 1.8, tyreWidth: 0.52 }],
    hint: 'Підживлення, десикація, будь-який інший прохід по вегетації.',
  },
  {
    kind: 'other', label: 'Інша машина', passes: 1,
    width: 12, axles: [{ trackWidth: 1.8, tyreWidth: 0.5 }],
    hint: '',
  },
]

export const kindOf = (kind) => MACHINE_KINDS.find((k) => k.kind === kind) || MACHINE_KINDS.at(-1)

let seq = 0
export function newMachine(kind = 'other', patch = {}) {
  const k = kindOf(kind)
  return {
    id: `m${Date.now().toString(36)}${(seq++).toString(36)}`,
    kind: k.kind,
    label: k.label,
    width: k.width,
    axles: k.axles.map((a) => ({ ...a })),
    passes: k.passes,
    active: true,
    // base не ставимо: крок колій програма вибирає сама — найвужча машина,
    // бо тільки її захват усі інші вкладають цілим числом разів. Господар
    // може закріпити іншу, і тоді цей прапорець ставить форма.
    base: false,
    // Зсув сітки проходів: з якого відступу від краю машина починає. Теж
    // підбирається сам — саме він вирішує, чи колесо впаде в готову смугу.
    phase: null,
    ...patch,
  }
}

// Список за замовчуванням: обприскувач задає колію, комбайн і перевантажувач
// присутні, але вимкнені — щоб людина побачила, чого коштує завести їх у
// колію, і ввімкнула сама, а не отримала це в спадок від програми.
export function defaultMachines() {
  return [
    newMachine('sprayer', { id: 'sprayer' }),
    newMachine('combine', { id: 'combine', active: false }),
    newMachine('cart', { id: 'cart', active: false }),
  ]
}

// Привести будь-що, що прийшло з форми чи з localStorage, до вигляду, з яким
// працює геометрія. Стара форма (sprayerWidth / trackWidth / tyreWidth без
// списку машин) теж читається — збережені поля не мають ламатися.
//
// Сюди приходить і сміття: список може бути рядком, машина — null, вісь —
// без жодного числа. Нічого з цього не має права впасти, тому кожне поле
// проходить через Number і перевірку, а не береться як є.
export function normaliseMachines(input) {
  const raw = Array.isArray(input?.machines) && input.machines.length
    ? input.machines.filter((m) => m && typeof m === 'object' && !Array.isArray(m))
    : [{
      id: 'sprayer', kind: 'sprayer', label: 'Обприскувач', base: true,
      width: input.sprayerWidth,
      axles: [{ trackWidth: input.trackWidth, tyreWidth: input.tyreWidth }],
    }]

  // Число або нуль: NaN, Infinity, рядок із комою й мінус однаково не числа.
  const good = (v) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  // Запас на весь парк: той, що задала людина, або той, що бере система.
  // Машина може мати свій — тоді діє він, і тільки для неї.
  const shared = resolveMargin(input)
  const marginOf = (v) => {
    if (v == null || v === '') return shared
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? Math.min(n, LIMITS.margin) : shared
  }

  const list = raw.map((m, i) => {
    const axles = (Array.isArray(m.axles) && m.axles.length
      ? m.axles
      : [{ trackWidth: m.trackWidth, tyreWidth: m.tyreWidth }])
      .filter((a) => a && typeof a === 'object')
      .slice(0, 4)      // більше чотирьох осей не буває навіть у комбайна з візком
      .map((a) => ({ trackWidth: good(a.trackWidth), tyreWidth: good(a.tyreWidth) }))
      .filter((a) => a.trackWidth > 0 && a.tyreWidth > 0)
    const width = good(m.width)
    // Розмах машини й ширина, якою вона працює, — різні числа. Штанга 16 м,
    // що працює на 15,75, лишається штангою 16 м: саме з розмаху підбір
    // шукає робочі ширини наступного разу. Без цього кожне натискання
    // «поставити спосіб» відкушувало від машини ще шматок, і за три
    // натискання 16 м перетворювалися на 13.
    const full = good(m.fullWidth)
    return {
      id: typeof m.id === 'string' && m.id ? m.id : `m${i + 1}`,
      kind: typeof m.kind === 'string' ? m.kind : 'other',
      label: typeof m.label === 'string' && m.label.trim() ? m.label : kindOf(m.kind).label,
      width,
      fullWidth: full >= width ? full : width,
      axles,
      // Запас спільний на весь парк, якщо машина не задала свій. Мінусовий
      // зробив би смугу вужчою за шину, тож нижня межа — нуль.
      margin: marginOf(m.margin),
      // Своє число проходів за сезон — лише якщо машина його задала. Інакше
      // null, і гроші візьмуть спільне число з форми: вгадувати за машину,
      // скільки разів вона виїде, програма не має права.
      passes: m.passes == null || m.passes === '' || !Number.isFinite(Number(m.passes))
        ? null
        : Math.max(0, Number(m.passes)),
      // wanted — людина хоче цю машину в колії; active — вона справді
      // годиться для розрахунку. Розрізняти їх обов'язково: стерте поле
      // захвату робить машину непридатною, і якщо про це не сказати, цифри
      // просто змінюються без причини.
      wanted: m.active !== false,
      active: m.active !== false && width > 0 && width <= LIMITS.machineWidth && axles.length > 0,
      // Захват, якого не буває: не «велика машина», а описка. Відрізняємо її
      // від незаповненого поля, бо сказати треба різне.
      tooWide: width > LIMITS.machineWidth,
      base: !!m.base,
      // Зсув циклічний за визначенням: 999 м для 18-метрової машини — це той
      // самий зсув, що й 3 м, і від'ємний теж зводиться в межі захвату.
      phase: m.phase == null || m.phase === '' || !Number.isFinite(Number(m.phase))
        ? null
        : (width > 0 ? ((Number(m.phase) % width) + width) % width : 0),
    }
  })

  // Базова лише одна: дві «головні» машини означали б дві різні сітки колій.
  // Яку саме брати, коли господар не закріпив жодної, вирішує вже геометрія —
  // там видно захват сівалки, а без нього вибір безпідставний.
  let seen = false
  for (const m of list) {
    if (m.base && m.active && !seen) { seen = true; continue }
    if (m.base) m.base = false
  }
  return list
}
