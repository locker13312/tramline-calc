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
      'tyre_width', 'margin', 'spreader_width', 'half_start'],
    required: ['name', 'rows', 'row_spacing', 'sprayer_width'],
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
  return { values: spec.columns.map((c) => (body[c] === '' ? null : body[c] ?? null)) }
}

for (const [table, spec] of Object.entries(TABLES)) {
  router.get(`/${table}`, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM ${table} WHERE user_id = $1 ORDER BY name`, [req.user.id])
    res.json(rows)
  })

  router.post(`/${table}`, async (req, res) => {
    const v = values(spec, req.body)
    if (v.error) return res.status(400).json({ error: v.error })
    const cols = spec.columns.join(', ')
    const marks = spec.columns.map((_, i) => `$${i + 2}`).join(', ')
    try {
      const { rows } = await pool.query(
        `INSERT INTO ${table} (user_id, ${cols}) VALUES ($1, ${marks}) RETURNING *`,
        [req.user.id, ...v.values])
      res.json(rows[0])
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  router.put(`/${table}/:id`, async (req, res) => {
    const v = values(spec, req.body)
    if (v.error) return res.status(400).json({ error: v.error })
    const sets = spec.columns.map((c, i) => `${c} = $${i + 3}`).join(', ')
    try {
      // user_id в умові, а не лише id: інакше чужий запис міняється за
      // номером.
      const { rows } = await pool.query(
        `UPDATE ${table} SET ${sets} WHERE id = $1 AND user_id = $2 RETURNING *`,
        [req.params.id, req.user.id, ...v.values])
      if (!rows[0]) return res.status(404).json({ error: 'Запис не знайдено' })
      res.json(rows[0])
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  router.delete(`/${table}/:id`, async (req, res) => {
    const { rowCount } = await pool.query(
      `DELETE FROM ${table} WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id])
    if (!rowCount) return res.status(404).json({ error: 'Запис не знайдено' })
    res.json({ ok: true })
  })
}

export default router
