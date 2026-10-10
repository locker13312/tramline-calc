import { useEffect, useRef, useState } from 'react'

// ── Тема й колір ──────────────────────────────────────────────────────────
//
// Вибір тут не косметичний. Програму відкривають і за столом при вікні, і в
// кабіні ввечері, і це різні вимоги до тла: те, що читається на папері,
// сліпить у темряві, і навпаки. «Авто» бере системну тему й цього більшості
// досить — але якщо телефон цілий день у світлій темі, а комбайн працює до
// ночі, вибір мусить бути під рукою.
//
// Колір акценту — не примха. Зелений тут означає сходи, та в господарстві
// може бути свій колір, та й просто видно його не всім однаково. Кольори
// машин і колір сліду колеса від акценту не залежать: вони щось означають на
// схемах, і міняти їх під смак не можна.

const THEMES = [
  { key: 'auto', label: 'авто', title: 'Як у системі' },
  { key: 'light', label: 'світла', title: 'Світла тема' },
  { key: 'dark', label: 'темна', title: 'Темна тема' },
]

const ACCENTS = [
  { key: 'green', title: 'Зелений' },
  { key: 'blue', title: 'Синій' },
  { key: 'teal', title: 'Бірюзовий' },
  { key: 'violet', title: 'Фіолетовий' },
  { key: 'slate', title: 'Графіт' },
]

const KEY = 'tramline_look'

const read = () => {
  try {
    const got = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      theme: THEMES.some((t) => t.key === got.theme) ? got.theme : 'auto',
      accent: ACCENTS.some((a) => a.key === got.accent) ? got.accent : 'green',
    }
  } catch {
    return { theme: 'auto', accent: 'green' }   // приватний режим
  }
}

export default function Appearance() {
  const [look, setLook] = useState(read)
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  // Меню закривається клацанням поза ним і клавішею Escape. Без цього воно
  // висить над сторінкою, поки не натиснеш кнопку вдруге, і на телефоні
  // перекриває саму відповідь.
  useEffect(() => {
    if (!open) return
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  // Тему тримає <html>, а не React: так її бачить і CSS, і смуга браузера.
  useEffect(() => {
    const root = document.documentElement
    if (look.theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', look.theme)
    root.setAttribute('data-accent', look.accent)
    try { localStorage.setItem(KEY, JSON.stringify(look)) } catch { /* приватний режим */ }

    // Колір смуги браузера на телефоні — під колір тла, інакше над сторінкою
    // висить шматок чужої теми.
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
      if (bg) meta.setAttribute('content', bg)
    }
  }, [look])

  const current = ACCENTS.find((a) => a.key === look.accent)

  return (
    <div className="look" ref={box}>
      <button
        type="button"
        className="look-open"
        aria-expanded={open}
        title="Тема й колір"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="look-dot" aria-hidden="true" />
        <span className="look-open-t">вигляд</span>
      </button>

      {open && (
        <div className="look-pop" role="group" aria-label="Тема й колір">
          <div className="look-row">
            <span className="look-k">тема</span>
            <div className="look-seg">
              {THEMES.map((t) => (
                <button
                  key={t.key} type="button" title={t.title}
                  className={`look-seg-b${look.theme === t.key ? ' is-on' : ''}`}
                  aria-pressed={look.theme === t.key}
                  onClick={() => setLook((s) => ({ ...s, theme: t.key }))}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="look-row">
            <span className="look-k">колір</span>
            {/* Назва поточного кольору словом: самого кружечка мало, коли
                кольори близькі або людина їх розрізняє не так, як ми. */}
            <span className="look-now">{current?.title}</span>
          </div>

          <div className="look-dots">
            {ACCENTS.map((a) => (
              <button
                key={a.key} type="button" title={a.title}
                data-accent={a.key}
                className={`look-swatch${look.accent === a.key ? ' is-on' : ''}`}
                aria-pressed={look.accent === a.key}
                aria-label={a.title}
                onClick={() => setLook((s) => ({ ...s, accent: a.key }))}
              >
                {look.accent === a.key && (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-6" fill="none" stroke="currentColor"
                      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <p className="look-note">
            Колір сліду колеса й кольори машин не міняються: на схемах вони
            означають, де що лежить.
          </p>
        </div>
      )}
    </div>
  )
}
