import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { num } from '../lib/format'

// Збережені поля й комплекти техніки. Господарство має ті самі два-три
// комплекти роками й десяток полів — вводити їх щоразу заново безглуздо.
//
// Список і форма живуть в одному компоненті, бо відрізняються тільки набором
// колонок: що показати в рядку і що взяти з розрахунку при збереженні.
const KINDS = {
  fields: {
    title: 'мої поля',
    one: 'поле',
    empty: 'Збережених полів ще немає.',
    // Що йде в базу з поточного розрахунку
    from: (input) => ({
      width: input.fieldWidth, length: input.fieldLength, headland: input.headland,
      crop: input.crop, yield_per_ha: input.yieldPerHa, price_per_ton: input.pricePerTon,
      passes: input.passes, damage_pct: input.damagePct,
    }),
    // Що повертається в форму
    into: (row) => ({
      fieldWidth: Number(row.width), fieldLength: Number(row.length),
      headland: Number(row.headland), crop: row.crop || undefined,
      yieldPerHa: Number(row.yield_per_ha), pricePerTon: Number(row.price_per_ton),
      passes: Number(row.passes), damagePct: Number(row.damage_pct),
    }),
    describe: (row) => `${num(Number(row.width))} × ${num(Number(row.length))} м · ` +
      `${num((row.width * row.length) / 10000, 1)} га` +
      (Number(row.headland) > 0 ? ` · обсів ${num(Number(row.headland))} м` : ''),
  },
  machines: {
    title: 'техніка',
    one: 'комплект',
    empty: 'Збережених комплектів ще немає.',
    from: (input) => {
      // Головна машина — щоб комплект мав осмислені старі колонки й читався
      // на клієнті, який про список машин ще не знає.
      const lead = input.machines?.find((m) => m.base && m.active !== false)
        || input.machines?.find((m) => m.active !== false)
        || null
      return {
        rows: input.rows, row_spacing: input.rowSpacing,
        sprayer_width: lead?.width ?? input.sprayerWidth,
        track_width: lead?.axles?.[0]?.trackWidth ?? input.trackWidth,
        tyre_width: lead?.axles?.[0]?.tyreWidth ?? input.tyreWidth,
        margin: input.margin, spreader_width: 0, half_start: input.halfStart,
        // Повний комплект одним JSON: машини, розкладка сошників, трактор.
        park: {
          machines: input.machines ?? null,
          coulters: input.coulters ?? null,
          drillWidth: input.drillWidth ?? null,
          drillTractor: input.drillTractor ?? null,
        },
      }
    },
    into: (row) => {
      const base = {
        rows: Number(row.rows), rowSpacing: Number(row.row_spacing),
        sprayerWidth: Number(row.sprayer_width), trackWidth: Number(row.track_width),
        tyreWidth: Number(row.tyre_width), margin: Number(row.margin),
        halfStart: !!row.half_start,
      }
      const park = typeof row.park === 'string' ? safeParse(row.park) : row.park
      if (!park) return base
      // Чого в комплекті немає, те й не чіпаємо: записаний патч накладається
      // на поточні дані, і undefined затер би добре значення порожнечею.
      const extra = {}
      if (park.machines) extra.machines = park.machines
      if (park.coulters) extra.coulters = park.coulters
      if (park.drillWidth) extra.drillWidth = park.drillWidth
      if (park.drillTractor) extra.drillTractor = park.drillTractor
      return { ...base, ...extra }
    },
    describe: (row) => {
      const park = typeof row.park === 'string' ? safeParse(row.park) : row.park
      const live = park?.machines?.filter((m) => m.active !== false) ?? null
      return `сівалка ${num(row.rows * row.row_spacing)} м (${row.rows} × ` +
        `${num(Number(row.row_spacing))})` +
        (live?.length
          ? ` · ${live.map((m) => `${m.label} ${num(m.width)} м`).join(' · ')}`
          : ` · обприскувач ${num(Number(row.sprayer_width))} м · ` +
            `колія ${num(Number(row.track_width))} м`)
    },
  },
}

// Комплект, записаний зламаним клієнтом, не має валити сторінку зі списком:
// краще показати старі колонки, ніж нічого.
function safeParse(s) {
  try { return JSON.parse(s) } catch { return null }
}

export default function Saved({ kind, input, onLoad }) {
  const spec = KINDS[kind]
  const [rows, setRows] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = () => api.list(kind).then(setRows).catch((e) => setError(e.message))
  useEffect(() => { setRows(null); setError(''); reload() }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true); setError('')
    try {
      await api.create(kind, { name: name.trim(), ...spec.from(input) })
      setName('')
      await reload()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const remove = async (row) => {
    setError('')
    try { await api.remove(kind, row.id); await reload() }
    catch (err) { setError(err.message) }
  }

  return (
    <div className="stack">
      <div className="panel">
        <h2>зберегти поточн{kind === 'fields' ? 'е поле' : 'ий комплект'}</h2>
        <form className="save-row" onSubmit={save}>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'fields' ? 'Назва поля — «За фермою»' : 'Назва комплекту — «Väderstad + Amazone»'} />
          <button className="btn" type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Зберігаю…' : 'Зберегти'}
          </button>
        </form>
        <p className="note" style={{ margin: '9px 0 0' }}>
          Запишеться те, що зараз стоїть у формі розрахунку.
        </p>
      </div>

      <div className="panel">
        <h2>{spec.title}</h2>
        {error && <p className="warn" style={{ marginTop: 0 }}>{error}</p>}
        {!rows && !error && <p className="note" style={{ margin: 0 }}>Завантажую…</p>}
        {rows && !rows.length && <p className="note" style={{ margin: 0 }}>{spec.empty}</p>}

        <div className="advice">
          {rows?.map((row) => (
            <div key={row.id} className="opt saved-row">
              <div className="saved-main">
                <div className="saved-name">{row.name}</div>
                <div className="opt-t">{spec.describe(row)}</div>
              </div>
              <div className="saved-actions">
                <button className="btn btn-sm" onClick={() => onLoad(spec.into(row))}>
                  Підставити
                </button>
                <button className="btn btn-sm btn-quiet" onClick={() => remove(row)}
                  title={`Видалити ${spec.one}`}>
                  Видалити
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
