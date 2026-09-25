import express from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db.js'
import { sign, requireAuth } from '../auth.js'

const router = express.Router()

const clean = (u) => ({ id: u.id, email: u.email, name: u.name })

// Пошта як логін: її людина памʼятає й без підказок, на відміну від
// вигаданого нікнейму.
const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)

router.post('/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const name = String(req.body.name || '').trim() || null

  if (!looksLikeEmail(email)) return res.status(400).json({ error: 'Схоже, у пошті помилка' })
  if (password.length < 8) return res.status(400).json({ error: 'Пароль — щонайменше 8 символів' })

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
       RETURNING id, email, name`,
      [email, bcrypt.hashSync(password, 10), name],
    )
    res.json({ token: sign(rows[0]), user: clean(rows[0]) })
  } catch (e) {
    // 23505 — unique_violation на email
    if (e.code === '23505') return res.status(409).json({ error: 'Такий акаунт уже є — увійдіть' })
    res.status(500).json({ error: e.message })
  }
})

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    const user = rows[0]
    // Одна відповідь на «немає такого» і «пароль не той»: інакше форма
    // перетворюється на перевірку, хто в системі зареєстрований.
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Пошта або пароль не підходять' })
    }
    res.json({ token: sign(user), user: clean(user) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.user.id])
  if (!rows[0]) return res.status(401).json({ error: 'Акаунт не знайдено' })
  res.json({ user: rows[0] })
})

export default router
