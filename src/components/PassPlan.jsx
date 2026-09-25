import { rangeText, plural } from '../lib/format'

// Цикл проходів у вигляді, який можна тримати перед очима в кабіні: одна
// картка на прохід, зліва направо, далі спочатку.
export default function PassPlan({ result }) {
  if (!result?.ok) return null

  return (
    <div className="panel">
      <h2>цикл сівби — {result.cycle} {plural(result.cycle, 'прохід', 'проходи', 'проходів')}</h2>

      <div className="cycle">
        {result.passes.map((p) => (
          <div key={p.n} className={`cycle-pass${p.disabled.length ? ' is-hit' : ''}`}>
            <div className="cycle-n">ПРОХІД {p.n}</div>
            <div className="cycle-what">
              {p.disabled.length ? `вимкнути ${rangeText(p.disabled)}` : 'сіють усі'}
            </div>
            {p.partial && (
              <div className="cycle-note">половинний: сіють лише {rangeText(p.sowingRows)}</div>
            )}
            {p.clearances.map((c, i) => (
              <div key={i} className="cycle-note">
                колесо міжряддям, до рядка {Math.round(c.gap * 100)} см
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
