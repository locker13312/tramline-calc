import pg from 'pg'

// Neon вимагає TLS, локальний Postgres його не має — вмикаємо за ознакою
// хоста, щоб один і той самий код працював в обох місцях.
const url = process.env.DATABASE_URL || ''
const local = /localhost|127\.0\.0\.1/.test(url)

export const pool = new pg.Pool({
  connectionString: url,
  ssl: local ? false : { rejectUnauthorized: false },
})

// Схема створюється й доповнюється сама при старті. Усі міграції додавальні
// й ідемпотентні: той самий код обслуговує і порожню базу, і ту, що вже
// працює з живими акаунтами.
export async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(200) NOT NULL UNIQUE,
      password_hash VARCHAR(200) NOT NULL,
      name VARCHAR(120),
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Комплект техніки: сівалка + обприскувач + розкидач. Саме те, що людина
    -- вводить щоразу заново, хоча в господарстві воно не міняється роками.
    CREATE TABLE IF NOT EXISTS machines (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      rows INTEGER NOT NULL,
      row_spacing NUMERIC(6,3) NOT NULL,
      sprayer_width NUMERIC(7,2) NOT NULL,
      track_width NUMERIC(5,2) NOT NULL,
      tyre_width NUMERIC(5,3) NOT NULL,
      margin NUMERIC(5,3) DEFAULT 0.1,
      spreader_width NUMERIC(7,2) DEFAULT 0,
      half_start BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS fields (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      width NUMERIC(8,1) NOT NULL,
      length NUMERIC(8,1) NOT NULL,
      headland NUMERIC(6,1) DEFAULT 0,
      crop VARCHAR(40),
      yield_per_ha NUMERIC(6,2),
      price_per_ton NUMERIC(10,2),
      passes INTEGER,
      damage_pct INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS machines_user ON machines(user_id);
    CREATE INDEX IF NOT EXISTS fields_user ON fields(user_id);
  `)
}
