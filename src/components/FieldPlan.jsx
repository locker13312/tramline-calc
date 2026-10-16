import { num, plural } from '../lib/format'

// ── Поле згори ────────────────────────────────────────────────────────────
//
// Усе поле одним поглядом: колії по всій
// ширині. Карта тут не для краси — на ній видно те, чого не видно в числах:
// де лягає перша колія, скільки їх до краю і наскільки останній прохід
// виходить неповним.
//
// Окремі сошники не малюємо навмисно: на полі 600 м завширшки з міжряддям
// 15 см їх чотири тисячі — вони злилися б у суцільну заливку. Сошники видно
// на схемі проходу нижче.
//
// Підписи розмірів — звичайний HTML поруч зі схемою, а не <text> всередині:
// SVG масштабується під ширину колонки, і текст усередині нього зменшувався б
// разом із полем до нечитабельного.
export default function FieldPlan({ plan, result }) {
  // tooSmall і tooBig — відмови, а не плани: у них немає ні проходів, ні
  // колій, і малювати тут нічого. Перевірка стоїть і тут, і в того, хто
  // викликає: карта не має права впасти через поле, якого не буває.
  if (!plan || plan.tooSmall || plan.tooBig) return null

  const { fieldWidth: FW, fieldLength: FL, headland: H } = plan
  const S = result.baseWidth

  // Витягнуте поле розтягнуло б картку на кілька екранів. Уздовж поля нічого
  // не змінюється — колії йдуть паралельно, — тож стискаємо довжину, але
  // чесно про це кажемо.
  const MAX_ASPECT = 0.62
  const trueAspect = FL / FW
  const aspect = Math.min(trueAspect, MAX_ASPECT)
  const squeezed = trueAspect > MAX_ASPECT + 1e-9

  const VB_W = 1000
  const VB_H = VB_W * aspect
  const x = (m) => (m / FW) * VB_W
  const y = (m) => (m / FL) * VB_H

  // Проходи сівалки на 600-метровому полі з міжряддям 15 см — це 167 ліній
  // на тисячу пікселів. Вони зливаються в сіру кашу й затирають колії, тому
  // показуємо їх лише коли між ними лишається хоч кілька пікселів.
  const showPasses = plan.passes.length <= 70

  const ids = [...new Set(plan.strips.map((s) => s.machine))]
  const colour = (id) => `var(--m${(ids.indexOf(id) % 5) + 1})`
  const labelOf = (id) => result.machines.find((m) => m.id === id)?.label ?? id

  // Колії малюємо коридорами, а не нитками: саме така ширина недосіяної
  // смуги й лишається на полі, і на карті мусить бути видно, що це смуга.
  const laneW = Math.max(1.6, x(Math.max(...plan.strips.map((s) => s.to - s.from), 0.4)))

  return (
    <div className="plan-wrap">
      <div className="plan-head">
        <span className="plan-dim">ширина {num(FW)} м</span>
        <span className="plan-dim">
          {plan.tramlines} {plural(plan.tramlines, 'колія', 'колії', 'колій')} через {num(S)} м
        </span>
      </div>

      <div className="plan-body">
        <div className="plan-dim plan-dim-side">довжина {num(FL)} м</div>

        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none"
          role="img" className="fieldmap"
          aria-label={`Поле ${num(FW)} на ${num(FL)} метрів, ${plan.tramlines} технологічних колій`}>
          <defs>
            {/* Фактура сходів: не заливка, а дрібна штриховка вздовж руху —
                видно напрямок проходів, і колії читаються як розриви в ній. */}
            <pattern id="crop-rows" width="7" height="7" patternUnits="userSpaceOnUse">
              <rect width="7" height="7" className="f-field" />
              <line x1="3.5" y1="0" x2="3.5" y2="7" className="f-croprow"
                vectorEffect="non-scaling-stroke" />
            </pattern>
            <pattern id="headland" width="9" height="9" patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)">
              <rect width="9" height="9" className="f-head" />
              <line x1="0" y1="4.5" x2="9" y2="4.5" className="f-headrow"
                vectorEffect="non-scaling-stroke" />
            </pattern>
          </defs>

          {/* Обсів — уся площа поля… */}
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#headland)" />
          {/* …а всередині робоча частина, у якій лежать колії */}
          <rect x={x(H)} y={y(H)} width={x(FW - 2 * H)} height={y(FL - 2 * H)}
            fill="url(#crop-rows)" />

          {showPasses && plan.passes.map((p) => (
            <line key={`d${p.i}`} x1={x(p.to)} y1={y(H)} x2={x(p.to)} y2={y(FL - H)}
              className="f-drill" vectorEffect="non-scaling-stroke" />
          ))}

          {/* Межі проходів головної машини */}
          {Array.from({ length: plan.basePasses }, (_, j) => {
            const pos = Math.min(H + (j + 1) * S, FW - H)
            return (
              <line key={`s${j}`} x1={x(pos)} y1={y(H)} x2={x(pos)} y2={y(FL - H)}
                className="f-spray" vectorEffect="non-scaling-stroke" />
            )
          })}

          {/* Колії — коридорами, кольором машини */}
          {plan.strips.map((s, i) => (
            <rect key={i}
              x={x(s.centre) - laneW / 2} y={y(H)}
              width={laneW} height={y(FL - 2 * H)}
              fill={colour(s.machine)} opacity="0.85" />
          ))}

          {H > 0 && (
            <rect x={x(H)} y={y(H)} width={x(FW - 2 * H)} height={y(FL - 2 * H)}
              className="f-headline" vectorEffect="non-scaling-stroke" />
          )}
          <rect x="0" y="0" width={VB_W} height={VB_H} className="f-border"
            vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div className="plan-head">
        <span className="plan-dim">колії йдуть уздовж поля</span>
        {squeezed && (
          <span className="plan-dim">
            схема стиснена по довжині у {num(trueAspect / aspect, 1)} раза
          </span>
        )}
      </div>

      <div className="legend">
        {ids.map((id) => (
          <span key={id}>
            <i className="sw sw-tram" style={{ background: colour(id) }} /> колія «{labelOf(id)}»
          </span>
        ))}
        <span><i className="sw sw-spray" /> межа проходу головної машини</span>
        {H > 0 && <span><i className="sw sw-head" /> обсів {num(H)} м ({num(plan.headlandHa, 1)} га)</span>}
        {showPasses && <span><i className="sw sw-drill" /> прохід сівалки</span>}
      </div>
    </div>
  )
}
