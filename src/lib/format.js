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
