import { useEffect, useState } from 'react'
import { DEFAULTS } from './lib/presets'
import { drillGeometry } from './lib/tramline'
import { api, token } from './lib/api'
import Calculator from './components/Calculator'
import AuthPanel from './components/AuthPanel'
import Saved from './components/Saved'
import RhythmTable from './components/RhythmTable'
import Appearance from './components/Appearance'

const STORE = 'tramline_input'

function Mark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1d2416" />
      <g fill="#8ec463">
        <rect x="3" y="6" width="3" height="20" rx="1.5" />
        <rect x="9" y="6" width="3" height="20" rx="1.5" />
        <rect x="20" y="6" width="3" height="20" rx="1.5" />
        <rect x="26" y="6" width="3" height="20" rx="1.5" />
      </g>
      <rect x="14.5" y="4" width="3" height="24" rx="1.5" fill="#c4593f" />
    </svg>
  )
}

// Вхід у систему: сівалка кладе проходи, і між ними лишається розрив — та
// сама колія, про яку вся програма. Три чверті секунди, один раз на відкриття.
// Довше — це вже не привітання, а затримка.
function Intro() {
  const rows = 17
  // Де проходить колесо: дві смуги замість сходів, симетрично до центра.
  const track = new Set([5, 11])
  return (
    <div className="intro" aria-hidden="true">
      <div className="intro-field">
        {Array.from({ length: rows }, (_, i) => (
          <i
            key={i}
            className={`intro-row${track.has(i) ? ' is-track' : ''}`}
            style={{ animationDelay: `${i * 28}ms` }}
          />
        ))}
      </div>
      <div className="intro-name">Колія</div>
      <div className="intro-sub">рахуємо, що глушити</div>
    </div>
  )
}

const TABS = [
  { key: 'calc', label: 'Розрахунок' },
  { key: 'fields', label: 'Мої поля', needsAuth: true },
  { key: 'machines', label: 'Техніка', needsAuth: true },
  { key: 'rhythms', label: 'Довідник' },
]

export default function App() {
  const [input, setInput] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || '{}') } }
    catch { return DEFAULTS }
  })
  const [tab, setTab] = useState('calc')
  const [user, setUser] = useState(null)
  // Анімацію показуємо лише коли сторінку справді відкрили, а не на кожному
  // перемалюванні; знімаємо її з DOM, щоб вона не перехоплювала натискання.
  const [intro, setIntro] = useState(true)
  // Поки токен не перевірено, не показуємо ні «Увійти», ні пошту: інакше
  // на кожному відкритті блимає стан «вийшов», хоча людина не виходила.
  const [checked, setChecked] = useState(false)

  // Розрахунок лишається в браузері навіть без акаунта — калькулятор має
  // працювати одразу, а не після реєстрації.
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(input)) } catch { /* приватний режим */ }
  }, [input])

  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 1300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!token.get()) { setChecked(true); return }
    api.me()
      .then((d) => setUser(d.user))
      .catch(() => token.set(null))
      .finally(() => setChecked(true))
  }, [])

  const auth = async (mode, body) => {
    const d = mode === 'register' ? await api.register(body) : await api.login(body)
    token.set(d.token)
    setUser(d.user)
  }

  const logout = () => { token.set(null); setUser(null); setTab('calc') }

  // Підставити збережене поле чи комплект — і одразу показати результат.
  const load = (patch) => {
    setInput((s) => ({ ...s, ...patch }))
    setTab('calc')
  }

  // Довідник порівнює захвати, тож йому потрібен справжній захват сівалки —
  // а він не завжди «секції × міжряддя»: розкладка сошників буває довільною.
  const drill = drillGeometry(input).width
  const lead = (input.machines ?? []).find((m) => m.active !== false)
  const leadWidth = lead?.width ?? input.sprayerWidth

  return (
    <div className="app">
      {intro && <Intro />}
      <header className="top">
        <Mark />
        <div className="top-name">
          <div className="brand">Колія</div>
          <div className="brand-sub">які сошники глушити, щоб потім було де їздити</div>
        </div>
        <div className="top-auth">
          <Appearance />
          {checked && (user ? (
            <>
              <span className="who" title={user.email}>{user.name || user.email}</span>
              <button className="btn btn-sm btn-quiet" onClick={logout}>Вийти</button>
            </>
          ) : (
            <button className="btn btn-sm" onClick={() => setTab('fields')}>Увійти</button>
          ))}
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`tab${tab === t.key ? ' is-on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'calc' && <Calculator input={input} setInput={setInput} />}

      {(tab === 'fields' || tab === 'machines') && (
        user
          ? <Saved kind={tab} input={input} onLoad={load} />
          : (
            <div className="narrow">
              <AuthPanel
                onAuth={auth}
                title="акаунт"
                lead={
                  'Розрахунок працює й без входу. Акаунт потрібен лише щоб зберегти ' +
                  'поля й комплекти техніки та відкрити їх з іншого пристрою — ' +
                  'у полі з телефона, за столом з компʼютера.'
                }
              />
            </div>
          )
      )}

      {tab === 'rhythms' && (
        <RhythmTable drillWidth={drill} sprayerWidth={leadWidth} />
      )}

      <footer className="foot">
        Усі машини заходять у поле з одного краю; сошники рахуються зліва
        направо за напрямком руху. Розрахунок одновимірний — рельєф, клини й
        нерівні межі поля він не враховує.
      </footer>
    </div>
  )
}
