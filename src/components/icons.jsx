// ── Значки ────────────────────────────────────────────────────────────────
//
// Усі одного штибу: лінія 1,8 в сітці 24×24, круглі кінці, без заливки.
// Намальовані, а не взяті шрифтом, з однієї причини: шрифт значків важить
// більше за всю сторінку й тягнеться мережею, а тут їх шість.
//
// Колір скрізь currentColor — значок приймає колір кнопки, у якій стоїть, і
// сам по собі нічого не означає.

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
}

export function PersonIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8.6" r="3.4" />
      <path d="M5.5 19.4c.6-3.4 3.3-5.2 6.5-5.2s5.9 1.8 6.5 5.2" />
    </svg>
  )
}

// Місяць — темна тема. Класичний серп, а не коло з півзаливкою: у рядку
// кнопок він читається з першого погляду й не плутається з діаграмою.
export function MoonIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 14.3A8.4 8.4 0 0 1 9.7 4a8.4 8.4 0 1 0 10.3 10.3z" />
    </svg>
  )
}

export function SunIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4.1" />
      <path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5" />
    </svg>
  )
}

// Тема «як у системі» — монітор: він і означає «бере з пристрою». Півмісяць
// на тлі сонця в такому розмірі перетворюється на пляму.
export function AutoThemeIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16.5V20" />
    </svg>
  )
}

export function ExitIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M14.5 4.5h-7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7" />
      <path d="M11.8 12h8.4M17.4 8.8l3.2 3.2-3.2 3.2" />
    </svg>
  )
}

// ── Пункти меню ───────────────────────────────────────────────────────────
//
// Кожен значок — про те, що в розділі, а не про абстракцію: сівалка це
// рядки сошників, поле це межа з обсівом, гроші це монета.

// Розрахунок: той самий візерунок, що й у знаку програми, — рядки з
// розривом посередині.
export function TramlineIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4.5v15M8 4.5v15M16 4.5v15M20 4.5v15" />
      <path d="M11 3.5v17M13 3.5v17" strokeDasharray="2.6 2.4" />
    </svg>
  )
}

// Сівалка: рама з сошниками під нею.
export function DrillIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 8.5h17" />
      <path d="M6 8.5v5M10 8.5v5M14 8.5v5M18 8.5v5" />
      <path d="M4.5 18.5h15" strokeDasharray="2 2.6" />
    </svg>
  )
}

// Машина: колеса й кузов — найкоротший спосіб сказати «техніка».
export function MachineIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 14.5V9a1.5 1.5 0 0 1 1.5-1.5H12v7" />
      <path d="M12 10.5h3.6l2.9 3.1v.9" />
      <circle cx="7.5" cy="16.5" r="2.2" />
      <circle cx="16.5" cy="16.5" r="2.2" />
      <path d="M9.7 16.5h4.6M18.7 16.5H21v-2" />
    </svg>
  )
}

// Поле: межа з обсівом по периметру.
export function FieldIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.2" y="4.8" width="17.6" height="14.4" rx="2" />
      <rect x="6.6" y="8" width="10.8" height="8" rx="1" strokeDasharray="2.4 2.2" />
    </svg>
  )
}

export function MoneyIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M9.4 9.6c0-1.5 1.2-2.4 2.7-2.4 1.4 0 2.4.7 2.6 1.8M9.4 9.6c0 2.7 5.2 2.1 5.2 4.9 0 1.4-1.2 2.3-2.6 2.3-1.5 0-2.7-.8-2.8-2.1M12 5.8v12.4" />
    </svg>
  )
}

// Збережене поле — закладка на карті.
export function SavedIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4.6 3.8 6.8v12.6L9 17.2l6 2.2 5.2-2.2V4.6L15 6.8z" />
      <path d="M9 4.6v12.6M15 6.8v12.6" />
    </svg>
  )
}

export function BookIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 5.2A1.7 1.7 0 0 1 6.2 3.5H19v15H6.2a1.7 1.7 0 0 0-1.7 1.7z" />
      <path d="M4.5 18.5a1.7 1.7 0 0 1 1.7-1.7H19M8.5 7.5h6.5M8.5 11h4.5" />
    </svg>
  )
}

// Повзунки — налаштування самої системи.
export function SlidersIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7.5h8M17 7.5h3M4 16.5h3M12 16.5h8" />
      <circle cx="14.5" cy="7.5" r="2.3" />
      <circle cx="9.5" cy="16.5" r="2.3" />
    </svg>
  )
}
