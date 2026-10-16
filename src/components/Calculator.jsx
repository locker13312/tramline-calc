import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { computeTramlines, fieldPlan, coulterOffsets, AUTO_MARGIN } from '../lib/tramline'
import { solutions } from '../lib/solutions'
import { economics } from '../lib/economics'
import { CROPS, CHASSIS_PRESETS } from '../lib/presets'
import { defaultMachines } from '../lib/machines'
import { DRIVE_MODES, driveMode, headlandFor } from '../lib/driving'
import { num, plural, rangeText } from '../lib/format'
import NumField from './NumField'
import Verdict from './Verdict'
import MachineList from './MachineList'
import MachinePlan from './MachinePlan'
import FieldPlan from './FieldPlan'
import FieldDiagram from './FieldDiagram'
import PassPlan from './PassPlan'
import PassList from './PassList'
import Ways from './Ways'
import Money from './Money'

// Чому відповіді немає — одним рядком. Раніше інтерфейс вгадував це сам, по
// списку машин, і на порожній сівалці писав «захват головної машини не
// ділиться на захват сівалки», хоч сівалки не було зовсім. Тепер причину
// каже розрахунок, а тут лише її назва.
const FAIL_LINE = {
  drill: 'Спочатку задайте сівалку — сошники й міжряддя',
  machines: 'Немає ні однієї машини, під яку різати колію',
  ratio: 'Захват головної машини не ділиться на захват сівалки',
}

// Сам розрахунок: відповідь угорі на всю ширину, під нею форма ліворуч і
// докази праворуч. Який саме розділ форми показати, вирішує сайдбар — там
// стоять і вкладки, і розділи, бо це одне й те саме меню.
//
// initialSection — з якого розділу відкрити форму, коли нею ніхто не керує
// ззовні. Потрібне перевірці рендером: вона малює всі чотири, щоб жоден не
// ламався непоміченим.
export default function Calculator({
  input, setInput, initialSection = 'drill', section: outer, setSection: setOuter,
}) {
  const [own, setOwn] = useState(initialSection)
  const section = outer ?? own
  const setSection = setOuter ?? setOwn
  const headline = useRef(null)
  const set = (k, v) => setInput((s) => ({ ...s, [k]: v }))
  // Числові поля ходять через NumField: стерте поле лишається стертим, а не
  // стає нулем, у який потім дописують цифри.
  const onNum = (k) => (v) => set(k, v)

  // Порожній список лишається порожнім: якщо людина видалила всі машини, вона
  // має побачити чесне «нема під що різати колію», а не три машини, що самі
  // повернулися. Типовий набір підставляється лише тоді, коли списку не було
  // зовсім — тобто в збереженій формі старого вигляду.
  const machines = input.machines ?? defaultMachines()
  const setMachines = (list) => set('machines', list)

  const result = useMemo(() => computeTramlines({ ...input, machines }), [input, machines])

  const plan = useMemo(
    () => fieldPlan(result, {
      fieldWidth: input.fieldWidth,
      fieldLength: input.fieldLength,
      rowSpacing: input.rowSpacing,
      headland: input.headland,
      serpentine: input.serpentine,
      drive: input.drive,
      land: input.land,
    }),
    [result, input.fieldWidth, input.fieldLength, input.rowSpacing, input.headland,
      input.serpentine, input.drive, input.land],
  )

  // Скільки обсіву брати під розворот — цілим числом кроків сівалки.
  const turnHints = result.ok && result.step > 0
    ? ['loop', 'free'].map((turn) => headlandFor({ step: result.step, turn })).filter(Boolean)
    : []

  // Способи засіяти це поле наявною технікою. Перебір повний: кілька
  // десятків повних розрахунків, і на великому парку це вже десятки
  // мілісекунд. Тому він іде за відкладеним станом — головна відповідь
  // міняється під пальцями, а список способів наздоганяє кадром пізніше.
  const lazy = useDeferredValue(input)
  const ways = useMemo(
    () => solutions({ ...lazy, machines: lazy.machines ?? machines }, {
      fieldWidth: lazy.fieldWidth, fieldLength: lazy.fieldLength,
      headland: lazy.headland, serpentine: lazy.serpentine,
    }),
    [lazy, machines],
  )

  // Який спосіб стоїть у формі зараз: по ньому підсвічується картка. Ключ той
  // самий, що й у пошуку, тож збіг не випадковий.
  const activeWay = `${result.ok ? result.baseWidth : 0}-${result.overlapRows || 0}-${input.halfStart ? 'half' : 'full'}`

  // Поставити спосіб у форму: рівно ті поля, які він міняє.
  const takeWay = (patch) => setInput((st) => ({ ...st, ...patch }))

  const money = useMemo(
    () => economics(plan, result, {
      yieldPerHa: input.yieldPerHa, pricePerTon: input.pricePerTon,
      passes: input.passes, damagePct: input.damagePct, tyreWidth: input.tyreWidth,
    }),
    [plan, result, input.yieldPerHa, input.pricePerTon, input.passes, input.damagePct, input.tyreWidth],
  )

  // Культура задає міжряддя й секції, тож своя розкладка сошників після
  // такого вибору вже ні до чого — її й захват скидаємо разом.
  const pickCrop = (key) => {
    const c = CROPS.find((x) => x.key === key)
    if (c) {
      setInput((s) => ({
        ...s, crop: key, rowSpacing: c.rowSpacing, rows: c.rows,
        coulters: null, drillWidth: null,
      }))
    }
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

      <main className="main">
        <div className="headline" ref={headline}>
          {result.ok
            ? <Verdict result={result} serpentine={!!input.serpentine} />
            : (
              <div className="verdict is-bad">
                <div className="verdict-kicker">
                  {result.fail === 'drill' ? 'бракує даних' : 'колія не складеться'}
                </div>
                <div className="verdict-line">{FAIL_LINE[result.fail] ?? FAIL_LINE.ratio}</div>
                <div className="verdict-sub">{result.warnings[0]}</div>
              </div>
            )}
          {result.warnings.slice(result.ok ? 0 : 1).map((w, i) => (
            <p key={i} className="warn">{w}</p>
          ))}
        </div>

        <div className="cols">
        <form className="form" onSubmit={(e) => e.preventDefault()}>
          {section === 'drill' && (
            <Drill
              input={input} set={set} onNum={onNum}
              pickCrop={pickCrop} result={result}
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
                <NumField min="1" step="10" value={input.fieldWidth} onValue={onNum('fieldWidth')} />
              </label>
              <label>
                Довжина, м
                <NumField min="1" step="10" value={input.fieldLength} onValue={onNum('fieldLength')} />
              </label>
            </div>

            <label>
              Обсів по периметру, м
              <NumField min="0" step="1" value={input.headland} onValue={onNum('headland')} />
            </label>
            <p className="note">
              Смуга для розворотів. Її беруть цілим числом проходів сівалки,
              інакше остання смуга обсіву ляже не там.
              {turnHints.length > 0 && ' Під цю сівалку:'}
              {turnHints.map((h, n) => (
                <span key={h.turn}>
                  {n > 0 ? ', ' : ' '}
                  <button type="button" className="btn btn-sm btn-quiet"
                    onClick={() => set('headland', h.width)}>
                    {num(h.width)} м
                  </button>
                  {' '}{h.turn === 'loop' ? 'з петлею' : 'без петлі'} ({h.passes}{' '}
                  {plural(h.passes, 'прохід', 'проходи', 'проходів')})
                </span>
              ))}
              {turnHints.length > 0 && '.'}
            </p>

            <label className="check">
              <input type="checkbox" checked={!!input.serpentine}
                onChange={(e) => set('serpentine', e.target.checked)} />
              Поле їдуть човником
            </label>
            <p className="note">
              Прохід туди, розворот, прохід назад сусідньою смугою. На зворотному
              проході сівалка розвернена, і сошник, названий по полю, глушиться з
              протилежного боку — тобто не той. Смуги від цього не зсуваються:
              перераховуються номери, які називають у кабіні.
            </p>

            <label>
              Порядок заїздів
              <select value={driveMode(input.drive).key}
                onChange={(e) => set('drive', e.target.value)}>
                {DRIVE_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
            {driveMode(input.drive).key === 'lands' && (
              <label>
                Загінка, проходів сівалки
                <NumField min="2" step="2" value={input.land} onValue={onNum('land')} />
              </label>
            )}
            <p className="note">
              {driveMode(input.drive).hint}
              {driveMode(input.drive).key !== 'row'
                && ' Смуги лягають ті самі, але в списку проходів зʼявиться номер заїзду — '
                  + 'той, який рахує механізатор, — і напрямок човника береться з нього.'}
            </p>

            <div className="derived">
              поле {num(((input.fieldWidth || 0) * (input.fieldLength || 0)) / 10000, 1)} га
              {plan && !plan.tooSmall && !plan.tooBig && ` · робочої ${num(plan.workingHa, 1)} га`}
            </div>
          </div>
          )}

          {section === 'money' && (
          <div className="panel">
            <h2>гроші</h2>

            <div className="duo">
              <label>
                Врожайність, т/га
                <NumField min="0" step="0.1" value={input.yieldPerHa} onValue={onNum('yieldPerHa')} />
              </label>
              <label>
                Ціна, ₴/т
                <NumField min="0" step="100" value={input.pricePerTon} onValue={onNum('pricePerTon')} />
              </label>
            </div>

            <div className="duo">
              <label>
                Проходів за сезон
                <NumField min="0" step="1" value={input.passes} onValue={onNum('passes')} />
              </label>
              <label>
                Гине під колесом, %
                <NumField min="0" max="100" step="5" value={input.damagePct} onValue={onNum('damagePct')} />
              </label>
            </div>
            <p className="note" style={{ marginBottom: 0 }}>
              Проходи — для машин, яким не задано власне число.
            </p>
          </div>
          )}
        </form>

        <div className="stack">
          <Ways list={ways} onTake={takeWay} active={activeWay} />

          {result.ok && plan && !plan.tooSmall && !plan.tooBig && (
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
              Обсів {num(plan.headland)} м зʼїдає поле цілком — на робочу частину
              не лишається місця навіть під один прохід сівалки.
            </p>
          )}

          {plan?.tooBig && (
            <p className="warn">
              Поле {num(plan.fieldWidth)} × {num(plan.fieldLength)} м — це{' '}
              {plan.passesNeeded} проходів сівалки. Стільки програма не рахує:
              найбільша сторона — {plan.maxSide} м. Перевірте, чи не зайвий нуль
              у розмірі; відповідь про цикл і сошники вище від поля не залежить.
            </p>
          )}

          <MachinePlan result={result} onPick={pickForMachine} />

          {result.ok && (
            <>
              <PassPlan result={result} />
              <PassList
                plan={plan}
                rowSpacing={result.stripWidth || input.rowSpacing}
                custom={result.custom}
              />

              {plan && !plan.tooSmall && !plan.tooBig && (
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

        <footer className="foot">
          Усі машини заходять у поле з одного краю; сошники рахуються зліва
          направо за напрямком руху. Розрахунок одновимірний — рельєф, клини й
          нерівні межі поля він не враховує.
        </footer>
      </main>
    </>
  )
}

// ── Сівалка ───────────────────────────────────────────────────────────────
//
// Рівномірна сівалка описується двома числами, і так її вводять у 99 %
// випадків. Але розкладка буває й іншою: знята секція, подвійне міжряддя під
// слід трактора, пари сошників. Тому під рівномірною формою є друга, де
// позиції задаються списком, і решта розрахунку про цю різницю не знає.
function Drill({ input, set, onNum, pickCrop, result }) {
  // Режим тримає форма, а не розрахунок. Якщо дивитися на input.coulters, то
  // стерти текст у полі означало б випасти назад у рівномірну сівалку разом
  // із усім набраним: половина розкладки — це ще не рівномірна сівалка, це
  // недописана розкладка.
  const [mode, setMode] = useState(
    () => (Array.isArray(input.coulters) && input.coulters.length >= 2 ? 'custom' : 'even'),
  )
  const [text, setText] = useState(
    () => (Array.isArray(input.coulters) ? input.coulters.join(', ') : ''),
  )

  const parse = (v) => v.split(/[\s,;]+/).map(Number).filter((x) => Number.isFinite(x) && x >= 0)
  const parsed = parse(text)

  const toCustom = () => {
    const even = coulterOffsets({ rows: input.rows, rowSpacing: input.rowSpacing })
    setText(even.join(', '))
    set('coulters', even)
    setMode('custom')
  }

  const toEven = () => {
    set('coulters', null)
    set('drillWidth', null)
    setText('')
    setMode('even')
  }

  const onText = (v) => {
    setText(v)
    const list = parse(v)
    set('coulters', list.length >= 2 ? list : null)
  }

  // Чи стоять у формі ще ті числа, що в пресеті культури. Якщо ні — у полі
  // «культура» має бути «своє», а не назва, до якої ці числа вже не мають
  // стосунку.
  const pickedCrop = CROPS.find((c) => c.key === input.crop)
  const cropValue = pickedCrop
    && Number(input.rowSpacing) === pickedCrop.rowSpacing
    && Number(input.rows) === pickedCrop.rows
    && !(Array.isArray(input.coulters) && input.coulters.length >= 2)
    ? pickedCrop.key
    : 'custom'

  // Запас задає або система, або господар. Прапорця могло не бути в
  // збереженій формі — тоді про рішення говорить саме число.
  const manual = input.marginManual
    ?? (Number.isFinite(Number(input.margin)) && Math.abs(Number(input.margin) - AUTO_MARGIN) > 1e-9)
  const marginNow = manual && Number.isFinite(Number(input.margin))
    ? Number(input.margin)
    : AUTO_MARGIN

  // Нахльост рахуємо від того, що справді взяв розрахунок, а не від поля
  // форми: він обрізаний по сівалці, і показувати треба обрізане число.
  const overlap = result.overlapRows || 0

  return (
    <div className="panel">
      <h2>сівалка</h2>

      <label>
        Культура
        {/* Вибір культури скидає й свою розкладку — інакше у полі лишався б
            набраний текст, якого розрахунок уже не бере.
            «Своє» — не варіант на вибір, а чесна назва стану: щойно людина
            змінила міжряддя чи кількість сошників, у полі стоять уже не ті
            числа, що в пресеті, і показувати «Пшениця» означало б брехати. */}
        <select
          value={cropValue}
          onChange={(e) => {
            // «Своє» нічого не підставляє й нічого не скидає: це стан, а не
            // дія. Інакше вибір цього рядка стирав би набрану розкладку.
            if (e.target.value === 'custom') return
            pickCrop(e.target.value)
            toEven()
          }}
        >
          {CROPS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          <option value="custom">Своє міжряддя й сошники</option>
        </select>
      </label>

      {mode === 'even' ? (
        <>
          <div className="duo">
            <label>
              Сошників
              <NumField min="2" step="1" value={input.rows} onValue={onNum('rows')} />
            </label>
            <label>
              Міжряддя, м
              <NumField min="0.05" step="0.05" value={input.rowSpacing} onValue={onNum('rowSpacing')} />
            </label>
          </div>
          <div className="derived">захват {num(result.drillWidth)} м</div>
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
          {parsed.length >= 2 ? (
            <p className="note">
              Через кому. Рама вважається симетричною: скільки до першого сошника,
              стільки й після останнього. Якщо це не так — задайте захват нижче.
            </p>
          ) : (
            <p className="note is-warn">
              Потрібно щонайменше дві позиції. Поки їх менше, розрахунок бере
              рівномірну сівалку — {input.rows} × {num(input.rowSpacing)} м.
            </p>
          )}
          <div className="duo">
            <label>
              Захват, м
              <NumField min="0.5" step="0.1"
                value={input.drillWidth}
                placeholder={num(result.drillWidth)}
                onValue={(v) => set('drillWidth', v)} />
            </label>
            <label>
              Міжряддя, м
              <NumField min="0.05" step="0.05" value={input.rowSpacing} onValue={onNum('rowSpacing')} />
            </label>
          </div>
          <div className="derived">
            {result.rows} {plural(result.rows, 'сошник', 'сошники', 'сошників')} ·{' '}
            захват {num(result.drillWidth)} м · найменше міжряддя {num(result.minGap)} м
          </div>
          <button type="button" className="mlink mlink-block" onClick={toEven}>
            повернутись до рівномірної
          </button>
        </>
      )}

      <label className="check">
        <input type="checkbox" checked={!!input.halfStart}
          onChange={(e) => set('halfStart', e.target.checked)} />
        Перший прохід — половинний
      </label>

      {/* ── Запас ───────────────────────────────────────────────────────
          Колесо не йде там, де його намалювали, тому смуга береться ширшою
          за шину. Скільком саме бути запасу — рішення господаря: під
          GPS-підрулюванням нуль, на схилі більше. Тому не просто поле, а
          прапорець: або рахує система, або людина вводить своє. */}
      <div className="maxle">
        <div className="maxle-h">запас з кожного боку смуги</div>
        <label className="check">
          <input type="checkbox" checked={!!manual}
            onChange={(e) => set('marginManual', e.target.checked)} />
          Задати запас самому
        </label>
        <label className={manual ? undefined : 'is-muted'}>
          Запас, м
          <NumField min="0" max="2" step="0.05"
            value={manual ? input.margin : null}
            disabled={!manual}
            placeholder={`система бере ${num(AUTO_MARGIN)}`}
            onValue={(v) => set('margin', v)} />
        </label>
        <div className="derived">
          смуга під колесом = шина + 2 × {num(marginNow)} м
          {!manual && ' (рахує система)'}
        </div>
        <p className="note" style={{ margin: '0 0 10px' }}>
          Підрулювання, знос керма, схил, люфт зчіпки — колесо щоразу трохи
          не там. Більший запас глушить більше сошників, але не дає колесу
          стати на рядок. Під точним підрулюванням запас зводять до нуля.
        </p>
      </div>

      {/* ── Нахльост ─────────────────────────────────────────────────────
          Між проходами має лишитися рівно міжряддя, а без підрулювання в це
          не влучити: на око виходить або пропуск, або здвоєний рядок. Тому
          заходять на засіяне навмисно й закривають крайні сошники — пропуск
          стає неможливим, а двічі не сіється нічого. Перший прохід поля сіє
          всіма: заходити йому ще нікуди. */}
      <div className="maxle">
        <div className="maxle-h">нахльост на засіяне</div>
        <label className="check">
          <input type="checkbox" checked={overlap > 0}
            onChange={(e) => set('overlapRows', e.target.checked ? 2 : 0)} />
          Заходити на вже засіяне
        </label>
        <label className={overlap > 0 ? undefined : 'is-muted'}>
          Сошників у нахльості
          <NumField min="0" max={Math.max(0, result.rows - 2)} step="1"
            value={overlap > 0 ? overlap : null}
            disabled={!(overlap > 0)}
            placeholder="0 — стик рівно міжряддям"
            onValue={(v) => set('overlapRows', v)} />
        </label>
        <div className="derived">
          крок сівалки = {num(result.drillWidth)} м
          {overlap > 0
            ? ` − ${num(result.overlapWidth)} м = ${num(result.step)} м`
            : ' (нахльоста немає)'}
        </div>
        <p className="note" style={{ margin: '0 0 2px' }}>
          Сівалка переставляється не на свій захват, а на крок, і саме крок
          має вкладатися в захват машини цілим числом разів. Площа від
          нахльоста не губиться: рядки під закритими сошниками кладе сусідній
          прохід. Платиться зайвими проходами — {overlap > 0
            ? `їх на поле на ${num((result.overlapWidth / result.drillWidth) * 100, 0)} % більше`
            : 'тим більше, чим більший нахльост'}.
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
