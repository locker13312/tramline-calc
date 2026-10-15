import { runs, num } from '../lib/format'

// ── Прохід зблизька ───────────────────────────────────────────────────────
//
// Поле в розрізі: один повний цикл проходів сівалки, смуги під колесами
// кожної машини й сошники, які через них вимикають. Схема — головний доказ
// того, що розрахунок правильний: агроном бачить, а не вірить на слово.
//
// Коли машин кілька, смуги різних машин мають бути різного кольору. Інакше
// найважливіше губиться: чи колесо комбайна стало в ту саму смугу, що й
// колесо обприскувача, чи поряд із нею — а це різниця між нулем і двадцятьма
// заглушеними сошниками.
export default function FieldDiagram({ result }) {
  if (!result?.ok) return null

  const period = result.period
  const offsets = result.coulters
  const VB_W = 1000
  const PAD = 30
  const scale = (VB_W - PAD * 2) / period
  const x = (m) => PAD + m * scale

  // Скільком машинам малюємо смуги — стільки й кольорів треба.
  const ids = [...new Set(result.strips.map((s) => s.machine))]
  const colour = (id) => `var(--m${(ids.indexOf(id) % 5) + 1})`
  const labelOf = (id) => result.machines.find((m) => m.id === id)?.label ?? id

  const bandTop = 92
  const bandH = 136
  const VB_H = bandTop + bandH + 80

  // Полоса машин над проходами: по одному рядку на машину, щоб було видно її
  // власну сітку проходів, а не лише сліди коліс.
  const lanes = ids.map((id, i) => {
    const own = result.strips.filter((s) => s.machine === id)
    const m = result.machines.find((mm) => mm.id === id)
    return { id, i, own, m }
  })

  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} role="img"
        aria-label="Схема одного циклу проходів сівалки з технологічною колією">
        {/* Цикл цілком — дуга над усім */}
        <line x1={x(0)} y1={54} x2={x(period)} y2={54} className="d-boom" />
        <line x1={x(0)} y1={46} x2={x(0)} y2={62} className="d-boom" />
        <line x1={x(period)} y1={46} x2={x(period)} y2={62} className="d-boom" />
        <text x={x(period / 2)} y={40} className="d-label d-label-mid">
          цикл · {num(period)} м · {result.cycle} прох. сівалки
          {result.overlapRows > 0 && ` · крок ${num(result.step)} м`}
        </text>

        {/* Проходи машин: кожна своїм кольором, по центру — вісь проходу */}
        {lanes.map(({ id, own, m }, i) => {
          const y = 70 + i * 0
          const centres = [...new Set(own.map((s) => s.pass))]
          return (
            <g key={id}>
              {centres.map((p) => {
                const c = (p - 0.5) * m.width + (m.phase || 0)
                const from = c - m.width / 2
                const to = c + m.width / 2
                if (to < -0.01 || from > period + 0.01) return null
                return (
                  <line key={`${id}-${p}`}
                    x1={x(Math.max(from, 0))} y1={y} x2={x(Math.min(to, period))} y2={y}
                    stroke={colour(id)} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
                )
              })}
            </g>
          )
        })}

        {/* Проходи сівалки — кожен своєю новою землею, а не рамою: з
            нахльостом рами налазять одна на одну, і намальовані рамами
            проходи зливалися б у пляму. Нахльост підписаний окремо. */}
        {result.passes.map((p, i) => {
          const from = Math.max(p.newFrom ?? p.from, 0)
          const to = Math.min(p.to, period)
          if (to <= from) return null
          return (
            <g key={p.n}>
              <rect x={x(from)} y={bandTop} width={(to - from) * scale} height={bandH}
                className={`d-pass ${i % 2 ? 'd-pass-alt' : ''} ${p.disabled.length ? 'd-pass-hit' : ''}`} />
              <text x={x((from + to) / 2)}
                y={bandTop + bandH + 20} className="d-label d-label-mid">
                прохід {p.n}{p.partial ? ' (половинний)' : ''}
              </text>
            </g>
          )
        })}

        {/* Смуги під колесами — кольором машини */}
        {result.strips.map((s, i) => (
          <rect key={i} x={x(s.from)} y={bandTop - 10} width={(s.to - s.from) * scale}
            height={bandH + 20} fill={colour(s.machine)} opacity="0.22" rx="2" />
        ))}

        {/* Сошники: тонка лінія на кожен */}
        {result.passes.flatMap((p) =>
          offsets.map((o, j) => {
            const m = j + 1
            const pos = p.from + o
            if (pos < -0.01 || pos > period + 0.01) return null
            const off = p.disabled.includes(m)
            // Сошник нахльоста нічого не кладе, а стоїть точно там, де
            // рядок сусіднього проходу: дві лінії в одному місці.
            if (p.overlapClosed?.includes(m)) return null
            if (p.partial && p.sowingRows && !p.sowingRows.includes(m)) return null
            return (
              <line key={`${p.n}-${m}`} x1={x(pos)} y1={bandTop + 12} x2={x(pos)} y2={bandTop + bandH - 12}
                className={off ? 'd-row-off' : 'd-row'} />
            )
          }),
        )}

        {/* Один підпис на суцільну групу вимкнених сошників. Поштучні номери
            при міжрядді 15 см налазять один на одного. */}
        {result.passes.flatMap((p) =>
          runs(p.disabled).map(([lo, hi]) => {
            const mid = p.from + (offsets[lo - 1] + offsets[hi - 1]) / 2
            if (mid < -0.01 || mid > period + 0.01) return null
            return (
              <text key={`n-${p.n}-${lo}`} x={x(mid)} y={bandTop - 16} className="d-num">
                {lo === hi ? lo : `${lo}–${hi}`}
              </text>
            )
          }),
        )}

        {/* Лінійка по межах проходів сівалки */}
        <line x1={x(0)} y1={VB_H - 28} x2={x(period)} y2={VB_H - 28} className="d-ruler" />
        {Array.from({ length: result.cycle + 1 }, (_, i) => {
          const pos = i * (result.step || result.drillWidth)
          return (
            <g key={i}>
              <line x1={x(pos)} y1={VB_H - 33} x2={x(pos)} y2={VB_H - 23} className="d-ruler" />
              <text x={x(pos)} y={VB_H - 8} className="d-label d-label-mid">{num(pos, 1)} м</text>
            </g>
          )
        })}
      </svg>

      <div className="legend">
        <span><i className="sw sw-row" /> засіяний сошник</span>
        <span><i className="sw sw-off" /> вимкнений сошник</span>
        {result.overlapRows > 0 && (
          <span>
            нахльост {num(result.overlapWidth)} м: сошники {result.overlapClosed.join(', ')}
            {' '}закриті, рядки під ними кладе сусідній прохід
          </span>
        )}
        {ids.map((id) => (
          <span key={id}>
            <i className="sw sw-strip" style={{ background: colour(id) }} /> слід «{labelOf(id)}»
          </span>
        ))}
      </div>
    </div>
  )
}
