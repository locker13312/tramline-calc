import { useEffect, useMemo, useState } from 'react'
import { machineRoutes } from '../lib/driving'
import { num, rangeText } from '../lib/format'

// ── Рухи машин по полю ────────────────────────────────────────────────────
//
// «Поле згори» показує, де лежать колії. Ця карта — як по полю їздять:
// сівалка своїми заїздами від першого до останнього, обприскувач і решта —
// по коліях. Кожен прохід — лінія вздовж поля, між ними розворот в обсіві.
//
// Пройдене — суцільним кольором машини, ще не пройдене — блідим пунктиром,
// поточний заїзд — товстою лінією зі стрілкою. Під картою — те, що треба
// знати саме на цьому заїзді: куди їхати й що глушити.
//
// Програвання — кнопкою, а не саме: карта, що рухається без запиту, заважає
// читати решту сторінки.
export default function FieldRoutes({ plan, result }) {
  const routes = useMemo(() => machineRoutes(plan, result), [plan, result])
  const [who, setWho] = useState('drill')
  const [n, setN] = useState(0)
  const [playing, setPlaying] = useState(false)

  const list = routes ? [routes.drill, ...routes.machines] : []
  const route = list.find((r) => r.id === who) ?? list[0]
  const count = route?.passes.length ?? 0
  const at = Math.min(n, count)

  // Нова машина чи нове поле — маршрут з початку.
  useEffect(() => { setN(0); setPlaying(false) }, [who, count])

  useEffect(() => {
    if (!playing) return undefined
    // Увесь маршрут — секунд за дванадцять, хоч три проходи, хоч три тисячі.
    const stepBy = Math.max(1, Math.ceil(count / 240))
    const id = setInterval(() => {
      setN((v) => {
        const next = Math.min(count, v + stepBy)
        if (next >= count) setPlaying(false)
        return next
      })
    }, Math.max(50, 12000 / Math.min(count, 240)))
    return () => clearInterval(id)
  }, [playing, count])

  if (!routes || !route) return null

  const { fieldWidth: FW, fieldLength: FL, headland: H } = plan
  const MAX_ASPECT = 0.62
  const aspect = Math.min(FL / FW, MAX_ASPECT)
  const VB_W = 1000
  const FIELD_H = VB_W * aspect
  // Поза полем лишаємо місце під розвороти: без обсіву машина розвертається
  // за межею засіяного, і петлю треба десь намалювати.
  const PAD = 34
  const VB_H = FIELD_H + PAD * 2
  const x = (m) => (m / FW) * VB_W
  const y = (m) => PAD + (m / FL) * FIELD_H

  const top = y(H)
  const bottom = y(FL - H)
  const depth = Math.max(PAD * 0.75, (top - PAD) * 0.6)

  const ids = [...new Set(plan.strips.map((s) => s.machine))]
  const colourOf = (id) => (id === 'drill'
    ? 'var(--crop)'
    : `var(--m${(Math.max(0, ids.indexOf(id)) % 5) + 1})`)
  const colour = colourOf(route.id)

  // Шлях: прохід уздовж поля, на краю — розворот до наступного.
  const segment = (p) => (p.up
    ? `M${x(p.x)} ${bottom} L${x(p.x)} ${top}`
    : `M${x(p.x)} ${top} L${x(p.x)} ${bottom}`)
  const turn = (a, b) => {
    const yy = a.up ? top : bottom
    const d = a.up ? -depth : depth
    return `M${x(a.x)} ${yy} C${x(a.x)} ${yy + d} ${x(b.x)} ${yy + d} ${x(b.x)} ${yy}`
  }
  const pathOf = (passes, from, to) => {
    let s = ''
    for (let i = from; i < to; i++) {
      s += segment(passes[i])
      if (i + 1 < to) s += turn(passes[i], passes[i + 1])
    }
    return s
  }

  const done = pathOf(route.passes, 0, Math.max(0, at - 1))
  const todo = pathOf(route.passes, Math.max(0, at - 1), count)
  const now = at > 0 ? route.passes[at - 1] : null
  // Розворот, яким машина прийшла на поточний заїзд, — до пройденого.
  const lead = at > 1 ? turn(route.passes[at - 2], now) : ''

  const laneW = Math.max(1.6, x(0.5))

  return (
    <div className="plan-wrap routes">
      <div className="seg rt-who" role="tablist" aria-label="Чий маршрут показати">
        {list.map((r) => (
          <button key={r.id} type="button" role="tab" aria-selected={r.id === route.id}
            className={r.id === route.id ? 'is-on' : undefined}
            onClick={() => setWho(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none"
        role="img" className="fieldmap"
        aria-label={`Маршрут: ${route.label}, ${count} проходів по полю ${num(FW)} на ${num(FL)} метрів`}>
        <defs>
          <marker id="rt-arrow" viewBox="0 0 10 10" refX="5" refY="5"
            markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="rt-arrow" style={{ fill: colour }} />
          </marker>
        </defs>

        <rect x="0" y={PAD} width={VB_W} height={FIELD_H} className="f-head" />
        <rect x={x(H)} y={top} width={x(FW - 2 * H)} height={bottom - top} className="f-field" />

        {/* Колії — тонко, як орієнтир: маршрут має лягати саме на них */}
        {plan.strips.map((s, i) => (
          <rect key={i} x={x(s.centre) - laneW / 2} y={top} width={laneW} height={bottom - top}
            fill={colourOf(s.machine)} opacity="0.28" />
        ))}

        {todo && <path d={todo} className="rt-todo" style={{ stroke: colour }}
          vectorEffect="non-scaling-stroke" />}
        {done && <path d={done} className="rt-done" style={{ stroke: colour }}
          vectorEffect="non-scaling-stroke" />}
        {lead && <path d={lead} className="rt-done" style={{ stroke: colour }}
          vectorEffect="non-scaling-stroke" />}
        {now && (
          <path d={segment(now)} className="rt-now" style={{ stroke: colour }}
            markerEnd="url(#rt-arrow)" vectorEffect="non-scaling-stroke" />
        )}

        {H > 0 && (
          <rect x={x(H)} y={top} width={x(FW - 2 * H)} height={bottom - top}
            className="f-headline" vectorEffect="non-scaling-stroke" />
        )}
        <rect x="0" y={PAD} width={VB_W} height={FIELD_H} className="f-border"
          vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="rt-ctrl">
        <button type="button" className="btn btn-sm btn-quiet"
          onClick={() => {
            if (at >= count) setN(0)
            setPlaying((v) => !v)
          }}>
          {playing ? 'Пауза' : at >= count ? 'Ще раз' : 'Пуск'}
        </button>
        <input type="range" min="0" max={count} value={at}
          aria-label="Заїзд на карті"
          onChange={(e) => { setPlaying(false); setN(Number(e.target.value)) }} />
        <span className="plan-dim">{at} / {count}</span>
      </div>

      <p className="note rt-info">{infoLine(route, now, count)}</p>
    </div>
  )
}

function infoLine(route, now, count) {
  if (!now) {
    return route.id === 'drill'
      ? `Сівалка: ${count} заїздів. Натисніть «Пуск» або тягніть повзунок — карта покаже кожен заїзд і що на ньому глушити.`
      : `${route.label}: ${count} проходів по коліях, захват ${num(route.width)} м.`
  }
  const dir = now.up ? '↑ від нижнього краю' : '↓ від верхнього краю'
  if (route.id !== 'drill') {
    return `${route.label}, прохід ${now.n} з ${count}: ${dir}, посередині колії на ${num(now.x, 1)} м від лівого краю поля.`
  }
  const p = now.pass
  const off = p.tramline ? `вимкнути ${rangeText(p.cab.disabled)}` : 'сіють усі сошники'
  const strip = p.i !== now.n ? `, смуга ${p.i}` : ''
  return `Заїзд ${now.n} з ${count}${strip}: ${dir}, ${num(p.from, 1)}–${num(p.to, 1)} м від лівого краю — ${off}.`
}
