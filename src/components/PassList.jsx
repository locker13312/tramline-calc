import { useState } from 'react'
import { rangeText, num, plural } from '../lib/format'

// Усі проходи сівалки по конкретному полю, від першого до останнього.
//
// Цикл із PassPlan показує візерунок — чотири картки, далі «повторюється».
// Людині в кабіні цього замало: вона рахує проходи не циклами, а підряд, і
// питання в неї одне — «я йду девʼятий раз, що глушити?». Тому тут кожен
// прохід має власний номер, і його видно без арифметики в голові.
//
// Стрічка номерів угорі — щоб охопити поле одним поглядом; таблиця під нею —
// щоб прочитати конкретний рядок. Друкується таблиця: аркуш у кабіні працює
// там, де телефон уже сів.
export default function PassList({ plan, rowSpacing, custom }) {
  const [onlyTramlines, setOnlyTramlines] = useState(false)
  if (!plan || plan.tooSmall || plan.tooBig || !plan.passes?.length) return null

  const passes = plan.passes
  const tramlinePasses = passes.filter((p) => p.tramline)
  const shown = onlyTramlines ? tramlinePasses : passes

  return (
    <div className="panel">
      <h2>
        проходи по полю — {passes.length}{' '}
        {plural(passes.length, 'прохід', 'проходи', 'проходів')}
      </h2>

      <p className="note" style={{ margin: '0 0 12px' }}>
        Рахунок іде від того краю поля, з якого заходить сівалка. Колію нарізають{' '}
        {tramlinePasses.length}{' '}
        {plural(tramlinePasses.length, 'прохід', 'проходи', 'проходів')} із{' '}
        {passes.length}; на решті сіють усіма сошниками. Під кожним номером
        сошників написано, через яку машину вони глухнуть — саме цими смугами
        вона потім і поїде, від обробок до жнив.
      </p>

      <div className="strip" role="list" aria-label="Усі проходи сівалки">
        {passes.map((p) => (
          <span
            key={p.i}
            role="listitem"
            className={`chip${p.tramline ? ' is-hit' : ''}${p.outside.length ? ' is-part' : ''}`}
            title={passTitle(p)}
          >
            {p.i}
          </span>
        ))}
      </div>

      <div className="passlist-bar">
        <label className="check">
          <input
            id="only-tramlines"
            type="checkbox"
            checked={onlyTramlines}
            onChange={(e) => setOnlyTramlines(e.target.checked)}
          />
          Тільки проходи з колією
        </label>
        <button type="button" className="btn btn-sm btn-quiet" onClick={() => window.print()}>
          Друк
        </button>
      </div>

      <div className="table-wrap">
        <table className="passtable">
          <thead>
            <tr>
              <th>Прохід</th>
              {plan.serpentine && <th>Хід</th>}
              <th>Від краю, м</th>
              <th>Що вимкнути</th>
              <th>Сіють сошники</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.i} className={p.tramline ? 'is-hit' : undefined}>
                <td className="pt-n">
                  {p.i}
                  {p.tramline && <i className="pt-tag">колія</i>}
                </td>
                {plan.serpentine && (
                  <td className="pt-m pt-dir">{p.back ? '← назад' : '→ туди'}</td>
                )}
                <td className="pt-m">{num(p.from, 1)} – {num(p.to, 1)}</td>
                <td className="pt-do">
                  {p.tramline
                    ? <b>{rangeText(p.cab.disabled)}</b>
                    : <span className="pt-none">нічого</span>}
                  {p.outside.length > 0 && (
                    <span className="pt-out">
                      {p.tramline ? ' + ' : ''}
                      {rangeText(p.cab.outside)} — за межею поля
                    </span>
                  )}
                  {/* Через кого саме глухне сошник. На жнивах це головне
                      питання до списку: по цій смузі поїде комбайн чи
                      перевантажувач — і якщо ні, то колію різали не під
                      нього. Номери без машин відповіді на це не дають. */}
                  {p.tramline && p.reasons?.length > 0 && (
                    <span className="pt-for">
                      {p.reasons.map((x) => (
                        `${x.label.toLowerCase()} — ${rangeText(x.rows)}`
                      )).join(' · ')}
                    </span>
                  )}
                </td>
                <td className="pt-m">{rangeText(p.cab.sowing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="note" style={{ margin: '12px 0 0' }}>
        {plan.serpentine
          ? 'Сошники рахуються зліва направо за напрямком руху — тобто з кабіни. '
            + 'Поле їдуть човником, і на зворотному проході сівалка розвернена: '
            + 'номери в таблиці вже перераховані під неї, глушити треба саме їх. '
          : 'Сошники рахуються зліва направо за напрямком руху. '}
        {custom
          ? `Розкладка своя, найменший проміжок ${num(rowSpacing * 100, 0)} см — ` +
            'приблизно таку смугу й лишає кожен вимкнений сошник.'
          : `Міжряддя ${num(rowSpacing * 100, 0)} см, тож кожен вимкнений сошник — ` +
            `смуга ${num(rowSpacing * 100, 0)} см без сходів.`}
      </p>
    </div>
  )
}

function passTitle(p) {
  const parts = [`прохід ${p.i}`]
  if (p.back) parts.push('назад')
  if (p.tramline) parts.push(`вимкнути ${rangeText(p.cab.disabled)}`)
  else parts.push('сіють усі сошники')
  if (p.cab.outside.length) parts.push(`за межею: ${rangeText(p.cab.outside)}`)
  return parts.join(' · ')
}
