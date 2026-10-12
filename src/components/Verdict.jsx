import { rangeText, plural, num } from '../lib/format'

// Головна відповідь одним реченням. Людина відкриває програму не заради
// схем і відсотків — вона хоче знати, що сказати механізаторові перед сівбою.
export default function Verdict({ result, serpentine = false }) {
  if (!result?.ok) return null

  const hit = result.passes.filter((p) => p.disabled.length)
  const k = result.cycle
  const serving = result.machines.filter((m) => m.active && m.fits)

  // Ритм — те, що вводять у термінал сівалки (Amazone, Lemken, Horsch
  // питають саме це число). Показуємо його поруч із відповіддю, щоб не
  // доводилося рахувати проходи в голові.
  const rhythm = (
    <span className="rhythm">
      ритм {result.rhythm}
      <i>{result.symmetric ? 'симетричний' : 'асиметричний'}</i>
    </span>
  )

  const forWhom = serving.length > 1
    ? ` Одна колія на ${serving.length} ${plural(serving.length, 'машину', 'машини', 'машин')}: ${serving.map((m) => m.label.toLowerCase()).join(', ')}.`
    : ''

  if (!hit.length) {
    const gap = result.passes
      .flatMap((p) => p.clearances)
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
            ? `До найближчого сошника лишається ${Math.round(gap * 100)} см. `
            : ''}
          Простежте лише, щоб усі машини заходили в поле з одного краю:
          від цього залежить усе.{forWhom}
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
          <>На <b>{p.n}-му проході з {k}</b> вимкнути сошники <b>{rangeText(p.disabled)}</b></>
        )}
        {hit.length === 2 && (
          <>
            З {k} проходів глушити на <b>{hit[0].n}-му</b> — сошники{' '}
            <b>{rangeText(hit[0].disabled)}</b>, на <b>{hit[1].n}-му</b> — сошники{' '}
            <b>{rangeText(hit[1].disabled)}</b>
          </>
        )}
        {/* Коли машин кілька, вимкнені сошники з'являються майже на кожному
            проході, і перелік у заголовку перетворюється на кашу. Тоді
            заголовок лишає головне — скільки й де, — а номери йдуть у цикл. */}
        {hit.length > 2 && (
          <>
            Глушити на <b>{hit.length} з {k}</b> проходів —{' '}
            {hit.map((x) => `${x.n}-му`).join(', ')}
          </>
        )}
      </div>
      <div className="verdict-sub">
        {hit.length > 2 && 'Які саме сошники на кожному проході — у циклі нижче. '}
        Число ритму вводять у термінал сівалки, далі цикл повторюється з першого
        проходу. Сошники рахуються зліва направо за напрямком руху.{' '}
        {/* Номери в цьому реченні — для проходу «туди». Їдучи човником, на
            зворотному проході сівалка розвернена, і ті самі смуги звуться
            іншими числами; які саме — у списку проходів по полю, прохід за
            проходом. Мовчати про це не можна: глушити дзеркально — гірше,
            ніж не глушити зовсім. */}
        {serpentine && (
          <>
            Це номери для проходу <b>туди</b>; на зворотному вони інші —
            дивіться список проходів по полю.{' '}
          </>
        )}
        Разом за цикл глушиться{' '}
        <b>{result.disabledPerCycle}</b> {plural(result.disabledPerCycle, 'сошник', 'сошники', 'сошників')} із{' '}
        {result.rowsPerCycle} — це {num(result.lossPct, 1)} % недосіяної площі.{forWhom}
      </div>
    </div>
  )
}
