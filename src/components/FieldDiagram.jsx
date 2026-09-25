import { runs, num } from '../lib/format'

// Поле в розрізі: один повний цикл проходів сівалки, смуги під колесами
// обприскувача і рядки, які через них вимикають. Схема — головний доказ
// того, що розрахунок правильний: агроном бачить, а не вірить на слово.
export default function FieldDiagram({ result, rows, rowSpacing }) {
  if (!result?.ok) return null

  const S = result.sprayerWidth
  const VB_W = 1000              // ширина системи координат SVG
  const PAD = 26
  const scale = (VB_W - PAD * 2) / S
  const x = (m) => PAD + m * scale

  const bandTop = 74
  const bandH = 132
  const VB_H = bandTop + bandH + 78

  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} role="img"
        aria-label="Схема проходів сівалки з технологічною колією">
        {/* Захват обприскувача — одна дуга над усім циклом */}
        <line x1={x(0)} y1={40} x2={x(S)} y2={40} className="d-boom" />
        <line x1={x(0)} y1={30} x2={x(0)} y2={50} className="d-boom" />
        <line x1={x(S)} y1={30} x2={x(S)} y2={50} className="d-boom" />
        <text x={x(S / 2)} y={26} className="d-label d-label-mid">
          обприскувач · {num(S)} м
        </text>

        {/* Проходи сівалки */}
        {result.passes.map((p, i) => (
          <g key={p.n}>
            <rect x={x(p.from)} y={bandTop} width={(p.to - p.from) * scale} height={bandH}
              className={`d-pass ${i % 2 ? 'd-pass-alt' : ''} ${p.disabled.length ? 'd-pass-hit' : ''}`} />
            <text x={x((p.from + p.to) / 2)} y={bandTop + bandH + 20} className="d-label d-label-mid">
              прохід {p.n}{p.partial ? ' (половинний)' : ''}
            </text>
          </g>
        ))}

        {/* Смуги під колесами */}
        {result.strips.map((s, i) => (
          <rect key={i} x={x(s.from)} y={bandTop - 8} width={(s.to - s.from) * scale}
            height={bandH + 16} className="d-strip" />
        ))}

        {/* Рядки: тонка лінія на кожну висівну секцію */}
        {result.passes.flatMap((p) =>
          Array.from({ length: rows }, (_, j) => {
            const m = j + 1
            const pos = p.from + (m - 0.5) * rowSpacing
            const off = p.disabled.includes(m)
            const unsown = p.partial && p.sowingRows && !p.sowingRows.includes(m)
            if (unsown) return null
            return (
              <line key={`${p.n}-${m}`} x1={x(pos)} y1={bandTop + 10} x2={x(pos)} y2={bandTop + bandH - 10}
                className={off ? 'd-row-off' : 'd-row'} />
            )
          }),
        )}

        {/* Один підпис на суцільну групу вимкнених секцій. Поштучні номери
            при міжрядді 15 см налазять один на одного. */}
        {result.passes.flatMap((p) =>
          runs(p.disabled).map(([lo, hi]) => {
            const mid = p.from + ((lo + hi) / 2 - 0.5) * rowSpacing
            return (
              <text key={`n-${p.n}-${lo}`} x={x(mid)} y={bandTop - 14} className="d-num">
                {lo === hi ? lo : `${lo}–${hi}`}
              </text>
            )
          }),
        )}

        {/* Лінійка */}
        <line x1={x(0)} y1={VB_H - 28} x2={x(S)} y2={VB_H - 28} className="d-ruler" />
        {Array.from({ length: result.cycle + 1 }, (_, i) => {
          const pos = result.passes[0].from + i * result.drillWidth
          return (
            <g key={i}>
              <line x1={x(pos)} y1={VB_H - 33} x2={x(pos)} y2={VB_H - 23} className="d-ruler" />
              <text x={x(pos)} y={VB_H - 8} className="d-label d-label-mid">{num(pos, 1)} м</text>
            </g>
          )
        })}
      </svg>

      <div className="legend">
        <span><i className="sw sw-row" /> засіяний рядок</span>
        <span><i className="sw sw-off" /> вимкнена секція</span>
        <span><i className="sw sw-strip" /> слід колеса обприскувача</span>
      </div>
    </div>
  )
}
