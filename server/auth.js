import jwt from 'jsonwebtoken'

// Без секрету не стартуємо: підписані ним сесії — єдине, що відрізняє
// власника полів від будь-кого іншого.
const SECRET = process.env.JWT_SECRET
if (!SECRET) {
  console.error('Немає JWT_SECRET — сервер не стартує.')
  process.exit(1)
}

export function sign(user) {
  return jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '90d' })
}

// Обовʼязкова авторизація: сюди потрапляють лише маршрути з чужими даними.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Потрібен вхід' })
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Сесія застаріла — увійдіть знову' })
  }
}
