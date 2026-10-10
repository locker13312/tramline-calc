// ── Сошники сівалки ───────────────────────────────────────────────────────
//
// Більшість сівалок — рівномірні: сошник через кожне міжряддя, перший на
// півміжрядді від краю рами. Але не всі: буває подвійне міжряддя під слід
// трактора, буває знята секція, буває дискова сівалка з парами. Тому
// розкладка тут — список позицій від лівого краю проходу, а рівномірна
// сівалка лише найчастіший спосіб його побудувати.
//
// Усе інше в розрахунку працює з цим списком, тож нерівномірна сівалка не
// потребує жодного окремого випадку.

const mm = (v) => Math.round(v * 1000) / 1000

// Позиції сошників від лівого краю проходу, у метрах.
export function coulterOffsets({ rows, rowSpacing, coulters }) {
  if (Array.isArray(coulters) && coulters.length >= 2) {
    return coulters.map(Number).filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b)
  }
  return Array.from({ length: Math.max(0, Math.round(rows)) }, (_, i) => mm((i + 0.5) * rowSpacing))
}

// Захват сівалки.
//
// У рівномірної це просто секції × міжряддя — і нічим іншим він бути не може.
// У довільної розкладки по самих позиціях захвату не видно: невідомо, скільки
// рами виступає за крайні сошники. Тоді беремо симетричне припущення —
// скільки є до першого сошника, стільки й після останнього, — і його можна
// перебити явно (drillWidth у формі).
//
// Явне значення діє тільки для довільної розкладки. Інакше воно лишалося
// прилиплим: задав 2,4 м для своєї розкладки, повернувся до рівномірної — і
// захват усе одно 2,4 м, хоч секції з міжряддям кажуть інше.
export function drillGeometry(input) {
  const offsets = coulterOffsets(input)
  const custom = Array.isArray(input.coulters) && input.coulters.length >= 2
  const explicit = Number(input.drillWidth)
  const width = custom
    ? (explicit > 0 ? mm(explicit) : mm(offsets.at(-1) + offsets[0]))
    : mm((Math.round(input.rows) || 0) * input.rowSpacing)
  return { offsets, width, rows: offsets.length, custom: custom && offsets.length > 0 }
}

// Найменше міжряддя в розкладці — саме воно вирішує, чи може колесо взагалі
// пройти між сошниками.
export function minGap(offsets) {
  let g = Infinity
  for (let i = 1; i < offsets.length; i++) g = Math.min(g, offsets[i] - offsets[i - 1])
  return Number.isFinite(g) ? mm(g) : 0
}

// Сліди трактора сівалки всередині її ж проходу. Колія тут ще не нарізана —
// вона тільки нарізається, — але слід трактора лягає на кожному проході, і
// на ньому ґрунт ущільнений. Деякі господарства глушать сошники, що йдуть
// просто по цьому сліду: зерно в ущільненому сліді сходить гірше.
export function tractorBands({ trackWidth, tyreWidth, margin = 0.1 }, drillWidthValue) {
  if (!(trackWidth > 0) || !(tyreWidth > 0) || !(drillWidthValue > 0)) return []
  const half = tyreWidth / 2 + margin
  return [-1, 1].map((sign) => {
    const centre = drillWidthValue / 2 + sign * trackWidth / 2
    return { centre: mm(centre), from: mm(centre - half), to: mm(centre + half) }
  })
}
