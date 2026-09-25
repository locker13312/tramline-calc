import { rangeText, plural } from '../lib/format'

// Головна відповідь одним реченням. Людина відкриває програму не заради
// схем і відсотків — вона хоче знати, що сказати механізаторові перед сівбою.
export default function Verdict({ result, terms }) {
  if (!result?.ok) return null

  const hit = result.passes.filter(p => p.disabled.length)
  const k = result.cycle

  if (!hit.length) {
    const gap = result.passes
      .flatMap(p => p.clearances)
      .reduce((min, c) => Math.min(min, c.gap), Infinity)
    return (
      <div className="verdict is-clean">
        <div className="verdict-kicker">що робити на сівбі</div>
        <div className="verdict-line">Нічого не глушити — колеса йдуть міжряддям.</div>
        <div className="verdict-sub">
          {Number.isFinite(gap)
            ? `До найближчого рядка лишається ${Math.round(gap * 100)} см. `
            : ''}
          Простежте лише, щоб сівалка й обприскувач заходили в поле з одного краю:
          від цього залежить усе.
        </div>
      </div>
    )
  }

  const one = hit.length === 1
  const p = hit[0]

  return (
    <div className="verdict">
      <div className="verdict-kicker">що робити на сівбі</div>
      <div className="verdict-line">
        {one ? (
          <>
            На <b>{p.n}-му проході з {k}</b> вимкнути секції <b>{rangeText(p.disabled)}</b>
          </>
        ) : (
          <>
            Вимкнути {hit.map((x, i) => (
              <span key={x.n}>
                {i > 0 && ', '}
                на <b>{x.n}-му</b> — секції <b>{rangeText(x.disabled)}</b>
              </span>
            ))} з {k} проходів
          </>
        )}
      </div>
      <div className="verdict-sub">
        Далі цикл повторюється з першого проходу. Секції рахуються зліва направо
        за напрямком руху. Разом за цикл глушиться{' '}
        {result.disabledPerCycle} {plural(result.disabledPerCycle, 'секція', 'секції', 'секцій')} із{' '}
        {result.rowsPerCycle}.
      </div>
    </div>
  )
}
