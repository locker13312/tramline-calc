import { useEffect, useMemo, useRef, useState } from 'react'
import { computeTramlines, fieldPlan, suggestTracks, coulterOffsets } from '../lib/tramline'
import { economics } from '../lib/economics'
import { CROPS, CHASSIS_PRESETS } from '../lib/presets'
import { defaultMachines } from '../lib/machines'
import { num, plural, rangeText } from '../lib/format'
import Verdict from './Verdict'
import { TrackAdvice } from './Advice'
import MachineList from './MachineList'
import MachinePlan from './MachinePlan'
import FieldPlan from './FieldPlan'
import FieldDiagram from './FieldDiagram'
import PassPlan from './PassPlan'
import PassList from './PassList'
import Money from './Money'

// Розділи налаштувань. «Машини» першими не стоять навмисно: сівалку задають
// раз і від неї залежить усе інше, тож із неї й починають.
const SECTIONS = [
  { key: 'drill', label: 'Сівалка' },
  { key: 'machines', label: 'Машини' },
  { key: 'field', label: 'Поле' },
  { key: 'money', label: 'Гроші' },
]

// Сам розрахунок: форма ліворуч, відповідь і докази праворуч. Живе окремо
// від оболонки, бо оболонка має ще вкладки, акаунт і довідник.
// initialSection — з якого розділу відкрити форму. Потрібне перевірці
// рендером: вона малює всі чотири, щоб жоден не ламався непоміченим.
export default function Calculator({ input, setInput, initialSection = 'drill' }) {
  const [section, setSection] = useState(initialSection)
  const headline = useRef(null)
  const set = (k, v) => setInput((s) => ({ ...s, [k]: v }))
  // onNum, а не num: num з lib/format форматує числа для показу.
  const onNum = (k) => (e) => set(k, Number(e.target.value))

  // Порожній список лишається порожнім: якщо людина видалила всі машини, вона
  // має побачити чесне «нема під що різати колію», а не три машини, що самі
  // повернулися. Типовий набір підставляється лише тоді, коли списку не було
  // зовсім — тобто в збереженій формі старого вигляду.
  const machines = input.machines ?? defaultMachines()
  const setMachines = (list) => set('machines', list)
  const tractor = input.drillTractor ?? {}
  const setTractor = (change) => set('drillTractor', { ...tractor, ...change })

  const result = useMemo(() => computeTramlines({ ...input, machines }), [input, machines])

  const plan = useMemo(
    () => fieldPlan(result, {
      fieldWidth: input.fieldWidth,
      fieldLength: input.fieldLength,
      rowSpacing: input.rowSpacing,
      headland: input.headland,
    }),
    [result, input.fieldWidth, input.fieldLength, input.rowSpacing, input.headland],
  )

  const advice = useMemo(() => suggestTracks({ ...input, machines }), [input, machines])

  const money = useMemo(
    () => economics(plan, result, {
      yieldPerHa: input.yieldPerHa, pricePerTon: input.pricePerTon,
      passes: input.passes, damagePct: input.damagePct, tyreWidth: input.tyreWidth,
    }),
    [plan, result, input.yieldPerHa, input.pricePerTon, input.passes, input.damagePct, input.tyreWidth],
  )

  const pickCrop = (key) => {
    const c = CROPS.find((x) => x.key === key)
    if (c) setInput((s) => ({ ...s, crop: key, rowSpacing: c.rowSpacing, rows: c.rows, coulters: null }))
  }

  // Підставити машині інший захват із підказки.
  const pickForMachine = (id, change) =>
    setMachines(machines.map((m) => (m.id === id ? { ...m, ...change } : m)))

  // Коли колія не складається, міняти треба захват тієї машини, під яку її
  // різали. Якщо базову не вибрано, це перша ввімкнена — так само, як у
  // геометрії.
  const lead = result.machines?.find((m) => m.base)
    || machines.find((m) => m.active !== false)
  const baseId = lead?.id ?? null
  const baseWidth = lead?.width ?? 0

  return (
    <>
      <StickyAnswer result={result} watch={headline} />

      <div className="headline" ref={headline}>
        {result.ok
          ? <Verdict result={result} />
          : (
            <div className="verdict is-bad">
              <div className="verdict-kicker">колія не складеться</div>
              <div className="verdict-line">
                {result.machines?.some((m) => m.active)
                  ? 'Захват головної машини не ділиться на захват сівалки'
                  : 'Немає ні однієї машини, під яку різати колію'}
              </div>
              <div className="verdict-sub">{result.warnings[0]}</div>
            </div>
          )}
        {result.warnings.slice(result.ok ? 0 : 1).map((w, i) => (
          <p key={i} className="warn">{w}</p>
        ))}
      </div>

      <div className="cols">
        <form className="form" onSubmit={(e) => e.preventDefault()}>
          {/* Розділи налаштувань перемикаються, а не стоять один під одним.
              Форма виросла до чотирьох панелей, і «поле» з «грошима»
              опинялися під списком машин — щоб їх побачити, треба було
              прокрутити всю сторінку. Тепер будь-який розділ за одне
              натискання, і форма завжди в один екран. */}
          <div className="fnav" role="tablist" aria-label="Розділи налаштувань">
            {SECTIONS.map((s) => (
              <button
                key={s.key} type="button" role="tab"
                aria-selected={section === s.key}
                className={`fnav-b${section === s.key ? ' is-on' : ''}`}
                onClick={() => setSection(s.key)}
              >
                {s.label}
                {s.key === 'machines' && (
                  <i className="fnav-n">{machines.filter((m) => m.active !== false).length}</i>
                )}
              </button>
            ))}
          </div>

          {section === 'drill' && (
            <Drill
              input={input} set={set} onNum={onNum}
              pickCrop={pickCrop} result={result}
              tractor={tractor} setTractor={setTractor}
            />
          )}

          {section === 'machines' && (
            <MachineList machines={machines} setMachines={setMachines} result={result} />
          )}

          {section === 'field' && (
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
            </label>
            <p className="note">Смуга для розворотів. Зазвичай два-три заходи обприскувача.</p>

            <div className="derived">
              поле {num((input.fieldWidth * input.fieldLength) / 10000, 1)} га
              {plan && !plan.tooSmall && ` · робочої ${num(plan.workingHa, 1)} га`}
            </div>
          </div>
          )}

          {section === 'money' && (
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
                Проходів за сезон
                <input type="number" min="0" step="1" value={input.passes} onChange={onNum('passes')} />
              </label>
              <label>
                Гине під колесом, %
                <input type="number" min="0" max="100" step="5" value={input.damagePct} onChange={onNum('damagePct')} />
              </label>
            </div>
            <p className="note" style={{ marginBottom: 0 }}>
              Проходи — для машин, яким не задано власне число.
            </p>
          </div>
          )}
        </form>

        <div className="stack">
          {!result.ok && result.suggestions && (
            <Fixes
              s={result.suggestions}
              rowSpacing={input.rowSpacing}
              rows={result.rows}
              boomWidth={baseWidth}
              onPick={(patch) => {
                if (patch.rows != null) set('rows', patch.rows)
                if (patch.width != null && baseId) pickForMachine(baseId, { width: patch.width })
              }}
            />
          )}

          {result.ok && plan && !plan.tooSmall && (
            <div className="figures">
              <Figure k="Колій на полі" v={String(plan.tramlines)}
                s={`крок ${num(result.baseWidth)} м`} />
              <Figure k="Проходів сівалки" v={String(plan.passes.length)}
                s={plan.passes.at(-1)?.width < result.drillWidth
                  ? `останній неповний — ${num(plan.passes.at(-1).width)} м`
                  : 'усі повні'} />
              <Figure k="Довжина колій" v={`${num(plan.tramlineKm, 1)} км`}
                s={`${plan.disabledRows} вимкнених сошників`} />
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

          <MachinePlan result={result} onPick={pickForMachine} />
          <TrackAdvice advice={advice} />

          {result.ok && (
            <>
              <PassPlan result={result} />
              <PassList plan={plan} rowSpacing={input.rowSpacing} />

              {plan && !plan.tooSmall && (
                <div className="panel">
                  <h2>поле згори</h2>
                  <FieldPlan plan={plan} result={result} />
                  {plan.lastSprayerPass < result.baseWidth - 0.01 && (
                    <p className="warn">
                      Останній прохід головної машини виходить неповним —{' '}
                      {num(plan.lastSprayerPass)} м замість {num(result.baseWidth)} м.
                      Саме на цьому краю колія ляже не там, де її чекають.
                    </p>
                  )}
                </div>
              )}

              <div className="panel">
                <h2>прохід зблизька</h2>
                <FieldDiagram result={result} />
              </div>

              <Money money={money} plan={plan} />
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Сівалка ───────────────────────────────────────────────────────────────
//
// Рівномірна сівалка описується двома числами, і так її вводять у 99 %
// випадків. Але розкладка буває й іншою: знята секція, подвійне міжряддя під
// слід трактора, пари сошників. Тому під рівномірною формою є друга, де
// позиції задаються списком, і решта розрахунку про цю різницю не знає.
function Drill({ input, set, onNum, pickCrop, result, tractor, setTractor }) {
  const custom = Array.isArray(input.coulters) && input.coulters.length >= 2
  const [text, setText] = useState(() => (custom ? input.coulters.join(', ') : ''))

  const toCustom = () => {
    const even = coulterOffsets({ rows: input.rows, rowSpacing: input.rowSpacing })
    setText(even.join(', '))
    set('coulters', even)
  }

  const onText = (v) => {
    setText(v)
    const list = v.split(/[\s,;]+/).map(Number).filter((x) => Number.isFinite(x) && x >= 0)
    set('coulters', list.length >= 2 ? list : null)
  }

  return (
    <div className="panel">
      <h2>сівалка</h2>

      <label>
        Культура
        <select value={input.crop} onChange={(e) => pickCrop(e.target.value)}>
          {CROPS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </label>

      {!custom ? (
        <>
          <div className="duo">
            <label>
              Сошників
              <input type="number" min="2" step="1" value={input.rows} onChange={onNum('rows')} />
            </label>
            <label>
              Міжряддя, м
              <input type="number" min="0.05" step="0.05" value={input.rowSpacing} onChange={onNum('rowSpacing')} />
            </label>
          </div>
          <div className="derived">захват {num(input.rows * input.rowSpacing)} м</div>
          <button type="button" className="mlink mlink-block" onClick={toCustom}>
            розкладка сошників не рівномірна
          </button>
        </>
      ) : (
        <>
          <label>
            Позиції сошників від краю рами, м
            <textarea rows="3" value={text} onChange={(e) => onText(e.target.value)} />
          </label>
          <p className="note">
            Через кому. Рама вважається симетричною: скільки до першого сошника,
            стільки й після останнього. Якщо це не так — задайте захват нижче.
          </p>
          <div className="duo">
            <label>
              Захват, м
              <input type="number" min="0.5" step="0.1"
                value={input.drillWidth ?? ''}
                placeholder={num(result.drillWidth)}
                onChange={(e) => set('drillWidth', e.target.value === '' ? null : Number(e.target.value))} />
            </label>
            <label>
              Міжряддя, м
              <input type="number" min="0.05" step="0.05" value={input.rowSpacing} onChange={onNum('rowSpacing')} />
            </label>
          </div>
          <div className="derived">
            {result.rows} {plural(result.rows, 'сошник', 'сошники', 'сошників')} ·{' '}
            захват {num(result.drillWidth)} м · найменше міжряддя {num(result.minGap)} м
          </div>
          <button type="button" className="mlink mlink-block"
            onClick={() => { set('coulters', null); set('drillWidth', null); setText('') }}>
            повернутись до рівномірної
          </button>
        </>
      )}

      <label className="check">
        <input type="checkbox" checked={input.halfStart}
          onChange={(e) => set('halfStart', e.target.checked)} />
        Перший прохід — половинний
      </label>

      <label style={{ marginTop: 13 }}>
        Запас на знос керма, м
        <input type="number" min="0" step="0.05" value={input.margin} onChange={onNum('margin')} />
      </label>

      <div className="maxle">
        <div className="maxle-h">трактор сівалки</div>
        <label>
          Готова ходова
          <select value="" onChange={(e) => {
            const p = CHASSIS_PRESETS.find((x) => x.key === e.target.value)
            if (p) setTractor({ trackWidth: p.trackWidth, tyreWidth: p.tyreWidth })
          }}>
            <option value="" disabled>— підставити —</option>
            {CHASSIS_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        <div className="duo">
          <label>
            Між колесами, м
            <input type="number" min="0" step="0.05" value={tractor.trackWidth ?? ''}
              onChange={(e) => setTractor({ trackWidth: Number(e.target.value) })} />
          </label>
          <label>
            Шина, м
            <input type="number" min="0" step="0.01" value={tractor.tyreWidth ?? ''}
              onChange={(e) => setTractor({ tyreWidth: Number(e.target.value) })} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={!!tractor.closeOwnTracks}
            onChange={(e) => setTractor({ closeOwnTracks: e.target.checked })} />
          Глушити сошники під власним слідом
        </label>
        <p className="note" style={{ margin: '8px 0 0' }}>
          Колії тут ще немає — вона тільки нарізається. Але слід трактора лягає
          на кожному проході, і зерно в ущільненому сліді сходить гірше. Глушать
          його не всі: це мінус {tractor.closeOwnTracks ? '' : 'кілька '}сошників
          на кожному проході, а не раз на цикл.
        </p>
      </div>
    </div>
  )
}

// ── Відповідь, що лишається на видноті ────────────────────────────────────
//
// На телефоні форма займає екран, і відповідь уже вище нього: людина міняє
// колісну базу й не бачить, що з того вийшло, — доводиться щоразу гортати
// вгору й назад. Тому коли головний вердикт виходить за межі екрана,
// з'являється вузький рядок із тим самим числом. На широкому екрані його
// немає: там форма збоку, а відповідь і так перед очима.
function StickyAnswer({ result, watch }) {
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    const node = watch.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([e]) => setHidden(e.isIntersecting || e.boundingClientRect.top > 0),
      { threshold: 0 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [watch])

  if (hidden) return null

  const hit = result.ok ? result.passes.filter((p) => p.disabled.length) : []
  const toTop = () => watch.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <button type="button" className="sticky-answer" onClick={toTop}>
      {!result.ok ? (
        <span className="sa-main is-bad">колія не складається</span>
      ) : !hit.length ? (
        <span className="sa-main is-clean">нічого не глушити</span>
      ) : hit.length === 1 ? (
        <span className="sa-main">
          прохід {hit[0].n} з {result.cycle}: <b>{rangeText(hit[0].disabled)}</b>
        </span>
      ) : (
        <span className="sa-main">
          глушити на {hit.length} з {result.cycle} проходів
        </span>
      )}
      {result.ok && (
        <span className="sa-side">
          ритм {result.rhythm} · {num(result.lossPct, 1)} %
        </span>
      )}
    </button>
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

// ── Що робити, коли захвати не поєднуються ────────────────────────────────
//
// Порядок відповідей тут не випадковий. Штангу ніхто не міняє через колію,
// тому першою йде та, що нічого не коштує: їхати наявною штангою вужче,
// перекриваючи сусідній прохід. Далі — звузити сівалку. І аж потім
// «купіть іншу машину», бо це не порада, а констатація.
function Fixes({ s, rowSpacing, rows, boomWidth, onPick }) {
  if (!s) return null
  const working = s.working ?? []

  return (
    <div className="panel">
      <h2>як із цього вийти</h2>

      {working.length > 0 && (
        <>
          <p className="note" style={{ margin: '0 0 10px' }}>
            Штанга лишається {num(boomWidth)} м — міняється робоча ширина: скільки
            захоплює корисно, а решта йде в перекриття сусіднього проходу.
            Крайні секції штанги на перекритті вимикають, щоб не лити двічі.
          </p>
          <div className="advice">
            {working.map((o) => (
              <button
                key={o.width}
                type="button"
                className={`opt opt-act${o.off === 0 ? ' is-current' : ''}`}
                onClick={() => onPick({ width: o.width, rows: o.rows })}
              >
                <span className="opt-v">{num(o.width)} м</span>
                <span className="opt-t">
                  {o.off === 0
                    ? `сівалка без змін, ${o.k} прох.`
                    : `сівалка ${o.rows} ${plural(o.rows, 'сошник', 'сошники', 'сошників')} із ${rows} (заглушити ${o.off} з краю), ${o.k} прох.`}
                  {' · '}перекриття {num(o.overlap)} м ({num(o.overlapPct, 0)} %)
                </span>
              </button>
            ))}
          </div>
          <p className="note" style={{ margin: '10px 0 0' }}>
            Натисніть варіант — він підставиться у форму, і розрахунок покаже
            проходи із сошниками.
          </p>
        </>
      )}

      {s.drills.length > 0 && (
        <>
          <p className="note" style={{ margin: '18px 0 10px' }}>
            Сівалка, що ділить {num(boomWidth)} м рівно, без перекриття:
          </p>
          <div className="advice">
            {s.drills.slice(0, 3).map((o) => (
              <button
                key={`${o.k}-${o.rows}`}
                type="button"
                className="opt opt-act"
                onClick={() => onPick({ rows: o.rows })}
              >
                <span className="opt-v">{o.rows} сошників</span>
                <span className="opt-t">× {num(rowSpacing)} м = {num(o.width)} м, {o.k} прох.</span>
              </button>
            ))}
          </div>
        </>
      )}

      {s.sprayerWidths.length > 0 && (
        <>
          <p className="note" style={{ margin: '18px 0 10px' }}>
            Або інша машина під наявну сівалку:
          </p>
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
    </div>
  )
}
