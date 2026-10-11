import express from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth.js'

const router = express.Router()
router.use(requireAuth)

// Поля й комплекти техніки влаштовані однаково: список, додати, змінити,
// видалити — і все строго в межах свого акаунта. Тому й код один на двох,
// із описом колонок замість двох майже однакових файлів.
const TABLES = {
  machines: {
    columns: ['name', 'rows', 'row_spacing', 'sprayer_width', 'track_width',
      'tyre_width', 'margin', 'spreader_width', 'half_start', 'park'],
    required: ['name', 'rows', 'row_spacing', 'sprayer_width'],
    // park — цілий комплект одним JSON. Його не вимагаємо: комплекти,
    // записані до появи списку машин, мусять зберігатися й надалі.
    json: ['park'],
  },
  fields: {
    columns: ['name', 'width', 'length', 'headland', 'crop',
      'yield_per_ha', 'price_per_ton', 'passes', 'damage_pct'],
    required: ['name', 'width', 'length'],
  },
}

function values(spec, body) {
  const missing = spec.required.filter((c) => body[c] == null || body[c] === '')
  if (missing.length) return { error: `Не заповнено: ${missing.join(', ')}` }
  const json = new Set(spec.json ?? [])
  return {
    values: spec.columns.map((c) => {
      const v = body[c] === '' ? null : body[c] ?? null
      // JSONB-колонки передаємо рядком: масив, відданий драйверу як є,
      // перетворився б у масив Postgres, а не в JSON.
      if (json.has(c) && v != null) return JSON.stringify(v)
      return v
    }),
  }
}

// Номер запису з адреси. `id` у базі — ціле, і «abc» там не «не знайдено», а
// помилка типу від Postgres: 500 замість 404, а в маршруті без catch —
// обірване зʼєднання, бо Express 4 відхилених обіцянок не ловить.
const idOf = (raw) => {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null
}

// Жоден асинхронний обробник не лишається без catch. Без цього будь-який збій
// бази — обрив зʼєднання з боку клієнта: сторінка крутить спінер, поки не
// впіймає таймаут, і ніде ні слова про причину.
//
// Назовні йде одне речення, а не текст від Postgres: у ньому бувають назви
// колонок і сам запит, і нікому поза сервером вони не потрібні. Повний текст
// лишається в журналі сервера, де його й читають.
const guard = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (e) {
    console.error(`${req.method} ${req.originalUrl}:`, e)
    if (!res.headersSent) res.status(500).json({ error: 'Збій на сервері — спробуйте ще раз' })
  }
}

for (const [table, spec] of Object.entries(TABLES)) {
  router.get(`/${table}`, guard(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM ${table} WHERE user_id = $1 ORDER BY name`, [req.user.id])
    res.json(rows)
  }))

  router.post(`/${table}`, guard(async (req, res) => {
    const v = values(spec, req.body)
    if (v.error) return res.status(400).json({ error: v.error })
    const cols = spec.columns.join(', ')
    const marks = spec.columns.map((_, i) => `$${i + 2}`).join(', ')
    const { rows } = await pool.query(
      `INSERT INTO ${table} (user_id, ${cols}) VALUES ($1, ${marks}) RETURNING *`,
      [req.user.id, ...v.values])
    res.json(rows[0])
  }))

  router.put(`/${table}/:id`, guard(async (req, res) => {
    const id = idOf(req.params.id)
    if (id == null) return res.status(404).json({ error: 'Запис не знайдено' })
    const v = values(spec, req.body)
    if (v.error) return res.status(400).json({ error: v.error })
    const sets = spec.columns.map((c, i) => `${c} = $${i + 3}`).join(', ')
    // user_id в умові, а не лише id: інакше чужий запис міняється за номером.
    const { rows } = await pool.query(
      `UPDATE ${table} SET ${sets} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, req.user.id, ...v.values])
    if (!rows[0]) return res.status(404).json({ error: 'Запис не знайдено' })
    res.json(rows[0])
  }))

  router.delete(`/${table}/:id`, guard(async (req, res) => {
    const id = idOf(req.params.id)
    if (id == null) return res.status(404).json({ error: 'Запис не знайдено' })
    const { rowCount } = await pool.query(
      `DELETE FROM ${table} WHERE id = $1 AND user_id = $2`, [id, req.user.id])
    if (!rowCount) return res.status(404).json({ error: 'Запис не знайдено' })
    res.json({ ok: true })
  }))
}

export default router
