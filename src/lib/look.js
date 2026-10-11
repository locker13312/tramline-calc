import { useEffect, useState } from 'react'

// ── Тема й колір ──────────────────────────────────────────────────────────
//
// Вибір тут не косметичний. Програму відкривають і за столом при вікні, і в
// кабіні ввечері, і це різні вимоги до тла: те, що читається на папері,
// сліпить у темряві, і навпаки. «Авто» бере системну тему й цього більшості
// досить — але якщо телефон цілий день у світлій темі, а комбайн працює до
// ночі, вибір мусить бути під рукою.
//
// Стан живе тут, а не в кнопці, бо кнопок дві: швидкий перемикач теми на
// рейці й повні налаштування в меню. Два власники одного стану розходяться
// на першому ж натисканні — у меню одна тема, на рейці інша.

export const THEMES = [
  { key: 'auto', label: 'авто', title: 'Як у системі' },
  { key: 'light', label: 'світла', title: 'Світла тема' },
  { key: 'dark', label: 'темна', title: 'Темна тема' },
]

// Колір акценту — не примха. За замовчуванням він індиго: зелений означав
// сходи, але поруч із рудим слідом колеса й на зеленавих схемах губився, а
// половина інтерфейсу виходила однією зеленою плямою. Зелений лишився у
// виборі — у господарстві може бути свій колір. Кольори машин і колір сліду
// колеса від акценту не залежать: вони щось означають на схемах, і міняти їх
// під смак не можна.
export const ACCENTS = [
  { key: 'indigo', title: 'Індиго' },
  { key: 'blue', title: 'Синій' },
  { key: 'teal', title: 'Бірюзовий' },
  { key: 'violet', title: 'Фіолетовий' },
  { key: 'green', title: 'Зелений' },
  { key: 'slate', title: 'Графіт' },
]

const KEY = 'tramline_look'

const read = () => {
  try {
    const got = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      theme: THEMES.some((t) => t.key === got.theme) ? got.theme : 'auto',
      accent: ACCENTS.some((a) => a.key === got.accent) ? got.accent : 'indigo',
    }
  } catch {
    return { theme: 'auto', accent: 'indigo' }   // приватний режим
  }
}

export function useLook() {
  const [look, setLook] = useState(read)

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

  return [look, setLook]
}

// Наступна тема по колу: авто → світла → темна → авто. Швидкий перемикач на
// рейці саме для цього й стоїть — одне натискання замість меню.
export const nextTheme = (theme) => {
  const i = THEMES.findIndex((t) => t.key === theme)
  return THEMES[(i + 1) % THEMES.length].key
}
