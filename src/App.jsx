import { useEffect, useState } from 'react'
import { DEFAULTS } from './lib/presets'
import { api, token } from './lib/api'
import Calculator from './components/Calculator'
import AuthPanel from './components/AuthPanel'
import Saved from './components/Saved'
import RhythmTable from './components/RhythmTable'

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
  // Поки токен не перевірено, не показуємо ні «Увійти», ні пошту: інакше
  // на кожному відкритті блимає стан «вийшов», хоча людина не виходила.
  const [checked, setChecked] = useState(false)

  // Розрахунок лишається в браузері навіть без акаунта — калькулятор має
  // працювати одразу, а не після реєстрації.
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(input)) } catch { /* приватний режим */ }
  }, [input])

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

  const drill = input.rows * input.rowSpacing

  return (
    <div className="app">
      <header className="top">
        <Mark />
        <div className="top-name">
          <div className="brand">Колія</div>
          <div className="brand-sub">що глушити на сівалці, щоб потім було де їздити</div>
        </div>
        {checked && (
          <div className="top-auth">
            {user ? (
              <>
                <span className="who" title={user.email}>{user.name || user.email}</span>
                <button className="btn btn-sm btn-quiet" onClick={logout}>Вийти</button>
              </>
            ) : (
              <button className="btn btn-sm" onClick={() => setTab('fields')}>Увійти</button>
            )}
          </div>
        )}
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
        <RhythmTable drillWidth={drill} sprayerWidth={input.sprayerWidth} />
      )}

      <footer className="foot">
        Сівалка й обприскувач заходять у поле з одного краю; секції рахуються
        зліва направо за напрямком руху. Рельєф, клини й нерівні межі поля
        розрахунок не враховує.
      </footer>
    </div>
  )
}
