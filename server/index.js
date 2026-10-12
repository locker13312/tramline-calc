import 'dotenv/config'

import { init } from './db.js'
import { createApp } from './app.js'

// Точка входу: оточення, схема бази, порт. Самі маршрути — в `app.js`, щоб
// перевірка піднімала рівно той застосунок, що тут слухає порт.
const PORT = process.env.PORT || 3002

init()
  .then(() => createApp().listen(PORT, '0.0.0.0', () => console.log(`Колія на :${PORT}`)))
  .catch((e) => { console.error('База не піднялась:', e.message); process.exit(1) })
