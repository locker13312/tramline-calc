import { rangeText as range, plural } from '../lib/format'

// Те, що механізатор тримає перед очима в кабіні: по одному рядку на прохід,
// повторювати з першого після останнього.
export default function PassPlan({ result }) {
  if (!result?.ok) return null

  return (
    <div className="card">
      <h2>План проходів</h2>
      <p className="muted">
        Цикл із {result.cycle} {plural(result.cycle, 'проходу', 'проходів', 'проходів')} —
        далі повторюється з першого. Секції рахуються зліва направо за напрямком руху.
      </p>

      <ol className="plan">
        {result.passes.map((p) => (
          <li key={p.n} className={p.disabled.length ? 'plan-hit' : ''}>
            <span className="plan-n">{p.n}</span>
            <span className="plan-body">
              {p.partial && (
                <b className="plan-warn">
                  Половинний прохід — сіють лише секції {range(p.sowingRows)}.{' '}
                </b>
              )}
              {p.disabled.length === 0 ? (
                <span className="plan-ok">усі секції сіють</span>
              ) : (
                <>
                  вимкнути <b>{range(p.disabled)}</b>{' '}
                  <span className="muted">
                    ({p.disabled.length} {plural(p.disabled.length, 'секція', 'секції', 'секцій')})
                  </span>
                </>
              )}
              {p.clearances.map((c, i) => (
                <div key={i} className="plan-note">
                  колесо йде міжряддям, до найближчого рядка {fmt(c.gap * 100)} см
                </div>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const fmt = (v) => Math.round(v * 10) / 10
