import 'dotenv/config'

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { init } from './db.js'
import authRoutes from './routes/auth.js'
import savedRoutes from './routes/saved.js'

const app = express()
app.use(express.json({ limit: '256kb' }))

// Найпростіший захист від перебору пароля: рахуємо спроби на IP у памʼяті
// процесу. Для одного сервісу з однією копією цього досить, Redis тут зайвий.
const attempts = new Map()
app.use('/api/auth', (req, res, next) => {
  if (req.method !== 'POST') return next()
  const ip = req.ip || 'unknown'
  const now = Date.now()
  const window = 15 * 60 * 1000
  const list = (attempts.get(ip) || []).filter((t) => now - t < window)
  if (list.length >= 20) {
    return res.status(429).json({ error: 'Забагато спроб — зачекайте чверть години' })
  }
  list.push(now)
  attempts.set(ip, list)
  next()
})

app.get('/api/health', (req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)
app.use('/api', savedRoutes)

// Зібраний фронтенд роздає той самий процес — окремий статичний сервіс тут
// нічого не дав би, крім другого деплою.
const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, '..', 'dist')
app.use(express.static(dist))
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')))

const PORT = process.env.PORT || 3002

init()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Колія на :${PORT}`)))
  .catch((e) => { console.error('База не піднялась:', e.message); process.exit(1) })
