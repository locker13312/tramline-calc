import { useEffect, useMemo, useState } from 'react'
import { computeTramlines, fieldPlan } from './lib/tramline'
import { CROPS, SPRAYER_WIDTHS, SPRAYER_PRESETS, DEFAULTS } from './lib/presets'
import { num } from './lib/format'
import FieldDiagram from './components/FieldDiagram'
import FieldPlan from './components/FieldPlan'
import PassPlan from './components/PassPlan'

const STORE = 'tramline_input'

export default function App() {
  const [input, setInput] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || '{}') } }
    catch { return DEFAULTS }
  })

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(input)) } catch { /* приватний режим */ }
  }, [input])

  const set = (k, v) => setInput((s) => ({ ...s, [k]: v }))
  // onNum, а не num: num з lib/format форматує числа для показу.
  const onNum = (k) => (e) => set(k, Number(e.target.value))

  const result = useMemo(() => computeTramlines(input), [input])
  const plan = useMemo(
    () => fieldPlan(result, {
      fieldWidth: input.fieldWidth,
      fieldLength: input.fieldLength,
      rowSpacing: input.rowSpacing,
    }),
    [result, input.fieldWidth, input.fieldLength, input.rowSpacing],
  )

  const pickCrop = (key) => {
    const c = CROPS.find((x) => x.key === key)
    if (c) setInput((s) => ({ ...s, crop: key, rowSpacing: c.rowSpacing, rows: c.rows }))
  }
  const pickSprayer = (key) => {
    const p = SPRAYER_PRESETS.find((x) => x.key === key)
    if (p) setInput((s) => ({ ...s, trackWidth: p.trackWidth, tyreWidth: p.tyreWidth }))
  }

  return (
    <div className="app">
      <header className="head">
        <h1>Технологічна колія</h1>
        <p>
          Рахує, які висівні секції вимкнути на сівалці й на якому проході, щоб на полі
          лишилися смуги під колеса обприскувача — і посів не толочили щоразу заново.
        </p>
      </header>

      <div className="cols">
        <form className="card form" onSubmit={(e) => e.preventDefault()}>
          <h2>Вхідні дані</h2>

          <label>
            Культура
            <select value={input.crop} onChange={(e) => pickCrop(e.target.value)}>
              {CROPS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>

          <div className="pair">
            <label>
              Секцій на сівалці
              <input type="number" min="2" step="1" value={input.rows} onChange={onNum('rows')} />
            </label>
            <label>
              Міжряддя, м
              <input type="number" min="0.05" step="0.05" value={input.rowSpacing} onChange={onNum('rowSpacing')} />
            </label>
          </div>

          <p className="hint">Захват сівалки — <b>{num(input.rows * input.rowSpacing)} м</b></p>

          <label>
            Захват обприскувача, м
            <input type="number" min="1" step="0.1" list="sprayer-widths"
              value={input.sprayerWidth} onChange={onNum('sprayerWidth')} />
            <datalist id="sprayer-widths">
              {SPRAYER_WIDTHS.map((w) => <option key={w} value={w} />)}
            </datalist>
          </label>

          <label>
            Ходова обприскувача
            <select defaultValue="" onChange={(e) => pickSprayer(e.target.value)}>
              <option value="" disabled>— обрати типову —</option>
              {SPRAYER_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>

          <div className="pair">
            <label>
              Колія, м
              <input type="number" min="0.5" step="0.05" value={input.trackWidth} onChange={onNum('trackWidth')} />
            </label>
            <label>
              Шина, м
              <input type="number" min="0.1" step="0.01" value={input.tyreWidth} onChange={onNum('tyreWidth')} />
            </label>
          </div>

          <label>
            Запас з кожного боку, м
            <input type="number" min="0" step="0.05" value={input.margin} onChange={onNum('margin')} />
            <span className="hint">Щоб колесо не чіпало рядок при зносі кермування.</span>
          </label>

          <label className="check">
            <input type="checkbox" checked={input.halfStart}
              onChange={(e) => set('halfStart', e.target.checked)} />
            Почати поле половинним проходом сівалки
          </label>

          <div className="pair">
            <label>
              Ширина поля, м
              <input type="number" min="1" step="10" value={input.fieldWidth} onChange={onNum('fieldWidth')} />
            </label>
            <label>
              Довжина поля, м
              <input type="number" min="1" step="10" value={input.fieldLength} onChange={onNum('fieldLength')} />
            </label>
          </div>
          <p className="hint">
            Площа — <b>{num((input.fieldWidth * input.fieldLength) / 10000, 1)} га</b>
          </p>
        </form>

        <div className="results">
          {!result.ok ? (
            <div className="card bad">
              <h2>Колія не складається</h2>
              {result.warnings.map((w, i) => <p key={i}>{w}</p>)}
              <Fixes s={result.suggestions} rowSpacing={input.rowSpacing} />
            </div>
          ) : (
            <>
              <div className="card">
                <div className="stats">
                  <Stat label="Коефіцієнт" value={String(result.ratio)}
                    sub={`${result.parity === 'even' ? 'парний' : 'непарний'} — колія кожні ${result.cycle} прох.`} />
                  <Stat label="Захват сівалки" value={`${num(result.drillWidth)} м`} sub={`${input.rows} секцій`} />
                  <Stat label="Вимкнено за цикл" value={String(result.disabledPerCycle)}
                    sub={`з ${result.rowsPerCycle} рядків`} />
                  <Stat label="Втрата площі" value={`${num(result.lossPct, 1)} %`}
                    sub={plan ? `≈ ${num(plan.lostHa, 2)} га з поля` : '—'} />
                </div>
                {result.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
              </div>

              {plan && (
                <div className="card">
                  <h2>Усе поле</h2>
                  <div className="stats">
                    <Stat label="Колій на полі" value={String(plan.tramlines)}
                      sub={`${plan.sprayerPasses} прох. обприскувача`} />
                    <Stat label="Проходів сівалки" value={String(plan.passes.length)}
                      sub={plan.passes.at(-1)?.width < result.drillWidth
                        ? `останній неповний — ${num(plan.passes.at(-1).width)} м`
                        : 'усі повні'} />
                    <Stat label="Довжина колій" value={`${num(plan.tramlineKm, 1)} км`}
                      sub={`${plan.disabledRows} вимкнених рядків`} />
                    <Stat label="Площа поля" value={`${num(plan.areaHa, 1)} га`}
                      sub={`під колією ${num(plan.lostHa, 2)} га`} />
                  </div>
                  <FieldPlan plan={plan} result={result} />
                  {plan.lastSprayerPass < result.sprayerWidth - 0.01 && (
                    <p className="warn">
                      Останній прохід обприскувача виходить неповним — {num(plan.lastSprayerPass)} м
                      замість {num(result.sprayerWidth)} м. Це нормально, але саме там колія
                      може лягти не там, де очікуєте: перевірте край поля окремо.
                    </p>
                  )}
                </div>
              )}

              <div className="card">
                <h2>Схема проходу</h2>
                <p className="muted">
                  Один цикл зблизька: видно кожен рядок і те, які секції глушаться.
                </p>
                <FieldDiagram result={result} rows={input.rows} rowSpacing={input.rowSpacing} />
              </div>

              <PassPlan result={result} />
            </>
          )}
        </div>
      </div>

      <footer className="foot">
        Розрахунок припускає, що сівалка й обприскувач заходять у поле з одного краю,
        а секції рахуються зліва направо за напрямком руху.
      </footer>
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  )
}

function Fixes({ s, rowSpacing }) {
  if (!s) return null
  return (
    <div className="fixes">
      {s.sprayerWidths.length > 0 && (
        <div>
          <h3>Підійшли б такі захвати обприскувача</h3>
          <ul>
            {s.sprayerWidths.map((o) => (
              <li key={o.k}>{o.width} м — це {o.k} прох. сівалки</li>
            ))}
          </ul>
        </div>
      )}
      {s.drills.length > 0 && (
        <div>
          <h3>Або така сівалка при цьому ж обприскувачі</h3>
          <ul>
            {s.drills.map((o) => (
              <li key={`${o.k}-${o.rows}`}>
                {o.rows} секцій × {rowSpacing} м = {o.width} м — це {o.k} прох.
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

