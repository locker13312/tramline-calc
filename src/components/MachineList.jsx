import { useState } from 'react'
import { MACHINE_KINDS, kindOf, newMachine } from '../lib/machines'
import { CHASSIS_PRESETS, SPRAYER_WIDTHS, HEADER_WIDTHS } from '../lib/presets'
import { num } from '../lib/format'

// ── Парк машин ────────────────────────────────────────────────────────────
//
// Головна форма всієї програми. Колію нарізають не «під обприскувач», а під
// той набір машин, який реально виїде в поле, тож набір цей має задавати
// господар, а не ми: будь-яка машина, будь-який захват, будь-яка колісна
// база, одна вісь чи дві.
//
// Машину можна вимкнути, не видаляючи. Це не дрібниця інтерфейсу, а те, по
// що сюди приходять: увімкнув комбайн — побачив, на скільки сошників більше
// доведеться заглушити, вимкнув — побачив, скільком це коштує.

export default function MachineList({ machines, setMachines, result }) {
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)

  const patch = (id, change) =>
    setMachines(machines.map((m) => (m.id === id ? { ...m, ...change } : m)))

  const patchAxle = (id, i, change) =>
    setMachines(machines.map((m) => (m.id === id
      ? { ...m, axles: m.axles.map((a, j) => (j === i ? { ...a, ...change } : a)) }
      : m)))

  const add = (kind) => {
    const m = newMachine(kind)
    setMachines([...machines, m])
    setOpen(m.id)
    setAdding(false)
  }

  const remove = (id) => setMachines(machines.filter((m) => m.id !== id))

  // Закріпити базовою — тобто зробити її захват кроком колій. Прапорець
  // завжди на одній машині: двох сіток колій на полі не буває.
  const pinBase = (id) =>
    setMachines(machines.map((m) => ({ ...m, base: m.id === id ? !m.base : false })))

  const reportOf = (id) => result?.machines?.find((x) => x.id === id)

  return (
    <div className="panel">
      <h2>машини на колії</h2>

      <p className="note" style={{ margin: '-4px 0 13px' }}>
        Усі, хто поїде нарізаною колією. Вимкніть машину — і побачите, скільком
        сошників вона коштує.
      </p>

      <div className="mlist">
        {machines.map((m, i) => {
          const r = reportOf(m.id)
          const isOpen = open === m.id
          const kind = kindOf(m.kind)
          return (
            <div
              key={m.id}
              className={`mcard${m.active ? '' : ' is-off'}${isOpen ? ' is-open' : ''}`}
              style={{ '--m': `var(--m${(i % 5) + 1})` }}
            >
              <div className="mcard-top">
                <label className="mswitch" title={m.active ? 'Не враховувати' : 'Враховувати'}>
                  <input
                    type="checkbox"
                    checked={!!m.active}
                    onChange={(e) => patch(m.id, { active: e.target.checked })}
                  />
                  <span />
                </label>

                <button
                  type="button"
                  className="mcard-name"
                  onClick={() => setOpen(isOpen ? null : m.id)}
                  aria-expanded={isOpen}
                >
                  <span className="mcard-label">
                    <i className="mdot" aria-hidden="true" />
                    {m.label || kind.label}
                  </span>
                  <span className="mcard-sum">
                    {num(m.width)} м · база {m.axles.map((a) => num(a.trackWidth)).join(' / ')} м
                  </span>
                </button>

                <div className="mcard-badges">
                  {r?.base && <span className="mbadge is-base">крок колій</span>}
                  {r?.fits && r.extraRows === 0 && !r.base && (
                    <span className="mbadge is-good">їде готовою</span>
                  )}
                  {r?.fits && r.extraRows > 0 && !r.base && (
                    <span className="mbadge is-cost">+{r.extraRows}</span>
                  )}
                  {r?.reason === 'blank' && <span className="mbadge is-bad">не заповнено</span>}
                  {r && m.active && !r.fits && r.reason !== 'blank' && (
                    <span className="mbadge is-bad">не вкладається</span>
                  )}
                  <span className="mcard-chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                </div>
              </div>

              {isOpen && (
                <div className="mcard-body">
                  <label>
                    Назва
                    <input
                      type="text"
                      value={m.label}
                      placeholder={kind.label}
                      onChange={(e) => patch(m.id, { label: e.target.value })}
                    />
                  </label>

                  <div className="duo">
                    <label>
                      Тип
                      <select value={m.kind} onChange={(e) => {
                        const k = kindOf(e.target.value)
                        patch(m.id, {
                          kind: k.kind,
                          // Назву не перетираємо, якщо людина вже вписала свою.
                          label: MACHINE_KINDS.some((x) => x.label === m.label) ? k.label : m.label,
                        })
                      }}>
                        {MACHINE_KINDS.map((k) => (
                          <option key={k.kind} value={k.kind}>{k.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Захват, м
                      <input
                        type="number" min="0.5" step="0.1" value={m.width}
                        list={m.kind === 'combine' || m.kind === 'cart' ? 'header-widths' : 'sprayer-widths'}
                        onChange={(e) => patch(m.id, { width: Number(e.target.value) })}
                      />
                    </label>
                  </div>

                  <label>
                    Готова ходова
                    <select value="" onChange={(e) => {
                      const p = CHASSIS_PRESETS.find((x) => x.key === e.target.value)
                      if (p) patchAxle(m.id, 0, { trackWidth: p.trackWidth, tyreWidth: p.tyreWidth })
                    }}>
                      <option value="" disabled>— підставити в передню вісь —</option>
                      {CHASSIS_PRESETS.map((p) => (
                        <option key={p.key} value={p.key}>{p.label}</option>
                      ))}
                    </select>
                  </label>

                  {m.axles.map((a, ai) => (
                    <div key={ai} className="maxle">
                      <div className="maxle-h">
                        {m.axles.length > 1 ? (ai === 0 ? 'передня вісь' : 'задня вісь') : 'колісна база'}
                        {m.axles.length > 1 && (
                          <button type="button" className="mlink"
                            onClick={() => patch(m.id, { axles: m.axles.filter((_, j) => j !== ai) })}>
                            прибрати
                          </button>
                        )}
                      </div>
                      <div className="duo">
                        <label>
                          Між колесами, м
                          <input type="number" min="0.5" step="0.05" value={a.trackWidth}
                            onChange={(e) => patchAxle(m.id, ai, { trackWidth: Number(e.target.value) })} />
                        </label>
                        <label>
                          Шина, м
                          <input type="number" min="0.05" step="0.01" value={a.tyreWidth}
                            onChange={(e) => patchAxle(m.id, ai, { tyreWidth: Number(e.target.value) })} />
                        </label>
                      </div>
                    </div>
                  ))}

                  {m.axles.length < 2 && (
                    <button type="button" className="mlink mlink-block"
                      onClick={() => patch(m.id, {
                        axles: [...m.axles, { ...m.axles[0] }],
                      })}>
                      + друга вісь на іншій базі
                    </button>
                  )}

                  <div className="duo">
                    <label>
                      Проходів за сезон
                      <input type="number" min="0" step="1" value={m.passes ?? ''}
                        placeholder="спільне"
                        onChange={(e) => patch(m.id, {
                          passes: e.target.value === '' ? null : Number(e.target.value),
                        })} />
                    </label>
                    <label>
                      Зсув від краю, м
                      <input type="number" min="0" step="0.1"
                        value={m.phase ?? ''}
                        placeholder={r?.phase != null ? `авто ${num(r.phase)}` : 'авто'}
                        onChange={(e) => patch(m.id, {
                          phase: e.target.value === '' ? null : Number(e.target.value),
                        })} />
                    </label>
                  </div>

                  <label className="check">
                    <input type="checkbox" checked={!!m.base}
                      onChange={() => pinBase(m.id)} />
                    Крок колій задає ця машина
                  </label>

                  {kind.hint && <p className="note" style={{ margin: '8px 0 0' }}>{kind.hint}</p>}

                  <div className="mcard-foot">
                    <button type="button" className="mlink is-danger" onClick={() => remove(m.id)}>
                      Видалити машину
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <datalist id="sprayer-widths">
        {SPRAYER_WIDTHS.map((w) => <option key={w} value={w} />)}
      </datalist>
      <datalist id="header-widths">
        {HEADER_WIDTHS.map((w) => <option key={w} value={w} />)}
      </datalist>

      {adding ? (
        <div className="madd">
          {MACHINE_KINDS.map((k) => (
            <button key={k.kind} type="button" className="btn btn-sm btn-quiet"
              onClick={() => add(k.kind)}>
              {k.label}
            </button>
          ))}
          <button type="button" className="mlink" onClick={() => setAdding(false)}>
            скасувати
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-sm btn-quiet mwide"
          onClick={() => setAdding(true)}>
          + додати машину
        </button>
      )}
    </div>
  )
}
