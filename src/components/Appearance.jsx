import { useEffect, useRef, useState } from 'react'
import { THEMES, ACCENTS } from '../lib/look'
import { SlidersIcon } from './icons'

// ── Налаштування системи: тема й колір ────────────────────────────────────
//
// Стан тут не живе — він у App (lib/look.js), бо той самий вибір міняють і
// швидким перемикачем на рейці. Тут лише саме меню.
export default function Appearance({ look, setLook }) {
  const [open, setOpen] = useState(false)
  // Меню стоїть не в потоці сайдбара, а поверх сторінки, і координати в
  // нього власні. Інакше його не видно зовсім: сайдбар гортається, а все,
  // що виходить за його межі, прокрутка обрізає — кнопка натискалась, меню
  // малювалось, і одразу зникало під краєм колонки.
  const [at, setAt] = useState(null)
  const box = useRef(null)
  const btn = useRef(null)

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

  // Меню тримається кнопки: праворуч від неї, а якщо праворуч не влазить —
  // під нею. Міряємо на відкриття й на зміну розміру вікна.
  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = btn.current?.getBoundingClientRect()
      if (!r) return
      const W = 260
      const right = r.right + 8
      const fits = right + W <= window.innerWidth - 8
      setAt({
        left: fits ? right : Math.max(8, Math.min(r.left, window.innerWidth - W - 8)),
        top: fits
          ? Math.max(8, Math.min(r.top - 6, window.innerHeight - 300))
          : r.bottom + 8,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  const current = ACCENTS.find((a) => a.key === look.accent)

  return (
    <div className="look" ref={box}>
      <button
        ref={btn}
        type="button"
        className={`side-b${open ? ' is-on' : ''}`}
        aria-expanded={open}
        title="Тема й колір системи"
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersIcon className="side-i" />
        <span className="side-b-t">Вигляд</span>
      </button>

      {open && (
        <div className="look-pop" role="group" aria-label="Тема й колір"
          style={at ? { left: at.left, top: at.top } : undefined}>
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
            {/* Назва поточного кольору словом: самого кружечка мало, коли
                кольори близькі або людина їх розрізняє не так, як ми. */}
            <span className="look-k">колір</span>
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
