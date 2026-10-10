import { num, plural } from '../lib/format'

const uah = (v) => new Intl.NumberFormat('uk-UA').format(Math.round(v)) + ' ₴'

// Порівняння двох втрат: свідомо недосіяної площі проти витоптаної. Обидва
// числа з однієї формули й обидва видно — щоб можна було посперечатися з
// розрахунком, а не вірити йому.
export default function Money({ money, plan }) {
  if (!money) return null

  const better = money.saving > 0
  return (
    <div className="panel">
      <h2>скільки це коштує</h2>

      <div className="money">
        <div className="money-card">
          <div className="money-k">з колією</div>
          <div className="money-v">{uah(money.withTramlines.uah)}</div>
          <div className="money-s">
            {num(money.withTramlines.ha, 2)} га недосіяно — раз і на весь сезон,
            скільки б обробок не було
          </div>
        </div>

        <div className={`money-card${better ? ' is-loss' : ''}`}>
          <div className="money-k">без колії</div>
          <div className="money-v">{uah(money.without.uah)}</div>
          <div className="money-s">
            {num(money.without.ha, 2)} га витоптано за {money.totalPasses}{' '}
            {plural(money.totalPasses, 'прохід', 'проходи', 'проходів')} усіх машин —
            сліди щоразу нові
          </div>
        </div>
      </div>

      {money.machines.length > 1 && (
        <div className="mbars">
          {money.machines.map((m) => (
            <div key={m.id} className="mbar">
              <div className="mbar-k">
                {m.label}
                <i>{m.passes} × {m.fieldPasses} прох. · шина {num(m.tyre)} м</i>
              </div>
              <div className="mbar-v">{num(m.ha, 2)} га</div>
            </div>
          ))}
        </div>
      )}

      <div className="money-verdict">
        {better ? (
          <>
            Колія вигідніша на <b>{uah(money.saving)}</b> з цього поля за сезон.
            Окупається з {money.breakEvenPasses}-го проходу.
          </>
        ) : (
          <>
            На такій кількості проходів колія себе не окупає: витоптано було б
            менше, ніж недосіяно. Вона починає працювати з{' '}
            {money.breakEvenPasses}-го проходу за сезон.
          </>
        )}
      </div>

      <p className="note" style={{ margin: '11px 0 0' }}>
        Рахунок простий: {num(plan.lostHa, 2)} га під колією проти{' '}
        {num(money.trackHa, 2)} га слідів за один прохід кожної машини,
        помножених на її проходи за сезон і на частку врожаю, що гине під
        колесом. Ціна гектара — {uah(money.perHa)}.
      </p>
    </div>
  )
}
