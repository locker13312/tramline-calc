import { useEffect, useRef, useState } from 'react'
import { SITE } from '../lib/site'
import { THEMES, nextTheme } from '../lib/look'
import {
  TramlineIcon, FieldIcon, MachineIcon, MoneyIcon, BookIcon, SavedIcon,
  MoonIcon, SunIcon,
} from './icons'

// Вітрина: те, що бачить людина, яка прийшла за посиланням і ще не знає, що
// це за програма. Весь текст — у lib/site.js, тут лише те, як він показаний.
//
// Чому вітрина взагалі потрібна при тому, що розрахунок працює без входу:
// посилання з месенджера й пошуку приводять людину, якій спершу треба
// відповісти «що це і чи воно про моє поле». Калькулятор на це не
// відповідає — він показує поля введення. Але й тримати вітрину замість
// програми не можна: хто вже нею користувався, той відкриває її, щоб
// порахувати, а не читати. Тому вітрина — перший екран лише на першому
// заході (див. App.jsx), і далі доступна пунктом у меню.

const ICONS = {
  verdict: TramlineIcon,
  pass: FieldIcon,
  park: MachineIcon,
  money: MoneyIcon,
  rhythm: BookIcon,
  saved: SavedIcon,
}

// Поява при прокручуванні. Спостерігач, а не подія скролу: він не будить
// сторінку на кожен піксель.
//
// Без IntersectionObserver — на сервері при перевірці рендером і в старому
// браузері — вміст просто одразу видимий. Анімація тут окраса, і сторінка,
// яка без неї лишилася б порожньою, не варта жодної окраси.
function Reveal({ children, delay = 0, side = false, className = '' }) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (seen || !ref.current) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect() }
    }, { rootMargin: '-40px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [seen])

  const kind = side ? 'lp-rise-side' : 'lp-rise'
  return (
    <div ref={ref} className={`${kind}${seen ? ' is-in' : ''} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  )
}

// Число, що набігає, коли до нього доходить прокручування. Дроби лишаються
// дробами: «0,3 мс» після округлення до цілого стало б нулем.
function CountUp({ end, suffix = '' }) {
  const ref = useRef(null)
  const still = typeof IntersectionObserver === 'undefined'
  const [n, setN] = useState(still ? end : 0)

  useEffect(() => {
    if (still || !ref.current) return
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      const started = performance.now()
      const step = () => {
        // Швидко спочатку, повільно в кінці: так читається останнє число, а
        // не мерехтіння.
        const p = Math.min(1, (performance.now() - started) / 900)
        setN(end * (1 - (1 - p) ** 3))
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, { rootMargin: '-40px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [end, still])

  const whole = Number.isInteger(end)
  const shown = whole
    ? Math.round(n).toLocaleString('uk-UA')
    : n.toFixed(1).replace('.', ',')
  return <span ref={ref}>{shown}{suffix}</span>
}

// Макет програми: те саме, що вона й показує, — присуд рядком, поле в
// розрізі й колія, що розриває сходи. Вигадана картинка інтерфейсу тут була
// б обіцянкою, якої програма не дає.
function Mockup() {
  const rows = 21
  // Де проходить колесо: дві смуги замість сходів, як у знаку й на схемі.
  const track = new Set([6, 14])
  return (
    <div className="lp-mock">
      <div className="lp-mock-bar">
        <i /><i /><i />
        <span>колія · прохід 2 з 3</span>
      </div>
      <div className="lp-mock-body">
        <div className="lp-mock-verdict">
          <span className="lp-mock-kicker">присуд</span>
          <strong>На 2-му проході з 3 вимкнути сошники 5 і 8</strong>
        </div>
        <div className="lp-mock-field" aria-hidden="true">
          {Array.from({ length: rows }, (_, i) => (
            <i key={i} className={`lp-mock-row${track.has(i) ? ' is-track' : ''}`}
              style={{ animationDelay: `${i * 34}ms` }} />
          ))}
        </div>
        <div className="lp-mock-figs">
          {[['ритм', '1 з 3'], ['крок колій', '18 м'], ['втрата', '1,7 %']].map(([k, v]) => (
            <div className="lp-mock-fig" key={k}>
              <span className="lp-mock-fig-k">{k}</span>
              <span className="lp-mock-fig-v">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Заголовок розділу з номером: дрібний рядок, який показує, де ти на
// сторінці, коли вона довга.
function Eyebrow({ num, children, center = false }) {
  return (
    <span className={`lp-eyebrow${center ? ' is-mid' : ''}`}>
      <span className="lp-eyebrow-n">{num}</span>
      {children}
    </span>
  )
}

export default function Landing({ mark, onOpen, onAuth, user, onAccount, look, setLook }) {
  const [open, setOpen] = useState(0)

  const to = (id) => {
    const el = typeof document === 'undefined' ? null : document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Тема перемикається тут же: вітрину читають і в кабіні ввечері, і за
  // столом. Колір у системі один, тож вибирати тут нічого більше.
  const theme = look?.theme ?? 'light'
  const ThemeIcon = theme === 'dark' ? MoonIcon : SunIcon

  return (
    <div className="lp">
      <header className="lp-nav">
        <button type="button" className="lp-logo" onClick={() => to('lp-top')}>
          {mark}
          <span className="lp-logo-t">
            <b>Колія</b>
            <i>{SITE.hero.badge}</i>
          </span>
        </button>

        <nav className="lp-links">
          <button type="button" onClick={() => to('lp-what')}>Що робить</button>
          <button type="button" onClick={() => to('lp-steps')}>Як почати</button>
          <button type="button" onClick={() => to('lp-faq')}>Питання</button>
        </nav>

        <div className="lp-nav-acts">
          {setLook && (
            <button type="button" className="btn btn-quiet btn-sm lp-theme"
              title={`Тема: ${THEMES.find((t) => t.key === theme)?.title}. Натисніть, щоб перемкнути`}
              onClick={() => setLook((s) => ({ ...s, theme: nextTheme(s.theme) }))}>
              <ThemeIcon className="btn-i" />
            </button>
          )}
          {user
            ? (
              <button type="button" className="btn btn-sm" onClick={onAccount}>
                {user.name || user.email}
              </button>
            )
            : (
              <button type="button" className="btn btn-quiet btn-sm lp-wide-only" onClick={onAuth}>
                Увійти
              </button>
            )}
          <button type="button" className="btn btn-sm" onClick={onOpen}>Розрахунок</button>
        </div>
      </header>

      {/* ── Перший екран ───────────────────────────────── */}
      <section className="lp-sec lp-hero" id="lp-top">
        <div className="lp-in lp-hero-grid">
          <div>
            <Reveal><span className="lp-badge">{SITE.hero.badge}</span></Reveal>
            <Reveal delay={0.06}><h1 className="lp-h1">{SITE.hero.title}</h1></Reveal>
            <Reveal delay={0.12}><p className="lp-lead">{SITE.hero.subtitle}</p></Reveal>
            <Reveal delay={0.18}>
              <div className="lp-acts">
                <button type="button" className="btn lp-cta" onClick={onOpen}>
                  {SITE.hero.primary}
                </button>
                <button type="button" className="btn btn-quiet lp-cta" onClick={() => to('lp-steps')}>
                  {SITE.hero.secondary}
                </button>
              </div>
              <p className="lp-note">{SITE.hero.note}</p>
              <ul className="lp-chips">
                {SITE.hero.chips.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </Reveal>
          </div>

          <Reveal side delay={0.15} className="lp-mock-wrap">
            <Mockup />
            <div className="lp-float">
              <span className="lp-float-i"><TramlineIcon width="16" height="16" /></span>
              <span className="lp-float-t">
                <i>{SITE.hero.float.label}</i>
                <b>{SITE.hero.float.value}</b>
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Числа ──────────────────────────────────────── */}
      <section className="lp-sec lp-tight">
        <Reveal className="lp-in">
          <div className="lp-facts">
            {SITE.facts.map((f) => (
              <div className="lp-fact" key={f.label}>
                <span className="lp-fact-v"><CountUp end={f.value} suffix={f.suffix} /></span>
                <span className="lp-fact-k">{f.label}</span>
              </div>
            ))}
          </div>
          <p className="lp-facts-note">
            Числа з перевірок, а не з рекламного буклета: кожне перераховується
            командою <code>npm test</code>.
          </p>
        </Reveal>
      </section>

      {/* ── Можливості ─────────────────────────────────── */}
      <section className="lp-sec" id="lp-what">
        <div className="lp-in">
          <Reveal>
            <Eyebrow num="01">можливості</Eyebrow>
            <h2 className="lp-h2">{SITE.featuresTitle}</h2>
            <p className="lp-sub">{SITE.featuresSub}</p>
          </Reveal>
          <div className="lp-grid">
            {SITE.features.map((f, i) => {
              const Icon = ICONS[f.mark] ?? TramlineIcon
              return (
                <Reveal key={f.title} delay={0.05 * i}>
                  <article className="lp-card">
                    <span className="lp-card-i"><Icon width="19" height="19" /></span>
                    <h3 className="lp-card-h">{f.title}</h3>
                    <p className="lp-card-t">{f.text}</p>
                  </article>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Кроки ──────────────────────────────────────── */}
      <section className="lp-sec" id="lp-steps">
        <div className="lp-in">
          <Reveal>
            <Eyebrow num="02">як почати</Eyebrow>
            <h2 className="lp-h2">{SITE.stepsTitle}</h2>
          </Reveal>
          <div className="lp-steps">
            {SITE.steps.map((s, i) => (
              <Reveal key={s.title} delay={0.07 * i}>
                <div className="lp-step">
                  <span className="lp-step-n">{i + 1}</span>
                  <h3 className="lp-card-h">{s.title}</h3>
                  <p className="lp-card-t">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Що з цього виходить ────────────────────────── */}
      <section className="lp-sec">
        <div className="lp-in lp-split">
          <Reveal>
            <Eyebrow num="03">результат</Eyebrow>
            <h2 className="lp-h2">{SITE.getTitle}</h2>
            <p className="lp-sub">
              Колія не «оптимізує процеси». Вона відповідає на одне питання і
              показує, чим за відповідь платять.
            </p>
          </Reveal>
          <Reveal side delay={0.1}>
            <ul className="lp-list">
              {SITE.get.map((g) => <li key={g}>{g}</li>)}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Питання ────────────────────────────────────── */}
      <section className="lp-sec" id="lp-faq">
        <div className="lp-in">
          <Reveal>
            <Eyebrow num="04">питання</Eyebrow>
            <h2 className="lp-h2">{SITE.faqTitle}</h2>
          </Reveal>
          <div className="lp-faq">
            {SITE.faq.map((f, i) => (
              <Reveal key={f.q} delay={0.04 * i}>
                <div className={`lp-q${open === i ? ' is-open' : ''}`}>
                  <button type="button" className="lp-q-head"
                    aria-expanded={open === i}
                    onClick={() => setOpen(open === i ? -1 : i)}>
                    <span>{f.q}</span>
                    <i aria-hidden="true">{open === i ? '−' : '+'}</i>
                  </button>
                  {open === i && <p className="lp-q-body">{f.a}</p>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Останнє слово ──────────────────────────────── */}
      <section className="lp-sec">
        <Reveal className="lp-in">
          <div className="lp-end">
            <h2 className="lp-h2">{SITE.cta.title}</h2>
            <p className="lp-sub">{SITE.cta.subtitle}</p>
            <div className="lp-acts lp-acts-mid">
              <button type="button" className="btn lp-cta" onClick={onOpen}>
                {SITE.cta.primary}
              </button>
              {!user && (
                <button type="button" className="btn btn-quiet lp-cta" onClick={onAuth}>
                  {SITE.cta.secondary}
                </button>
              )}
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="lp-foot">
        <div className="lp-in">
          <div className="lp-foot-row">
            <span className="lp-logo-t">
              <b>Колія</b>
              <i>розрахунок технологічної колії</i>
            </span>
            <button type="button" className="mlink" onClick={onOpen}>
              Відкрити розрахунок
            </button>
          </div>
          <p className="lp-foot-note">{SITE.foot}</p>
        </div>
      </footer>
    </div>
  )
}
