// Тонкий шар над fetch: підставляє токен і перетворює відповідь сервера на
// помилку з людським текстом, щоб компоненти не розбирали HTTP самі.
const KEY = 'tramline_token'

export const token = {
  get: () => { try { return localStorage.getItem(KEY) } catch { return null } },
  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY) } catch { /* приватний режим */ } },
}

async function call(method, path, body) {
  const t = token.get()
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Сервер відповів ${res.status}`)
  return data
}

export const api = {
  register: (b) => call('POST', '/auth/register', b),
  login: (b) => call('POST', '/auth/login', b),
  me: () => call('GET', '/auth/me'),

  list: (kind) => call('GET', `/${kind}`),
  create: (kind, b) => call('POST', `/${kind}`, b),
  update: (kind, id, b) => call('PUT', `/${kind}/${id}`, b),
  remove: (kind, id) => call('DELETE', `/${kind}/${id}`),
}
