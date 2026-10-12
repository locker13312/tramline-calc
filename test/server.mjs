// Перевірка акаунтів: реєстрація, вхід, збережені поля й техніка. Єдина
// перевірка, якій потрібен Postgres, тому вона окремо від `npm test` — той
// має крутитися всюди й без бази.
//
// Працює на власній базі `tramline_test`: схему піднімає той самий `init()`,
// що й на проді, а таблиці чистить перед кожним розділом. Робочу базу не
// чіпає — інакше перевірка стирала б те, що людина ввела руками.
import test, { before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import 'dotenv/config'

const TEST_DB = 'tramline_test'

let base = null
let pool = null
let skip = null

// Адреса тієї ж установки Postgres, але з іншою назвою бази.
const swapDb = (url, name) => url.replace(/\/[^/?]*(\?|$)/, `/${name}$1`)

const listen = (app) => new Promise((done) => {
  const s = createServer(app)
  s.listen(0, '127.0.0.1', () => done(s))
})

try {
  const pg = (await import('pg')).default
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('немає DATABASE_URL')

  // CREATE DATABASE не має IF NOT EXISTS, тому ловимо 42P04 — «вже є».
  const admin = new pg.Client({ connectionString: swapDb(url, 'postgres') })
  await admin.connect()
  try {
    await admin.query(`CREATE DATABASE ${TEST_DB}`)
  } catch (e) {
    if (e.code !== '42P04') throw e
  }
  await admin.end()

  // db.js читає оточення на імпорті, а auth.js без JWT_SECRET глушить процес,
  // тож обоє підставляємо до першого імпорту сервера.
  process.env.DATABASE_URL = swapDb(url, TEST_DB)
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'перевірка'

  const db = await import('../server/db.js')
  await db.init()
  pool = db.pool

  const { createApp } = await import('../server/app.js')
  // Поріг спроб високий і без статики: розділи шлють десятки запитів на вхід,
  // а зібраного `dist/` у перевірки може не бути.
  const server = await listen(createApp({ attemptLimit: 500, serveStatic: false }))
  base = `http://127.0.0.1:${server.address().port}`
  after(async () => { server.close(); await pool.end() })
} catch (e) {
  skip = `Postgres недоступний (${e.message})`
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = null }
  return { status: res.status, data, text }
}

const clear = () => pool.query('TRUNCATE users, machines, fields RESTART IDENTITY CASCADE')

// Готовий акаунт: пошта унікальна на виклик, щоб розділи не чіплялися один за
// одного, навіть коли базу не чистили.
let n = 0
async function account(name = 'Господар') {
  const email = `test${++n}@lan.ua`
  const { status, data } = await req('POST', '/api/auth/register',
    { body: { email, password: 'пароль12345', name } })
  assert.equal(status, 200, `реєстрація ${email}: ${JSON.stringify(data)}`)
  return { ...data, email }
}

const FIELD = { name: 'За греблею', width: 300, length: 800, headland: 24, crop: 'wheat' }

if (skip) {
  test(`перевірка акаунтів пропущена: ${skip}`, { skip: true }, () => {})
} else {

describe('сервер відповідає', () => {
  test('здоровʼя: ok і номер коміту', async () => {
    const { status, data } = await req('GET', '/api/health')
    assert.equal(status, 200)
    assert.equal(data.ok, true)
    assert.ok(data.commit)
    assert.ok(Date.parse(data.startedAt))
  })

  test('невідомий запит під /api — це відповідь словами, а не сторінка', async () => {
    // Без токена відповідає 401: маршрути зі збереженим стоять за перевіркою
    // входу, і вона зустрічає запит раніше, ніж «такого немає». Так і треба —
    // перелік того, які адреси існують, нікому поза акаунтом не потрібен.
    const guest = await req('GET', '/api/nothing-here')
    assert.equal(guest.status, 401)
    assert.ok(guest.data?.error, 'очікував JSON з помилкою')

    // З токеном — уже 404, і теж словами, а не сторінкою: інакше клієнт
    // розбирав би HTML замість «чого ви хочете».
    const me = await account()
    const known = await req('GET', '/api/nothing-here', { token: me.token })
    assert.equal(known.status, 404)
    assert.ok(known.data?.error)
  })
})

describe('реєстрація', () => {
  before(clear)

  test('нормальна пошта й пароль — токен і акаунт без хеша', async () => {
    const { status, data } = await req('POST', '/api/auth/register',
      { body: { email: 'ivan@lan.ua', password: 'пароль12345', name: 'Іван' } })
    assert.equal(status, 200)
    assert.ok(data.token)
    assert.equal(data.user.email, 'ivan@lan.ua')
    assert.equal(data.user.name, 'Іван')
    // Хеш пароля не має виходити за межі сервера навіть власникові акаунта.
    assert.deepEqual(Object.keys(data.user).sort(), ['email', 'id', 'name'])
  })

  test('пошта з пробілами й великими літерами — та сама пошта', async () => {
    const { status, data } = await req('POST', '/api/auth/register',
      { body: { email: '  Petro@LAN.ua ', password: 'пароль12345' } })
    assert.equal(status, 200)
    assert.equal(data.user.email, 'petro@lan.ua')
    assert.equal(data.user.name, null)

    // І вхід іншим написанням тієї ж пошти мусить працювати.
    const again = await req('POST', '/api/auth/login',
      { body: { email: 'PETRO@lan.ua', password: 'пароль12345' } })
    assert.equal(again.status, 200)
  })

  test('те, що на пошту не схоже, не приймається', async () => {
    for (const email of ['', 'ivan', 'ivan@', 'ivan@lan', '@lan.ua', 'ivan @lan.ua']) {
      const { status } = await req('POST', '/api/auth/register',
        { body: { email, password: 'пароль12345' } })
      assert.equal(status, 400, `«${email}» прийняли`)
    }
  })

  test('короткий пароль не приймається, рівно вісім — приймається', async () => {
    const short = await req('POST', '/api/auth/register',
      { body: { email: 'korotko@lan.ua', password: '1234567' } })
    assert.equal(short.status, 400)

    const ok = await req('POST', '/api/auth/register',
      { body: { email: 'korotko@lan.ua', password: '12345678' } })
    assert.equal(ok.status, 200)
  })

  test('друга реєстрація на ту саму пошту — 409, а не другий акаунт', async () => {
    const body = { email: 'dubl@lan.ua', password: 'пароль12345' }
    assert.equal((await req('POST', '/api/auth/register', { body })).status, 200)

    const { status, data } = await req('POST', '/api/auth/register', { body })
    assert.equal(status, 409)
    assert.match(data.error, /уже є/)

    const { rows } = await pool.query('SELECT count(*) FROM users WHERE email = $1', [body.email])
    assert.equal(rows[0].count, '1')
  })

  test('порожнє тіло не валить сервер', async () => {
    const { status, data } = await req('POST', '/api/auth/register', { body: {} })
    assert.equal(status, 400)
    assert.ok(data.error)
  })
})

describe('вхід і сесія', () => {
  before(clear)

  test('свій пароль пускає, чужий — ні', async () => {
    const { email } = await account()

    const ok = await req('POST', '/api/auth/login', { body: { email, password: 'пароль12345' } })
    assert.equal(ok.status, 200)
    assert.ok(ok.data.token)

    const no = await req('POST', '/api/auth/login', { body: { email, password: 'пароль12346' } })
    assert.equal(no.status, 401)
  })

  test('«нема такого» і «пароль не той» відповідають однаково', async () => {
    const { email } = await account()
    const wrong = await req('POST', '/api/auth/login', { body: { email, password: 'нетой12345' } })
    const nobody = await req('POST', '/api/auth/login',
      { body: { email: 'нікого@lan.ua', password: 'нетой12345' } })
    // Інакше форма входу стає перевіркою, хто тут зареєстрований.
    assert.equal(wrong.status, nobody.status)
    assert.equal(wrong.data.error, nobody.data.error)
  })

  test('хто я: з токеном — свій акаунт, без токена й з підробленим — 401', async () => {
    const me = await account('Мирон')
    const good = await req('GET', '/api/auth/me', { token: me.token })
    assert.equal(good.status, 200)
    assert.equal(good.data.user.email, me.email)
    assert.equal(good.data.user.name, 'Мирон')

    // Токени тут навмисно з латиниці: заголовок HTTP не приймає байтів поза
    // ASCII, і «сміття» кирилицею впало б у самому fetch, не доходячи до
    // сервера, — перевірка показувала б поломку перевірки, а не сервера.
    for (const token of [undefined, 'smittia', me.token + 'x', me.token.slice(0, -4)]) {
      const { status } = await req('GET', '/api/auth/me', { token })
      assert.equal(status, 401, `токен «${String(token).slice(0, 12)}…» пустили`)
    }
  })

  test('після видалення акаунта його токен уже не працює', async () => {
    const me = await account()
    await pool.query('DELETE FROM users WHERE email = $1', [me.email])
    const { status } = await req('GET', '/api/auth/me', { token: me.token })
    assert.equal(status, 401)
  })
})

describe('збережені поля й техніка', () => {
  before(clear)

  test('без входу не видно й не записати', async () => {
    for (const kind of ['fields', 'machines']) {
      assert.equal((await req('GET', `/api/${kind}`)).status, 401)
      assert.equal((await req('POST', `/api/${kind}`, { body: FIELD })).status, 401)
      assert.equal((await req('PUT', `/api/${kind}/1`, { body: FIELD })).status, 401)
      assert.equal((await req('DELETE', `/api/${kind}/1`)).status, 401)
    }
  })

  test('новий акаунт — порожній список', async () => {
    const me = await account()
    const { status, data } = await req('GET', '/api/fields', { token: me.token })
    assert.equal(status, 200)
    assert.deepEqual(data, [])
  })

  test('поле: записали, прочитали, змінили, видалили', async () => {
    const me = await account()

    const made = await req('POST', '/api/fields', { token: me.token, body: FIELD })
    assert.equal(made.status, 200)
    assert.equal(made.data.name, FIELD.name)
    assert.equal(Number(made.data.width), 300)
    assert.equal(Number(made.data.headland), 24)
    assert.equal(made.data.crop, 'wheat')

    const list = await req('GET', '/api/fields', { token: me.token })
    assert.equal(list.data.length, 1)
    assert.equal(list.data[0].id, made.data.id)

    const changed = await req('PUT', `/api/fields/${made.data.id}`,
      { token: me.token, body: { ...FIELD, name: 'Під лісом', width: 420 } })
    assert.equal(changed.status, 200)
    assert.equal(changed.data.name, 'Під лісом')
    assert.equal(Number(changed.data.width), 420)

    const gone = await req('DELETE', `/api/fields/${made.data.id}`, { token: me.token })
    assert.equal(gone.status, 200)
    assert.deepEqual((await req('GET', '/api/fields', { token: me.token })).data, [])
  })

  test('без назви, ширини чи довжини поле не записується', async () => {
    const me = await account()
    for (const missing of ['name', 'width', 'length']) {
      const body = { ...FIELD, [missing]: '' }
      const { status, data } = await req('POST', '/api/fields', { token: me.token, body })
      assert.equal(status, 400, `без «${missing}» записали`)
      assert.match(data.error, new RegExp(missing))
    }
  })

  test('парк машин повертається тим самим списком, яким пішов', async () => {
    const me = await account()
    const park = [
      { name: 'Сівалка', width: 4.8, rows: 32, spacing: 0.15 },
      { name: 'Обприскувач', width: 24, track: 1.8, tyre: 0.55 },
    ]
    const made = await req('POST', '/api/machines', {
      token: me.token,
      body: {
        name: 'Комплект', rows: 32, row_spacing: 0.15, sprayer_width: 24,
        track_width: 1.8, tyre_width: 0.55, park,
      },
    })
    assert.equal(made.status, 200)
    // JSONB мусить вернутися списком, а не рядком і не масивом Postgres.
    assert.deepEqual(made.data.park, park)

    const list = await req('GET', '/api/machines', { token: me.token })
    assert.deepEqual(list.data[0].park, park)
  })

  test('комплект без парку — теж комплект: такі записані до появи списку машин', async () => {
    const me = await account()
    const { status, data } = await req('POST', '/api/machines', {
      token: me.token,
      body: {
        name: 'Старий запис', rows: 24, row_spacing: 0.125, sprayer_width: 18,
        track_width: 1.8, tyre_width: 0.35,
      },
    })
    assert.equal(status, 200)
    assert.equal(data.park, null)
  })

  test('комплект без колісної бази зберігається: у головної машини нема коліс', async () => {
    const me = await account()
    const body = {
      name: 'Самий комбайн', rows: 24, row_spacing: 0.125, sprayer_width: 9,
      park: [{ name: 'Комбайн', width: 9 }],
    }
    // Доки з track_width і tyre_width не було знято NOT NULL, цей запит
    // падав на обмеженні бази: назовні 500 «збій на сервері», у журналі —
    // текст від Postgres, а комплект не зберігався зовсім.
    const { status, data } = await req('POST', '/api/machines', { token: me.token, body })
    assert.equal(status, 200, `відповідь ${status}: ${JSON.stringify(data)}`)
    assert.equal(data.track_width, null)
    assert.deepEqual(data.park, body.park)
  })

  test('список іде за назвою, а не за часом запису', async () => {
    const me = await account()
    for (const name of ['Яблунева', 'Балка', 'Містечко']) {
      await req('POST', '/api/fields', { token: me.token, body: { ...FIELD, name } })
    }
    const { data } = await req('GET', '/api/fields', { token: me.token })
    assert.deepEqual(data.map((f) => f.name), ['Балка', 'Містечко', 'Яблунева'])
  })
})

describe('чужого не видно', () => {
  before(clear)

  test('сусід не читає, не змінює і не видаляє мого поля', async () => {
    const my = await account('Мій')
    const neighbour = await account('Сусід')

    const made = await req('POST', '/api/fields', { token: my.token, body: FIELD })
    const id = made.data.id

    // У списку сусіда мого поля немає.
    assert.deepEqual((await req('GET', '/api/fields', { token: neighbour.token })).data, [])

    // Зміна за номером — «не знайдено», і запис лишається недоторканим.
    const edit = await req('PUT', `/api/fields/${id}`,
      { token: neighbour.token, body: { ...FIELD, name: 'Моє тепер' } })
    assert.equal(edit.status, 404)

    const del = await req('DELETE', `/api/fields/${id}`, { token: neighbour.token })
    assert.equal(del.status, 404)

    const mine = await req('GET', '/api/fields', { token: my.token })
    assert.equal(mine.data.length, 1)
    assert.equal(mine.data[0].name, FIELD.name)
  })

  test('разом з акаунтом зникають його поля й техніка', async () => {
    // Чистимо тут, а не лише на початку розділу: лічильник нижче дивиться на
    // всю таблицю, і запис сусіда з попередньої перевірки читався б як
    // «лишилося без господаря».
    await clear()
    const me = await account()
    await req('POST', '/api/fields', { token: me.token, body: FIELD })
    await req('POST', '/api/machines', {
      token: me.token,
      body: {
        name: 'Комплект', rows: 24, row_spacing: 0.125, sprayer_width: 18,
        track_width: 1.8, tyre_width: 0.35,
      },
    })

    await pool.query('DELETE FROM users WHERE email = $1', [me.email])
    for (const table of ['fields', 'machines']) {
      const { rows } = await pool.query(`SELECT count(*) FROM ${table}`)
      assert.equal(rows[0].count, '0', `${table} лишилися без господаря`)
    }
  })
})

describe('кривий номер запису', () => {
  before(clear)

  test('не число, нуль, відʼємне й більше за int — 404, а не 500', async () => {
    const me = await account()
    for (const id of ['abc', '0', '-1', '2147483648', '9999999999999', '1.5']) {
      for (const method of ['PUT', 'DELETE']) {
        const { status } = await req(method, `/api/fields/${id}`,
          { token: me.token, body: FIELD })
        assert.equal(status, 404, `${method} /api/fields/${id} → ${status}`)
      }
    }
  })

  test('номер неіснуючого запису — 404', async () => {
    const me = await account()
    assert.equal((await req('DELETE', '/api/fields/77777', { token: me.token })).status, 404)
  })
})

describe('перебір пароля', () => {
  test('після порогу спроб відповідь 429, а читання далі працює', async () => {
    const { createApp } = await import('../server/app.js')
    const limit = 3
    const s = await listen(createApp({ attemptLimit: limit, serveStatic: false }))
    const at = `http://127.0.0.1:${s.address().port}`
    const hit = () => fetch(`${at}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'нікого@lan.ua', password: 'вгадую12345' }),
    })

    try {
      for (let i = 0; i < limit; i++) assert.equal((await hit()).status, 401)
      assert.equal((await hit()).status, 429)
      // Лічильник не чіпає читання: заблокований вхід не має глушити сторінку.
      assert.equal((await fetch(`${at}/api/health`)).status, 200)
    } finally {
      s.close()
    }
  })
})

}
