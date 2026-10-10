import { num } from '../lib/format'

// ── Підбір колісної бази ──────────────────────────────────────────────────
//
// Сказати «колесо стало на сошник» — половина роботи. Друга половина в тому,
// що колію на більшості машин пересувають за пів години ключем, і тоді
// глушити не доведеться нічого.
//
// З кількома машинами питання стає іншим і важливішим: мало знайти добре
// значення для обприскувача — треба знайти таке, що добре водночас для всіх.
// Саме до одного значення й зводять колісні бази в господарствах, що тримають
// постійні колії; усе інше — напівміра.
export function TrackAdvice({ advice }) {
  if (!advice?.machines?.length) return null

  const fitting = advice.machines
  const common = advice.common ?? []
  const allGood = fitting.every((m) => m.current)

  return (
    <div className="panel">
      <h2>колісна база</h2>

      {common.length > 0 && !allGood && (
        <>
          <p className="note" style={{ margin: '-4px 0 11px' }}>
            {fitting.length > 1
              ? 'Ці значення минають сошники в усіх машин одночасно. Звести парк до одного з них — і колія не коштує жодного сошника:'
              : 'Переставте базу на одне з цих значень — і глушити не доведеться нічого:'}
          </p>
          <div className="mrow-opts" style={{ marginBottom: 14 }}>
            {common.slice(0, 6).map((t) => (
              <span key={t} className="mchip is-good">{num(t)} м</span>
            ))}
          </div>
        </>
      )}

      {common.length === 0 && fitting.length > 1 && fitting.some((m) => m.possible) && (
        <p className="note" style={{ margin: '-4px 0 11px' }}>
          Спільного значення для всього парку немає — захвати машин розставляють
          їхні колеса по-різному. Нижче — що можливо для кожної окремо.
        </p>
      )}

      <div className="mrows">
        {fitting.map((m, i) => (
          <div key={m.id} className="mrow" style={{ '--m': `var(--m${(i % 5) + 1})` }}>
            <div className="mrow-head">
              <i className="mdot" aria-hidden="true" />
              <b>{m.label}</b>
              <span className="mrow-w">
                зараз {m.axles.map((a) => num(a.trackWidth)).join(' / ')} м
              </span>
            </div>

            {!m.possible ? (
              <div className="mrow-text">
                При міжрядді {num(m.rowSpacing)} м колесо із запасом займає{' '}
                {num(m.need)} м — воно ширше за саме міжряддя. Хоч як ставте базу,
                сошники під колесами доведеться глушити. Для зернових це норма.
              </div>
            ) : m.current && m.allAxlesGood ? (
              <div className="mrow-text">
                База вже добра — колеса йдуть міжряддям, до найближчого сошника{' '}
                {Math.round(m.current.clearance * 100)} см.
              </div>
            ) : (
              <>
                <div className="mrow-text">
                  {m.current
                    ? 'Передня вісь добра, задня — ні. Добрі значення для цієї машини:'
                    : 'Колеса стають на сошники. Добрі значення для цієї машини:'}
                </div>
                <div className="mrow-opts">
                  {m.options.map((o) => (
                    <span key={o.track}
                      className={`mchip${common.some((t) => Math.abs(t - o.track) < 1e-9) ? ' is-good' : ''}`}
                      title={`до найближчого сошника ${Math.round(o.clearance * 100)} см`}>
                      {num(o.track)} м
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
