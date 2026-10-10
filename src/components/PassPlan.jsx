import { rangeText, plural } from '../lib/format'

// Цикл проходів у вигляді, який можна тримати перед очима в кабіні: одна
// картка на прохід, зліва направо, далі спочатку.
//
// Коли машин кілька, важливо не лише що глушити, а й через кого: сошники 5–8
// під обприскувач і 1–4 під комбайн — це два різні рішення, і господар має
// право побачити, за що саме платить.
export default function PassPlan({ result }) {
  if (!result?.ok) return null
  const many = result.machines.filter((m) => m.active && m.fits).length > 1

  return (
    <div className="panel">
      <h2>цикл сівби — {result.cycle} {plural(result.cycle, 'прохід', 'проходи', 'проходів')}</h2>

      <div className="cycle">
        {result.passes.map((p) => (
          <div key={p.n} className={`cycle-pass${p.disabled.length ? ' is-hit' : ''}`}>
            <div className="cycle-n">ПРОХІД {p.n}</div>
            <div className="cycle-what">
              {p.disabled.length ? rangeText(p.disabled) : 'сіють усі'}
            </div>
            {many && p.reasons.map((r) => (
              <div key={r.machine} className="cycle-why">
                <span>{r.label}</span> {rangeText(r.rows)}
              </div>
            ))}
            {!many && p.disabled.length > 0 && (
              <div className="cycle-note">вимкнути перед проходом</div>
            )}
            {p.partial && (
              <div className="cycle-note">половинний: сіють лише {rangeText(p.sowingRows)}</div>
            )}
            {p.clearances.map((c, i) => (
              <div key={i} className="cycle-note">
                {c.label}: колесо міжряддям, до сошника {Math.round(c.gap * 100)} см
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
