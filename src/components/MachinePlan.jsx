import { num, plural } from '../lib/format'

// ── Хто як користується колією ────────────────────────────────────────────
//
// Головна відповідь зверху каже, що глушити. Ця панель відповідає на інше
// питання, і воно дорожче: чому саме стільки — і що зробити, щоб було менше.
//
// Для кожної машини видно три речі:
//   · чи вкладається її захват у крок колій;
//   · з якого відступу їй починати, щоб колесо впало в готову смугу;
//   · скільком сошників вона коштує понад те, що глушили б і без неї.
//
// Останнє число — єдине, що справді вирішує. Якщо машина додає нуль, вона
// їде чужою смугою й не коштує нічого. Якщо додає двадцять — вона вимагає
// власної смуги, і майже завжди це означає, що її колісна база не збігається
// з рештою парку: пів години з ключем проти кількох центнерів з поля.

export default function MachinePlan({ result, onPick }) {
  if (!result?.ok) return null
  const machines = result.machines.filter((m) => m.active)
  if (!machines.length) return null

  const base = machines.find((m) => m.base)
  const gauges = [...new Set(machines
    .filter((m) => m.fits)
    .flatMap((m) => m.axles.map((a) => a.trackWidth)))]

  return (
    <div className="panel">
      <h2>хто як користується колією</h2>

      {base && (
        <p className="note" style={{ margin: '-4px 0 14px' }}>
          Колії лягають через <b>{num(base.width)} м</b> — це захват «{base.label}».
          Решта вкладають цей крок цілим числом разів і йдуть кожною n-ю
          колією.{' '}
          {machines.filter((m) => m.fits).every((m) => m.width >= base.width)
            ? 'Кроком стала найвужча машина: інакше вона потрапляла б у смугу не на кожному своєму проході, а решту часу їхала б по посіву.'
            : 'Кроком стала не найвужча: з нею в колію вкладається більше машин, ніж із будь-якою іншою.'}
          {' '}Крок можна закріпити вручну — галочка в картці машини.
        </p>
      )}

      <div className="mrows">
        {machines.map((m, i) => (
          <MachineRow key={m.id} m={m} i={i} base={base} onPick={onPick} />
        ))}
      </div>

      {gauges.length > 1 && (
        <p className="warn" style={{ marginTop: 14 }}>
          У парку {gauges.length} різні колісні бази — {gauges.map((g) => num(g)).join(', ')} м.
          Саме через це сошників глухне більше: кожна база вимагає своєї смуги.
          Зведіть їх до одного значення — і всі машини поїдуть однією колією.
        </p>
      )}
    </div>
  )
}

function MachineRow({ m, i, base, onPick }) {
  const colour = { '--m': `var(--m${(i % 5) + 1})` }

  // Машина не вкладається в крок колій: показуємо найближчі захвати, що
  // вкладаються, і даємо підставити їх одним натисканням.
  if (!m.fits) {
    return (
      <div className="mrow is-bad" style={colour}>
        <div className="mrow-head">
          <i className="mdot" aria-hidden="true" />
          <b>{m.label}</b>
          <span className="mrow-w">{num(m.width)} м</span>
        </div>
        <div className="mrow-text">
          {m.reason === 'rhythm' ? (
            <>
              Вкладається, але цикл вийшов би на {m.wouldBeRhythm} проходів — такого
              в кабіні не відрахувати, і жоден термінал стільки не приймає.
            </>
          ) : (
            <>
              Захват не кратний сівалці {num(m.ratio)} раза — колеса щоразу падали б
              у нове місце. У розрахунку ця машина не врахована.
            </>
          )}
        </div>
        {m.options?.length > 0 && (
          <div className="mrow-opts">
            <span className="mrow-opts-k">робочі захвати:</span>
            {m.options.map((w) => (
              <button key={w} type="button" className="mchip is-act"
                onClick={() => onPick?.(m.id, { width: w })}>
                {num(w)} м
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const free = m.extraRows === 0
  const lanes = m.passesPerCycle

  return (
    <div className={`mrow${free ? ' is-good' : ' is-cost'}`} style={colour}>
      <div className="mrow-head">
        <i className="mdot" aria-hidden="true" />
        <b>{m.label}</b>
        <span className="mrow-w">
          {m.fullWidth > m.width + 0.001
            ? `${num(m.width)} з ${num(m.fullWidth)} м`
            : `${num(m.width)} м`}
          {' · '}база {m.axles.map((a) => num(a.trackWidth)).join(' / ')} м
        </span>
        {m.base && <span className="mbadge is-base">крок колій</span>}
      </div>

      <div className="mrow-text">
        {m.base ? (
          <>
            Задає сітку колій: вони лягають по центру кожного її проходу.
            {m.phase > 0
              ? <> Перший прохід — <b>за {num(m.phase)} м від краю</b>, тож на цей відступ зсунуті всі колії поля.</>
              : ' Починає від самого краю поля, без відступу.'}
          </>
        ) : (
          <>
            {lanes === 1
              ? 'Один прохід на цикл. '
              : `${lanes} ${plural(lanes, 'прохід', 'проходи', 'проходів')} на цикл. `}
            {m.phase > 0 ? (
              <>
                Перший прохід починати <b>за {num(m.phase)} м від краю</b> —
                {m.phaseFixed ? ' так задано вручну.' : ' саме цей відступ ставить колеса в готову смугу.'}
              </>
            ) : (
              <>Починати від самого краю, як і базова машина.</>
            )}
          </>
        )}
      </div>

      <div className="mrow-cost">
        {free ? (
          <span className="mstat is-good">
            {m.base ? 'своя смуга' : 'нічого не додає'}
            <i>
              {m.base
                ? `${m.rowsIfAlone} ${plural(m.rowsIfAlone, 'сошник', 'сошники', 'сошників')} за цикл`
                : 'їде смугою, нарізаною під інші машини'}
            </i>
          </span>
        ) : (
          <span className="mstat is-cost">
            +{m.extraRows} {plural(m.extraRows, 'сошник', 'сошники', 'сошників')}
            <i>
              {m.wheelsShared > 0
                ? `${m.wheelsShared} з ${m.wheels} коліс у спільній смузі, решта вимагає своєї`
                : 'жодне колесо не влучає в чужу смугу — потрібна власна'}
            </i>
          </span>
        )}

        {!m.touchesRows && m.clearance != null && (
          <span className="mstat is-good">
            колесо міжряддям
            <i>до найближчого сошника {Math.round(m.clearance * 100)} см</i>
          </span>
        )}
      </div>
    </div>
  )
}
