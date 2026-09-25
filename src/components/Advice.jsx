import { num } from '../lib/format'

// Підбір колії. Сказати «колесо стало на рядок» — половина роботи; друга
// половина в тому, що колію на більшості обприскувачів можна пересунути за
// пів години ключем, і тоді глушити не доведеться нічого.
export function TrackAdvice({ advice, trackWidth }) {
  if (!advice) return null

  if (!advice.possible) {
    return (
      <div className="panel">
        <h2>колія обприскувача</h2>
        <div className="opt">
          <span className="opt-t">
            При міжрядді {num(advice.rowSpacing)} м колесо зі своїм запасом займає{' '}
            {num(advice.need)} м — воно ширше за саме міжряддя. Хоч як ставте колію,
            рядки під колесами доведеться глушити. Це нормально для зернових.
          </span>
        </div>
      </div>
    )
  }

  const good = advice.current
  return (
    <div className="panel">
      <h2>колія обприскувача</h2>
      {good ? (
        <div className="opt is-current">
          <span className="opt-v">{num(trackWidth)} м</span>
          <span className="opt-t">
            поточна колія вже добра — колесо йде міжряддям, до рядка{' '}
            {Math.round(good.clearance * 100)} см
          </span>
        </div>
      ) : (
        <>
          <p className="note" style={{ margin: '0 0 11px' }}>
            Переставте колію на одне з цих значень — і глушити не доведеться нічого.
          </p>
          <div className="advice">
            {advice.options.map(o => (
              <div key={o.track} className="opt">
                <span className="opt-v">{num(o.track)} м</span>
                <span className="opt-t">до найближчого рядка {Math.round(o.clearance * 100)} см</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Розкидач добрив мусить іти по вже нарізаних коліях. Якщо його захват не
// кратний обприскувачу, він щоразу з'їжджає в посів — і сенс колії зникає.
export function SpreaderAdvice({ spreader }) {
  if (!spreader) return null

  if (spreader.ok) {
    return (
      <div className="panel">
        <h2>розкидач</h2>
        <div className="opt is-current">
          <span className="opt-v">{num(spreader.spreaderWidth)} м</span>
          <span className="opt-t">{spreader.note}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <h2>розкидач</h2>
      <p className="note" style={{ margin: '0 0 11px' }}>
        Захват {num(spreader.spreaderWidth)} м не кратний обприскувачу{' '}
        {num(spreader.sprayerWidth)} м — виходить {num(spreader.ratio)} проходу.
        Розкидач потраплятиме в колію не щоразу, а решту часу їхатиме по посіву.
      </p>
      <div className="advice">
        {spreader.fixes?.map(f => (
          <div key={f.sprayerWidth} className="opt">
            <span className="opt-v">обприскувач {num(f.sprayerWidth)} м</span>
            <span className="opt-t">
              {f.k} прох. сівалки, розкидач іде кожною {f.every}-ю колією
            </span>
          </div>
        ))}
        {!spreader.fixes?.length && spreader.spreaderOptions?.map(o => (
          <div key={o.width} className="opt">
            <span className="opt-v">розкидач {num(o.width)} м</span>
            <span className="opt-t">
              {o.every === 1 ? 'іде кожною колією' : `іде кожною ${o.every}-ю колією`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
