import { useEffect, useState } from 'react'

// ── Тема ──────────────────────────────────────────────────────────────────
//
// Вибір тут не косметичний. Програму відкривають і за столом при вікні, і в
// кабіні ввечері, і це різні вимоги до тла: те, що читається на папері,
// сліпить у темряві, і навпаки.
//
// Тем рівно дві — світла й темна, і перемикач один. Третього пункту «як у
// системі» більше немає: він виглядав як вибір, але вибором не був, а
// натомість додавав стан, якого не видно, і в якому «темна» на світлому
// телефоні означала світлу. Системну тему програма бере як початкове
// значення на першому відкритті — далі вирішує людина.
//
// Кольору в налаштуваннях теж немає. Шість акцентів означали шість систем,
// кожну з яких треба тримати читабельною, і кольорову мішанину на екрані.
// Колір тепер один (index.css), і він лишився там, де щось означає: слід
// колеса, попередження, машини на схемах.

export const THEMES = [
  { key: 'light', label: 'світла', title: 'Світла тема' },
  { key: 'dark', label: 'темна', title: 'Темна тема' },
]

const KEY = 'tramline_look'

const systemDark = () => {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches }
  catch { return false }
}

const read = () => {
  try {
    const got = JSON.parse(localStorage.getItem(KEY) || '{}')
    if (THEMES.some((t) => t.key === got.theme)) return { theme: got.theme }
  } catch { /* приватний режим */ }
  // Нічого не вибирали — беремо тему пристрою, щоб перший екран не блимав.
  return { theme: systemDark() ? 'dark' : 'light' }
}

export function useLook() {
  const [look, setLook] = useState(read)

  // Тему тримає <html>, а не React: так її бачить і CSS, і смуга браузера.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', look.theme)
    try { localStorage.setItem(KEY, JSON.stringify(look)) } catch { /* приватний режим */ }

    // Колір смуги браузера на телефоні — під колір тла, інакше над сторінкою
    // висить шматок чужої теми.
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
      if (bg) meta.setAttribute('content', bg)
    }
  }, [look])

  return [look, setLook]
}

// Друга тема: перемикач один, і він перекидає світлу в темну й назад.
export const nextTheme = (theme) => (theme === 'dark' ? 'light' : 'dark')
