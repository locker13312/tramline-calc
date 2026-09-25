import { rangeText, plural } from '../lib/format'

// Головна відповідь одним реченням. Людина відкриває програму не заради
// схем і відсотків — вона хоче знати, що сказати механізаторові перед сівбою.
export default function Verdict({ result, terms }) {
  if (!result?.ok) return null

  const hit = result.passes.filter(p => p.disabled.length)
  const k = result.cycle

  // Ритм — те, що вводять у термінал сівалки (Amazone, Lemken, Horsch
  // питають саме це число). Показуємо його поруч із відповіддю, щоб не
  // доводилося рахувати проходи в голові.
  const rhythm = (
    <span className="rhythm">
      ритм {result.rhythm}
      <i>{result.symmetric ? 'симетричний' : 'асиметричний'}</i>
    </span>
  )

  if (!hit.length) {
    const gap = result.passes
      .flatMap(p => p.clearances)
      .reduce((min, c) => Math.min(min, c.gap), Infinity)
    return (
      <div className="verdict is-clean">
        <div className="verdict-head">
          <span className="verdict-kicker">що робити на сівбі</span>
          {rhythm}
        </div>
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
      <div className="verdict-head">
        <span className="verdict-kicker">що робити на сівбі</span>
        {rhythm}
      </div>
      <div className="verdict-line">
        {one && (
          <>На <b>{p.n}-му проході з {k}</b> вимкнути секції <b>{rangeText(p.disabled)}</b></>
        )}
        {hit.length === 2 && (
          <>
            З {k} проходів глушити на <b>{hit[0].n}-му</b> — секції{' '}
            <b>{rangeText(hit[0].disabled)}</b>, на <b>{hit[1].n}-му</b> — секції{' '}
            <b>{rangeText(hit[1].disabled)}</b>
          </>
        )}
        {/* Асиметричний ритм зачіпає чотири проходи й більше — перелік секцій
            у заголовку перетворюється на кашу, тож він лишається в картках
            циклу нижче. */}
        {hit.length > 2 && (
          <>
            З {k} проходів глушити на{' '}
            <b>{hit.map(x => `${x.n}-му`).join(', ')}</b> — по половині колії на кожному
          </>
        )}
      </div>
      <div className="verdict-sub">
        {hit.length > 2 && 'Які саме секції на кожному проході — у циклі нижче. '}
        Число ритму вводять у термінал сівалки, далі цикл повторюється з першого
        проходу. Секції рахуються зліва направо за напрямком руху.
        Разом за цикл глушиться{' '}
        {result.disabledPerCycle} {plural(result.disabledPerCycle, 'секція', 'секції', 'секцій')} із{' '}
        {result.rowsPerCycle}.
      </div>
    </div>
  )
}
