import { num, plural } from '../lib/format'

// ── Способи засіяти це поле ───────────────────────────────────────────────
//
// Головна відповідь каже, що робити при одному наборі налаштувань. Але
// налаштування — не даність: робоча ширина машини, нахльост, половинний
// перший прохід — усе це ручки, які крутить механізатор, а не властивості
// техніки. Тому поруч із відповіддю стоїть список способів: кожен порахований
// до кінця, із ціною, початком і кінцем поля, і кожен ставиться у форму одним
// натисканням.
//
// Що тут навмисно відсутнє — порада поміняти техніку. Штангу й сівалку не
// обирають під колію; колію нарізають під те, що стоїть у дворі.
export default function Ways({ list, onTake, active, compact = false }) {
  if (!list?.length) return null

  return (
    <div className="panel">
      <h2>способи засіяти це поле</h2>
      <p className="note" style={{ margin: '0 0 12px' }}>
        Техніка та сама — міняється тільки те, якою частиною захвату працювати,
        чи заходити сівалкою на засіяне й з якого проходу починати. Усі
        {' '}{list.length} {plural(list.length, 'спосіб', 'способи', 'способів')}{' '}
        пораховані тим самим розрахунком, що й відповідь угорі, і впорядковані
        від найдешевшого.
      </p>

      <div className="ways">
        {list.map((w) => {
          const on = active === w.id
          return (
            <div key={w.id} className={`way${on ? ' is-on' : ''}`}>
              <div className="way-head">
                <span className="way-n">спосіб {w.n}</span>
                <span className="way-key">
                  {num(w.baseWidth)} м × {w.rhythm}
                  {w.overlapRows > 0 && ` · нахльост ${w.overlapRows}`}
                  {w.halfStart && ' · половинний перший'}
                </span>
                {/* Скільком машинам з тих, що хотіли в колії, вона
                    нарізана. Спосіб, у якому обприскувач лишився поза
                    колією, — відповідь на інше питання, і це має бути
                    видно до того, як його поставлять у форму. */}
                {w.wanted > 1 && (
                  <span className={`way-served${w.served < w.wanted ? ' is-part' : ''}`}>
                    у колії {w.served} з {w.wanted}
                  </span>
                )}
                {on
                  ? <span className="way-on">зараз у формі</span>
                  : (
                    <button type="button" className="btn btn-sm"
                      onClick={() => onTake(w.patch)}>
                      Поставити
                    </button>
                  )}
              </div>

              <div className="way-figs">
                <Fig k="недосіяно" v={`${num(w.lostPct, 1)} %`}
                  s={w.lostHa != null ? `${num(w.lostHa, 2)} га` : null} />
                <Fig k="перекриття" v={`${num(w.boomOverlap)} м`}
                  s={`${num(w.boomOverlapPct, 1)} % обробки`} />
                <Fig k="крок сівалки" v={`${num(w.step)} м`}
                  s={w.overlapRows > 0 ? `рама ${num(w.drillWidth)} м` : 'рама як є'} />
                <Fig k="проходів" v={w.passes != null ? String(w.passes) : '—'}
                  s={w.tramlines != null ? `${w.tramlines} ${plural(w.tramlines, 'колія', 'колії', 'колій')}` : null} />
              </div>

              {!compact && (
                <ul className="way-why">
                  {w.why.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              )}

              {!compact && (w.start.length > 0 || w.finish.length > 0) && (
                <div className="way-ends">
                  {w.start.length > 0 && (
                    <div className="way-end">
                      <b>як починати поле</b>
                      {w.start.map((line, i) => <p key={i}>{line}</p>)}
                    </div>
                  )}
                  {w.finish.length > 0 && (
                    <div className="way-end">
                      <b>як закінчувати</b>
                      {w.finish.map((line, i) => <p key={i}>{line}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="note" style={{ margin: '12px 0 0' }}>
        Ціна способу зводить різне до одного: недосіяна площа дорожча за
        перекриття штанги, перекриття — за зайвий прохід сівалки. Тому перший у
        списку не завжди той, у кого найменше перекриття.
      </p>
    </div>
  )
}

function Fig({ k, v, s }) {
  return (
    <div className="way-fig">
      <span className="way-fig-k">{k}</span>
      <span className="way-fig-v">{v}</span>
      {s && <span className="way-fig-s">{s}</span>}
    </div>
  )
}
