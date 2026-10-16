// Суцільні номери стискаємо: «4, 5, 6» → «4–6». У кабіні так читається
// швидше, а на схемі підпис перестає налазити сам на себе.
export function runs(list) {
  if (!list?.length) return []
  const out = []
  let start = list[0], prev = list[0]
  for (const n of list.slice(1)) {
    if (n === prev + 1) { prev = n; continue }
    out.push([start, prev])
    start = prev = n
  }
  out.push([start, prev])
  return out
}

export function rangeText(list) {
  const r = runs(list)
  if (!r.length) return '—'
  return r.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ')
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

// Числа показуємо по-українськи: кома замість крапки й не більше двох знаків.
// Сантиметрова точність для поля надлишкова, а «5.556 %» ще й важко читати.
export function num(v, digits = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: digits }).format(v)
}

// Підписи номерів над схемою. Колесо часто стає на стик двох проходів: кінець
// одного (сошники 22–24) і початок наступного (сошник 3) — це одна смуга, і
// два підписи падали в одну точку, друкуючись один на одному. Тому близькі
// підписи зливаються в один, через крапку, у порядку зліва направо.
//
// Ширину підпису оцінюємо в одиницях схеми: моноширинний шрифт 12 одиниць —
// приблизно 7,5 на знак. Схема масштабується разом із текстом, тож оцінка
// однакова на телефоні й на моніторі.
const CHAR_W = 7.5
const LABEL_GAP = 8

export function numberLabels(result, offsets, period) {
  const scale = (1000 - 60) / period
  const items = result.passes.flatMap((p) => runs(p.disabled).map(([lo, hi]) => ({
    key: `n-${p.n}-${lo}`,
    at: p.from + (offsets[lo - 1] + offsets[hi - 1]) / 2,
    text: lo === hi ? String(lo) : `${lo}–${hi}`,
  }))).filter((l) => l.at >= -0.01 && l.at <= period + 0.01)
    .sort((a, b) => a.at - b.at)

  // Групи йдуть зліва направо; кожна пам'ятає крайні точки, а підпис
  // стоїть посередині між ними. Перетин міряємо реальними межами тексту.
  const half = (t) => (t.length * CHAR_W) / 2
  const out = []
  for (const l of items) {
    const prev = out.at(-1)
    if (prev && (l.at - prev.at) * scale < half(prev.text) + half(l.text) + LABEL_GAP) {
      const left = prev.left
      const right = l.at
      out[out.length - 1] = {
        key: `${prev.key}+${l.key}`,
        text: `${prev.text} · ${l.text}`,
        left,
        at: (left + right) / 2,
      }
    } else {
      out.push({ ...l, left: l.at })
    }
  }
  return out
}
