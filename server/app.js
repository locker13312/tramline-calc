import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import authRoutes from './routes/auth.js'
import savedRoutes from './routes/saved.js'

// Складання застосунку відділене від запуску: той самий набір маршрутів
// піднімає і прод (`index.js` — з базою, портом і зібраним фронтендом), і
// перевірка (`test/server.mjs` — на окремій базі й випадковому порту).
// Інакше тест мусив би або перескладати маршрути в себе, перевіряючи вже не
// те, що працює на проді, або запускати процес і вгадувати, коли той готовий.
//
// `attemptLimit` і `serveStatic` існують рівно для цього: перевірка бере
// низький поріг спроб, щоб не слати двадцять однакових запитів, і не чекає
// на `dist/`, якого в неї може й не бути.
export function createApp({ attemptLimit = 20, serveStatic = true } = {}) {
  const app = express()
  app.use(express.json({ limit: '256kb' }))

  // Найпростіший захист від перебору пароля: рахуємо спроби на IP у памʼяті
  // процесу. Для одного сервісу з однією копією цього досить, Redis тут зайвий.
  const attempts = new Map()
  const WINDOW = 15 * 60 * 1000
  app.use('/api/auth', (req, res, next) => {
    if (req.method !== 'POST') return next()
    const ip = req.ip || 'unknown'
    const now = Date.now()
    const list = (attempts.get(ip) || []).filter((t) => now - t < WINDOW)
    if (list.length >= attemptLimit) {
      return res.status(429).json({ error: 'Забагато спроб — зачекайте чверть години' })
    }
    list.push(now)
    attempts.set(ip, list)
    // Прибирання за собою: інакше запис лишався на кожен IP, що колись сюди
    // заходив, і Map росла весь час роботи процесу, хоч спроби давно застаріли.
    if (attempts.size > 500) {
      for (const [key, times] of attempts) {
        if (times.every((t) => now - t >= WINDOW)) attempts.delete(key)
      }
    }
    next()
  })

  // Номер коміту, який зараз живе на проді. Render кладе його в оточення сам.
  // Без цього «чи задеплоїлось?» доводиться вгадувати по хешу бандла, а він
  // змінюється не від кожного коміту.
  const startedAt = new Date().toISOString()
  app.get('/api/health', (req, res) => res.json({
    ok: true,
    commit: (process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7),
    startedAt,
  }))
  app.use('/api/auth', authRoutes)
  app.use('/api', savedRoutes)

  // Невідомий маршрут під /api/ — це 404 застосунку, а не сторінка. Без цього
  // помилка в адресі запиту приходила б клієнтові сторінкою, і `res.json()`
  // на ній падав би розбором HTML замість «чого ви хочете?».
  app.use('/api', (req, res) => res.status(404).json({ error: 'Невідомий запит' }))

  // Зібраний фронтенд роздає той самий процес — окремий статичний сервіс тут
  // нічого не дав би, крім другого деплою.
  if (serveStatic) {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const dist = path.join(here, '..', 'dist')
    app.use(express.static(dist))
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')))
  }

  return app
}
