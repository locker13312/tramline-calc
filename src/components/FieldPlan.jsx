import { num } from '../lib/format'

// Усе поле згори: обсів по периметру, робоча частина, колії по всій ширині.
//
// Окремі рядки тут не малюємо навмисно: на полі 600 м завширшки з міжряддям
// 15 см їх чотири тисячі — вони злилися б у суцільну заливку. Рядки видно на
// схемі проходу нижче.
//
// Підписи розмірів — звичайний HTML поруч зі схемою, а не <text> всередині:
// SVG масштабується під ширину колонки, і текст усередині нього зменшувався б
// разом із полем до нечитабельного.
export default function FieldPlan({ plan, result }) {
  if (!plan || plan.tooSmall) return null

  const { fieldWidth: FW, fieldLength: FL, headland: H } = plan

  // Витягнуте поле розтягнуло б картку на кілька екранів. Уздовж поля нічого
  // не змінюється — колії йдуть паралельно, — тож стискаємо довжину, але
  // чесно про це кажемо.
  const MAX_ASPECT = 0.85
  const trueAspect = FL / FW
  const aspect = Math.min(trueAspect, MAX_ASPECT)
  const squeezed = trueAspect > MAX_ASPECT + 1e-9

  const VB_W = 1000
  const VB_H = VB_W * aspect
  const x = (m) => (m / FW) * VB_W
  const y = (m) => (m / FL) * VB_H

  const showPasses = plan.passes.length <= 90

  return (
    <div className="plan-wrap">
      <div className="plan-dim">
        ширина {num(FW)} м · {plan.sprayerPasses} прох. обприскувача
      </div>

      <div className="plan-body">
        <div className="plan-dim plan-dim-side">довжина {num(FL)} м</div>

        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none"
          role="img"
          aria-label={`Поле ${num(FW)} на ${num(FL)} метрів, ${plan.tramlines} технологічних колій`}>
          {/* Обсів — уся площа поля… */}
          <rect x="0" y="0" width={VB_W} height={VB_H} className="f-head" />
          {/* …а всередині робоча частина, у якій лежать колії */}
          <rect x={x(H)} y={y(H)} width={x(FW - 2 * H)} height={y(FL - 2 * H)} className="f-field" />
          {H > 0 && (
            <rect x={x(H)} y={y(H)} width={x(FW - 2 * H)} height={y(FL - 2 * H)}
              className="f-headline" vectorEffect="non-scaling-stroke" />
          )}

          {showPasses && plan.passes.map((p) => (
            <line key={`d${p.i}`} x1={x(p.to)} y1={y(H)} x2={x(p.to)} y2={y(FL - H)}
              className="f-drill" vectorEffect="non-scaling-stroke" />
          ))}

          {Array.from({ length: plan.sprayerPasses }, (_, j) => {
            const pos = Math.min(H + (j + 1) * result.sprayerWidth, FW - H)
            return (
              <line key={`s${j}`} x1={x(pos)} y1={y(H)} x2={x(pos)} y2={y(FL - H)}
                className="f-spray" vectorEffect="non-scaling-stroke" />
            )
          })}

          {plan.strips.map((s, i) => (
            <line key={i} x1={x(s.centre)} y1={y(H)} x2={x(s.centre)} y2={y(FL - H)}
              className="f-tram" vectorEffect="non-scaling-stroke" />
          ))}

          <rect x="0" y="0" width={VB_W} height={VB_H} className="f-border"
            vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div className="plan-dim">
        колії йдуть уздовж поля
        {squeezed && ` · схема стиснена по довжині у ${num(trueAspect / aspect, 1)} раза`}
      </div>

      <div className="legend">
        <span><i className="sw sw-tram" /> колія ({plan.tramlines} шт.)</span>
        <span><i className="sw sw-spray" /> межа проходу обприскувача</span>
        {H > 0 && <span><i className="sw sw-head" /> обсів {num(H)} м ({num(plan.headlandHa, 1)} га)</span>}
        {showPasses && <span><i className="sw sw-drill" /> прохід сівалки</span>}
      </div>
    </div>
  )
}
