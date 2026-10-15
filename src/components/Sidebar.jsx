import { THEMES, nextTheme } from '../lib/look'
import {
  TramlineIcon, DrillIcon, MachineIcon, FieldIcon, MoneyIcon,
  SavedIcon, BookIcon, PersonIcon, MoonIcon, SunIcon, ExitIcon,
  InfoIcon,
} from './icons'

// ── Сайдбар ───────────────────────────────────────────────────────────────
//
// Одна колонка ліворуч, і в ній усе, що не є відповіддю: знак програми,
// пункти меню групами, розділи налаштувань розрахунку, а в самому низу —
// акаунт із темою й виходом.
//
// Пункти однакові за будовою: значок, назва, іноді число праворуч. Значок
// тут не оздоба — у списку з дев'яти пунктів око чіпляється за нього
// швидше, ніж читає слово. Вибраний пункт позначений не лише кольором:
// заливка, лінійка збоку й жирніший текст, бо самого кольору мало.

const WORK = [
  { key: 'calc', label: 'Розрахунок', icon: TramlineIcon },
  { key: 'fields', label: 'Мої поля', icon: SavedIcon },
  { key: 'machines', label: 'Техніка', icon: MachineIcon },
  { key: 'ways', label: 'Способи', icon: BookIcon },
]

export const SECTIONS = [
  { key: 'drill', label: 'Сівалка', icon: DrillIcon },
  { key: 'machines', label: 'Машини', icon: MachineIcon },
  { key: 'field', label: 'Поле', icon: FieldIcon },
  { key: 'money', label: 'Гроші', icon: MoneyIcon },
]

const THEME_ICON = { dark: MoonIcon, light: SunIcon }
const THEME_WORD = { dark: 'Темна', light: 'Світла' }

function Item({ icon: Icon, label, on, badge, onClick, title }) {
  return (
    <button
      type="button"
      className={`side-b${on ? ' is-on' : ''}`}
      aria-current={on ? 'page' : undefined}
      onClick={onClick}
      title={title}
    >
      <Icon className="side-i" />
      <span className="side-b-t">{label}</span>
      {badge != null && <i className="side-n">{badge}</i>}
    </button>
  )
}

export default function Sidebar({
  mark, tab, setTab, section, setSection, machineCount, now,
  user, checked, onAccount, onLogout, onHome, look, setLook, menu, setMenu,
}) {
  const ThemeIcon = THEME_ICON[look.theme] ?? SunIcon
  const go = (key) => { setTab(key); setMenu(false) }

  return (
    <aside className="side">
      <div className="side-top">
        {mark}
        <div className="side-name">
          <div className="brand">Колія</div>
          <div className="brand-sub">розрахунок колії · v2</div>
        </div>
        {/* На телефоні сайдбар згортається: інакше меню й форма стоять над
            відповіддю й займають увесь перший екран. */}
        <button
          type="button" className="side-burger"
          aria-expanded={menu} onClick={() => setMenu((v) => !v)}
        >
          {menu ? 'згорнути' : 'меню'}
        </button>
      </div>

      <div className="side-body">
        <div className="side-group">
          <div className="side-h">робота</div>
          <nav className="side-nav">
            {WORK.map((t) => (
              <Item key={t.key} icon={t.icon} label={t.label}
                on={tab === t.key} onClick={() => go(t.key)} />
            ))}
          </nav>
        </div>

        {/* Розділи розрахунку — тільки на його вкладці: на «моїх полях» вони
            не ведуть нікуди, і показувати їх там означало б брехати. */}
        {tab === 'calc' && (
          <div className="side-group">
            <div className="side-h">що задаємо</div>
            <nav className="side-nav" role="tablist" aria-label="Розділи налаштувань">
              {SECTIONS.map((s) => (
                <Item
                  key={s.key} icon={s.icon} label={s.label}
                  on={section === s.key}
                  // Лічильник показує машини, які справді в колії, а не
                  // просто ввімкнені: незаповнена в розрахунок не йде, і
                  // видавати її за робочу не можна.
                  badge={s.key === 'machines' ? machineCount : null}
                  onClick={() => { setSection(s.key); setMenu(false) }}
                />
              ))}
            </nav>
          </div>
        )}

        <div className="side-group">
          <div className="side-h">сервіс</div>
          <nav className="side-nav">
            {/* Вітрина лишається під рукою: на ній пояснено, що програма
                рахує й чого не рахує, і саме туди відсилають того, хто
                питає «а це взагалі про моє поле?». */}
            {onHome && (
              <Item icon={InfoIcon} label="Про Колію"
                onClick={() => { onHome(); setMenu(false) }}
                title="Сторінка про програму: що рахує, як почати, часті питання" />
            )}
          </nav>
        </div>

        {/* Під меню лишалося порожнє поле на пів екрана. Тепер там стоїть
            те, з чим програма зараз рахує: сівалка, запас, парк, поле. Це
            відповідь на питання «а що в мене зараз задано», яке інакше
            вимагає обійти всі чотири розділи форми. Рядок веде у свій
            розділ — звідти його й міняють. */}
        {now && (
          <div className="side-now">
            <div className="side-h">зараз у розрахунку</div>
            {now.map((row) => (
              <button
                key={row.key} type="button" className="side-row"
                onClick={() => { setTab('calc'); setSection(row.key); setMenu(false) }}
                title={`Змінити: ${row.label}`}
              >
                <span className="side-row-k">{row.label}</span>
                <span className="side-row-v">{row.value}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Акаунт унизу: аватарка, імʼя, під ним пошта. Поки токен не
          перевірено, нічого не стверджуємо: інакше на кожному відкритті
          блимало б «увійти», хоча людина не виходила. */}
      <div className="side-foot">
        <button
          type="button" className="side-user"
          onClick={user ? undefined : onAccount}
          disabled={!!user}
          title={user ? (user.name || user.email) : 'Увійти або створити акаунт'}
        >
          <span className="ava" aria-hidden="true"><PersonIcon className="ava-i" /></span>
          <span className="side-who">
            <span className="side-user-n">
              {!checked ? 'Хвилинку…' : (user ? (user.name || user.email) : 'Гість')}
            </span>
            <span className="side-user-s">
              {user
                ? (user.name ? `${user.email} · мій акаунт` : 'мій акаунт')
                : 'без входу · натисніть, щоб увійти'}
            </span>
          </span>
        </button>

        <div className="side-acts">
          <button
            type="button" className="btn btn-sm btn-quiet"
            onClick={() => setLook((s) => ({ ...s, theme: nextTheme(s.theme) }))}
            title={`Тема: ${THEMES.find((t) => t.key === look.theme)?.title}. Натисніть, щоб перемкнути`}
          >
            <ThemeIcon className="btn-i" />
            {THEME_WORD[look.theme] ?? 'Світла'}
          </button>

          {user ? (
            <button type="button" className="btn btn-sm btn-quiet" onClick={onLogout}>
              <ExitIcon className="btn-i" />
              Вийти
            </button>
          ) : (
            <button type="button" className="btn btn-sm" onClick={onAccount}>
              Увійти
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
