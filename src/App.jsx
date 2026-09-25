import { useEffect, useMemo, useState } from 'react'
import { computeTramlines, fieldPlan, suggestTracks, secondMachine } from './lib/tramline'
import { economics } from './lib/economics'
import { CROPS, SPRAYER_WIDTHS, SPRAYER_PRESETS, DEFAULTS } from './lib/presets'
import { num } from './lib/format'
import Verdict from './components/Verdict'
import { TrackAdvice, SpreaderAdvice } from './components/Advice'
import FieldPlan from './components/FieldPlan'
import FieldDiagram from './components/FieldDiagram'
import PassPlan from './components/PassPlan'
import Money from './components/Money'

const STORE = 'tramline_input'

function Mark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1d2416" />
      <g fill="#8ec463">
        <rect x="3" y="6" width="3" height="20" rx="1.5" />
        <rect x="9" y="6" width="3" height="20" rx="1.5" />
        <rect x="20" y="6" width="3" height="20" rx="1.5" />
        <rect x="26" y="6" width="3" height="20" rx="1.5" />
      </g>
      <rect x="14.5" y="4" width="3" height="24" rx="1.5" fill="#c4593f" />
    </svg>
  )
}

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
      headland: input.headland,
    }),
    [result, input.fieldWidth, input.fieldLength, input.rowSpacing, input.headland],
  )

  const advice = useMemo(() => suggestTracks(input), [input])

  const spreader = useMemo(
    () => (input.spreaderWidth > 0
      ? secondMachine({
        sprayerWidth: input.sprayerWidth, spreaderWidth: input.spreaderWidth,
        rows: input.rows, rowSpacing: input.rowSpacing,
      })
      : null),
    [input.spreaderWidth, input.sprayerWidth, input.rows, input.rowSpacing],
  )

  const money = useMemo(
    () => economics(plan, result, {
      yieldPerHa: input.yieldPerHa, pricePerTon: input.pricePerTon,
      passes: input.passes, damagePct: input.damagePct, tyreWidth: input.tyreWidth,
    }),
    [plan, result, input.yieldPerHa, input.pricePerTon, input.passes, input.damagePct, input.tyreWidth],
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
      <header className="top">
        <Mark />
        <div>
          <div className="brand">Колія</div>
          <div className="brand-sub">що глушити на сівалці, щоб потім було де їздити</div>
        </div>
      </header>

      {result.ok ? (
        <div className="headline">
          <Verdict result={result} />
          {result.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
        </div>
      ) : (
        <div className="headline">
          <div className="verdict is-bad">
            <div className="verdict-kicker">колія не складеться</div>
            <div className="verdict-line">
              Захват обприскувача не ділиться націло на захват сівалки
            </div>
            <div className="verdict-sub">
              {num(input.sprayerWidth)} м на {num(result.drillWidth)} м — це{' '}
              {num(result.ratio)} проходу. Колеса щоразу падатимуть у нове місце,
              і жодної колії не вийде.
            </div>
          </div>
        </div>
      )}

      <div className="cols">
        <form className="form" onSubmit={(e) => e.preventDefault()}>
          <div className="panel">
            <h2>сівалка</h2>

            <label>
              Культура
              <select value={input.crop} onChange={(e) => pickCrop(e.target.value)}>
                {CROPS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </label>

            <div className="duo">
              <label>
                Секцій
                <input type="number" min="2" step="1" value={input.rows} onChange={onNum('rows')} />
              </label>
              <label>
                Міжряддя, м
                <input type="number" min="0.05" step="0.05" value={input.rowSpacing} onChange={onNum('rowSpacing')} />
              </label>
            </div>

            <div className="derived">захват {num(input.rows * input.rowSpacing)} м</div>

            <label className="check">
              <input type="checkbox" checked={input.halfStart}
                onChange={(e) => set('halfStart', e.target.checked)} />
              Перший прохід — половинний
            </label>
          </div>

          <div className="panel">
            <h2>обприскувач</h2>

            <label>
              Захват, м
              <input type="number" min="1" step="0.1" list="sprayer-widths"
                value={input.sprayerWidth} onChange={onNum('sprayerWidth')} />
              <datalist id="sprayer-widths">
                {SPRAYER_WIDTHS.map((w) => <option key={w} value={w} />)}
              </datalist>
            </label>

            <label>
              Типова ходова
              <select defaultValue="" onChange={(e) => pickSprayer(e.target.value)}>
                <option value="" disabled>— підставити —</option>
                {SPRAYER_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </label>

            <div className="duo">
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
              Запас на знос керма, м
              <input type="number" min="0" step="0.05" value={input.margin} onChange={onNum('margin')} />
            </label>

            <label>
              Розкидач, м
              <input type="number" min="0" step="0.1" value={input.spreaderWidth} onChange={onNum('spreaderWidth')} />
              <span className="note" style={{ display: 'block', margin: '5px 0 0' }}>
                Якщо по цих же коліях ходить розкидач. Порожньо — не рахувати.
              </span>
            </label>
          </div>

          <div className="panel">
            <h2>поле</h2>

            <div className="duo">
              <label>
                Ширина, м
                <input type="number" min="1" step="10" value={input.fieldWidth} onChange={onNum('fieldWidth')} />
              </label>
              <label>
                Довжина, м
                <input type="number" min="1" step="10" value={input.fieldLength} onChange={onNum('fieldLength')} />
              </label>
            </div>

            <label>
              Обсів по периметру, м
              <input type="number" min="0" step="1" value={input.headland} onChange={onNum('headland')} />
              <span className="note" style={{ display: 'block', margin: '5px 0 0' }}>
                Смуга для розворотів. Зазвичай два-три заходи обприскувача.
              </span>
            </label>

            <div className="derived">
              поле {num((input.fieldWidth * input.fieldLength) / 10000, 1)} га
              {plan && !plan.tooSmall && ` · робочої ${num(plan.workingHa, 1)} га`}
            </div>
          </div>

          <div className="panel">
            <h2>гроші</h2>

            <div className="duo">
              <label>
                Врожайність, т/га
                <input type="number" min="0" step="0.1" value={input.yieldPerHa} onChange={onNum('yieldPerHa')} />
              </label>
              <label>
                Ціна, ₴/т
                <input type="number" min="0" step="100" value={input.pricePerTon} onChange={onNum('pricePerTon')} />
              </label>
            </div>

            <div className="duo">
              <label>
                Обробок за сезон
                <input type="number" min="0" step="1" value={input.passes} onChange={onNum('passes')} />
              </label>
              <label>
                Гине під колесом, %
                <input type="number" min="0" max="100" step="5" value={input.damagePct} onChange={onNum('damagePct')} />
              </label>
            </div>
          </div>
        </form>

        <div className="stack">
          {!result.ok ? (
            <Fixes s={result.suggestions} rowSpacing={input.rowSpacing} />
          ) : (
            <>
              {plan && !plan.tooSmall && (
                <div className="figures">
                  <Figure k="Колій на полі" v={String(plan.tramlines)}
                    s={`${plan.sprayerPasses} прох. обприскувача`} />
                  <Figure k="Проходів сівалки" v={String(plan.passes.length)}
                    s={plan.passes.at(-1)?.width < result.drillWidth
                      ? `останній неповний — ${num(plan.passes.at(-1).width)} м`
                      : 'усі повні'} />
                  <Figure k="Довжина колій" v={`${num(plan.tramlineKm, 1)} км`}
                    s={`${plan.disabledRows} вимкнених рядків`} />
                  <Figure k="Недосіяно" v={`${num(plan.lostHa, 2)} га`}
                    s={`${num(plan.lostPct, 1)} % поля`} />
                </div>
              )}

              {plan?.tooSmall && (
                <p className="warn">
                  Обсів {num(plan.headland)} м з'їдає поле цілком — на робочу частину
                  не лишається місця навіть під один прохід сівалки.
                </p>
              )}

              <TrackAdvice advice={advice} trackWidth={input.trackWidth} />
              <SpreaderAdvice spreader={spreader} />
              <PassPlan result={result} />

              {plan && !plan.tooSmall && (
                <div className="panel">
                  <h2>поле згори</h2>
                  <FieldPlan plan={plan} result={result} />
                  {plan.lastSprayerPass < result.sprayerWidth - 0.01 && (
                    <p className="warn">
                      Останній прохід обприскувача виходить неповним —{' '}
                      {num(plan.lastSprayerPass)} м замість {num(result.sprayerWidth)} м.
                      Саме на цьому краю колія ляже не там, де її чекають.
                    </p>
                  )}
                </div>
              )}

              <div className="panel">
                <h2>прохід зблизька</h2>
                <FieldDiagram result={result} rows={input.rows} rowSpacing={input.rowSpacing} />
              </div>

              <Money money={money} plan={plan} passes={input.passes} />
            </>
          )}
        </div>
      </div>

      <footer className="foot">
        Сівалка й обприскувач заходять у поле з одного краю; секції рахуються
        зліва направо за напрямком руху. Рельєф, клини й нерівні межі поля
        розрахунок не враховує.
      </footer>
    </div>
  )
}

function Figure({ k, v, s }) {
  return (
    <div className="figure">
      <div className="figure-k">{k}</div>
      <div className="figure-v">{v}</div>
      <div className="figure-s">{s}</div>
    </div>
  )
}

function Fixes({ s, rowSpacing }) {
  if (!s) return null
  return (
    <div className="panel">
      <h2>що поміняти</h2>
      {s.sprayerWidths.length > 0 && (
        <>
          <p className="note" style={{ margin: '0 0 10px' }}>Захват обприскувача:</p>
          <div className="advice">
            {s.sprayerWidths.slice(0, 4).map((o) => (
              <div key={o.k} className="opt">
                <span className="opt-v">{num(o.width)} м</span>
                <span className="opt-t">{o.k} прох. сівалки</span>
              </div>
            ))}
          </div>
        </>
      )}
      {s.drills.length > 0 && (
        <>
          <p className="note" style={{ margin: '14px 0 10px' }}>Або сівалка при тому ж обприскувачі:</p>
          <div className="advice">
            {s.drills.slice(0, 3).map((o) => (
              <div key={`${o.k}-${o.rows}`} className="opt">
                <span className="opt-v">{o.rows} секцій</span>
                <span className="opt-t">× {num(rowSpacing)} м = {num(o.width)} м, {o.k} прох.</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
