import { useEffect, useState } from 'react'
import { CROPS, DEFAULTS } from './lib/presets'
import { defaultMachines, normaliseMachines } from './lib/machines'
import { drillGeometry, resolveMargin, AUTO_MARGIN } from './lib/tramline'
import { api, token } from './lib/api'
import { num } from './lib/format'
import Calculator from './components/Calculator'
import AuthScreen from './components/AuthScreen'
import Landing from './components/Landing'
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

// startTab — з якої вкладки відкритися, startScreen — з якого екрана.
// Потрібні перевірці рендером: вона малює оболонку з кожною вкладкою й кожен
// екран окремо, щоб жоден не ламався непоміченим.
export default function App({ startTab = 'calc', startScreen }) {
  const [input, setInput] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || '{}') } }
    catch { return DEFAULTS }
  })
  const [tab, setTab] = useState(startTab)
  // Який екран зараз: вітрина, сама програма чи вхід. Три екрани, а не
  // адреси: розрахунок живе в одному стані, і перехід на вітрину й назад не
  // має його губити.
  //
  // Відкривається завжди вітрина. Усередину ведуть кнопки: «Відкрити
  // розрахунок» — гостем, без акаунта й без обіцянок зберегти, або вхід,
  // після якого людина потрапляє до своїх полів. Тобто першим екраном стоїть
  // те, що пояснює, а не форма введення, і вибір — заходити гостем чи зі
  // своїм — робить людина, а не памʼять браузера.
  const [screen, setScreen] = useState(startScreen ?? 'site')
  // Через що людину привели на вхід: «мої поля» і «техніка» просять акаунт з
  // різних причин, і мовчазна форма пошти на це не відповідає.
  const [why, setWhy] = useState(null)
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

  // Зайти в саму програму — кнопкою з вітрини або після входу.
  const enter = (t) => {
    if (t) setTab(t)
    setScreen('app')
  }

  // Вкладки, яким потрібен акаунт, ведуть на вхід. Показувати там порожній
  // список «моїх полів» означало б робити вигляд, що вони просто скінчились.
  const go = (t) => {
    if ((t === 'fields' || t === 'machines') && !user) {
      setWhy(t)
      setScreen('auth')
      return
    }
    setTab(t)
  }

  const auth = async (mode, body) => {
    const d = mode === 'register' ? await api.register(body) : await api.login(body)
    token.set(d.token)
    setUser(d.user)
    // Повертаємо туди, звідки прийшли по акаунт, а не на перший екран.
    enter(why ?? 'fields')
    setWhy(null)
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

  // Вітрина й вхід — екрани на всю сторінку, без сайдбара: на першому з них
  // немає чим керувати, а на другому керувати нічим не можна, доки не ввійшли.
  if (screen !== 'app') {
    return (
      <>
        {intro && <Intro />}
        {screen === 'site' ? (
          <Landing
            mark={<Mark size={34} />}
            onOpen={() => enter('calc')}
            onAuth={() => { setWhy(null); setScreen('auth') }}
            user={user}
            onAccount={() => enter('fields')}
            look={look} setLook={setLook}
          />
        ) : (
          <AuthScreen
            mark={<Mark size={34} />}
            onAuth={auth}
            onHome={() => setScreen('site')}
            onSkip={() => enter('calc')}
            initialMode={why ? 'register' : 'login'}
            lead={why && (
              `Щоб зберігати ${why === 'fields' ? 'поля' : 'комплекти техніки'}, `
              + 'потрібен акаунт — інакше їх немає де тримати. Сам розрахунок '
              + 'працює й без входу: людина в полі має отримати число, а не '
              + 'форму реєстрації.'
            )}
          />
        )}
      </>
    )
  }

  return (
    <div className={`app${menu ? ' is-menu' : ''}`}>
      {intro && <Intro />}

      <div className="shell">
        <Sidebar
          mark={<Mark />}
          tab={tab} setTab={go}
          onHome={() => setScreen('site')}
          section={section} setSection={setSection}
          machineCount={machineCount} now={now}
          user={user} checked={checked}
          onAccount={() => { go('fields'); setMenu(false) }}
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
                    // Сюди доходять лише відкривши вкладку напряму: з меню
                    // вона веде на вхід. Другої форми пошти тут немає —
                    // одна форма, один екран, і той самий текст у ньому.
                    <div className="narrow">
                      <div className="panel auth">
                        <h2>{tab === 'fields' ? 'мої поля — потрібен акаунт' : 'техніка — потрібен акаунт'}</h2>
                        <p className="auth-lead">
                          Щоб зберігати {tab === 'fields' ? 'поля' : 'комплекти техніки'},
                          потрібен акаунт — інакше їх немає де тримати. Сам розрахунок
                          працює й без входу.
                        </p>
                        <button type="button" className="btn"
                          onClick={() => { setWhy(tab); setScreen('auth') }}>
                          Увійти або створити акаунт
                        </button>
                      </div>
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
