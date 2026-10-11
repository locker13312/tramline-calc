import { useEffect, useState } from 'react'
import { CROPS, DEFAULTS } from './lib/presets'
import { defaultMachines, normaliseMachines } from './lib/machines'
import { drillGeometry, resolveMargin, AUTO_MARGIN } from './lib/tramline'
import { api, token } from './lib/api'
import { num } from './lib/format'
import Calculator from './components/Calculator'
import AuthPanel from './components/AuthPanel'
import Saved from './components/Saved'
import RhythmTable from './components/RhythmTable'
import Sidebar from './components/Sidebar'
import { useLook } from './lib/look'

const STORE = 'tramline_input'

// Знак програми — те, що вона рахує, а не абстракція: сходи рядками, а
// посередині колія. Колія тут не одна смуга, а розрив у сходах, у якому
// лежать два сліди коліс, — бо саме так вона й виглядає на полі, і саме
// пару смуг, а не лінію, програма й розставляє.
function Mark({ size = 38 }) {
  const rows = [2.5, 7, 11.5, 26.5, 31, 35.5]
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" aria-hidden="true"
      className="mark" role="img">
      <rect width="38" height="38" rx="9" fill="var(--mark-bg)" />
      {/* Сходи: рядки по всьому проходу, однакові й щільні. */}
      <g fill="var(--mark-row)">
        {rows.map((x) => <rect key={x} x={x} y="6" width="2.4" height="26" rx="1.2" />)}
      </g>
      {/* Колія: порожня смуга між сходами, у ній два сліди коліс. */}
      <g fill="var(--mark-track)">
        <rect x="16.4" y="4" width="2" height="30" rx="1" />
        <rect x="21.4" y="4" width="2" height="30" rx="1" />
      </g>
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

// startTab — з якої вкладки відкритися. Потрібне перевірці рендером: вона
// малює оболонку з кожною вкладкою, щоб жодна не ламалася непоміченою.
export default function App({ startTab = 'calc' }) {
  const [input, setInput] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || '{}') } }
    catch { return DEFAULTS }
  })
  const [tab, setTab] = useState(startTab)
  const [user, setUser] = useState(null)
  // Анімацію показуємо лише коли сторінку справді відкрили, а не на кожному
  // перемалюванні; знімаємо її з DOM, щоб вона не перехоплювала натискання.
  const [intro, setIntro] = useState(true)
  // Поки токен не перевірено, не показуємо ні «Увійти», ні пошту: інакше
  // на кожному відкритті блимає стан «вийшов», хоча людина не виходила.
  const [checked, setChecked] = useState(false)
  // Сайдбар на телефоні згорнутий: там він стоїть над відповіддю, і
  // розгорнутий з'їдав би весь перший екран.
  const [menu, setMenu] = useState(false)
  const [look, setLook] = useLook()
  // Розділ налаштувань живе тут, а не в калькуляторі: перемикають його
  // пункти сайдбара, а сайдбар той самий на всіх вкладках.
  const [section, setSection] = useState('drill')

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

  // Скільки машин справді в колії — число для пункту «Машини». Рахується
  // нормалізацією списку, без геометрії: це дешево й не залежить від того,
  // чи складається колія взагалі.
  const machineCount = normaliseMachines({
    ...input, machines: input.machines ?? defaultMachines(),
  }).filter((m) => m.active).length

  // Що зараз задано — чотирма рядками в сайдбарі. Рахується з самих полів
  // форми, без геометрії: це має показуватись навіть тоді, коли колія не
  // складається, бо саме тоді й дивляться, що введено не так.
  const margin = resolveMargin(input)
  const crop = CROPS.find((c) => c.key === input.crop)
  const now = [
    {
      key: 'drill',
      label: crop ? crop.label : 'сівалка',
      value: drill > 0
        ? `${num(drill)} м · ${input.coulters?.length >= 2 ? 'своя розкладка' : `${num(input.rows, 0)} × ${num(input.rowSpacing)} м`}`
        : 'не задана',
    },
    {
      key: 'drill',
      label: 'запас',
      value: `${num(margin)} м ${margin === AUTO_MARGIN && !input.marginManual ? '· система' : '· свій'}`,
    },
    {
      key: 'machines',
      label: 'машин у колії',
      value: machineCount
        ? `${machineCount} · крок ${leadWidth > 0 ? `${num(leadWidth)} м` : '—'}`
        : 'жодної',
    },
    {
      key: 'field',
      label: 'поле',
      value: input.fieldWidth > 0 && input.fieldLength > 0
        ? `${num(input.fieldWidth, 0)} × ${num(input.fieldLength, 0)} м · ${num((input.fieldWidth * input.fieldLength) / 10000, 1)} га`
        : 'не задане',
    },
  ]

  return (
    <div className={`app${menu ? ' is-menu' : ''}`}>
      {intro && <Intro />}

      <div className="shell">
        <Sidebar
          mark={<Mark />}
          tab={tab} setTab={setTab}
          section={section} setSection={setSection}
          machineCount={machineCount} now={now}
          user={user} checked={checked}
          onAccount={() => { setTab('fields'); setMenu(false) }}
          onLogout={logout}
          look={look} setLook={setLook}
          menu={menu} setMenu={setMenu}
        />

        {tab === 'calc' ? (
          <Calculator
            input={input} setInput={setInput}
            section={section} setSection={setSection}
          />
        ) : (
          <>
            <main className="main">
              {(tab === 'fields' || tab === 'machines') && (
                user
                  ? <Saved kind={tab} input={input} onLoad={load} />
                  : (
                    <div className="narrow">
                      <AuthPanel
                        onAuth={auth}
                        title={tab === 'fields' ? 'мої поля — потрібен акаунт' : 'техніка — потрібен акаунт'}
                        lead={
                          `Щоб зберігати ${tab === 'fields' ? 'поля' : 'комплекти техніки'}, ` +
                          'увійдіть або створіть акаунт — інакше їх немає де тримати. ' +
                          'Сам розрахунок працює й без входу: людина в полі має отримати ' +
                          'число, а не форму реєстрації.'
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
            </main>
          </>
        )}
      </div>
    </div>
  )
}
