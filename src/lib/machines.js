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
export function normaliseMachines(input) {
  const raw = Array.isArray(input.machines) && input.machines.length
    ? input.machines
    : [{
      id: 'sprayer', kind: 'sprayer', label: 'Обприскувач', base: true,
      width: input.sprayerWidth,
      axles: [{ trackWidth: input.trackWidth, tyreWidth: input.tyreWidth }],
    }]

  const list = raw.map((m, i) => {
    const axles = (m.axles?.length
      ? m.axles
      : [{ trackWidth: m.trackWidth, tyreWidth: m.tyreWidth }])
      .map((a) => ({ trackWidth: Number(a.trackWidth) || 0, tyreWidth: Number(a.tyreWidth) || 0 }))
      .filter((a) => a.trackWidth > 0 && a.tyreWidth > 0)
    return {
      id: m.id ?? `m${i + 1}`,
      kind: m.kind ?? 'other',
      label: m.label || kindOf(m.kind).label,
      width: Number(m.width) || 0,
      axles,
      // Запас на знос керма спільний на всі машини, якщо машина не задала свій.
      margin: Number(m.margin ?? input.margin ?? 0.1),
      // Своє число проходів за сезон — лише якщо машина його задала. Інакше
      // null, і гроші візьмуть спільне число з форми: вгадувати за машину,
      // скільки разів вона виїде, програма не має права.
      passes: m.passes == null || m.passes === '' ? null : Number(m.passes),
      // wanted — людина хоче цю машину в колії; active — вона справді
      // годиться для розрахунку. Розрізняти їх обов'язково: стерте поле
      // захвату робить машину непридатною, і якщо про це не сказати, цифри
      // просто змінюються без причини.
      wanted: m.active !== false,
      active: m.active !== false && Number(m.width) > 0 && axles.length > 0,
      base: !!m.base,
      phase: m.phase == null || m.phase === '' ? null : Number(m.phase),
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
