import { useEffect, useState } from 'react'

// ── Числове поле, у якому можна стерти все ────────────────────────────────
//
// `onChange={(e) => set(k, Number(e.target.value))}` виглядає нешкідливо, але
// `Number('')` — це нуль. Людина стирала «600», у полі лишався «0», вона
// набирала «12» — і виходило «012», тобто 12 після чужого нуля. Стерте поле
// має бути стертим, а не нулем.
//
// Друга причина, чому тут власний стан: поки набирають «1,» або «0.», поле
// ще не число. Якщо на кожне натискання писати назовні `Number`, кома зникає
// з-під пальців. Тому набране тримається як текст, а назовні йде число —
// тільки коли воно вже є.
export default function NumField({ value, onValue, className, ...rest }) {
  // null — показуємо те, що прийшло знадвору; рядок — те, що набирають.
  const [typed, setTyped] = useState(null)

  // Значення змінилося не нашим набором, а знадвору: підставили збережене
  // поле, вибрали культуру, натиснули підказку. Тоді набране треба відпустити
  // — інакше в полі лишиться старий текст, якого вже ніхто не вводив.
  useEffect(() => {
    if (typed === null) return
    const n = typed === '' ? null : Number(typed)
    const same = n === value || (typed !== '' && !Number.isFinite(n) && value == null)
    if (!same) setTyped(null)
  }, [value])      // eslint-disable-line react-hooks/exhaustive-deps

  const shown = typed ?? (value == null || value === '' ? '' : String(value))

  return (
    <input
      {...rest}
      type="number"
      className={className}
      value={shown}
      onChange={(e) => {
        const raw = e.target.value
        setTyped(raw)
        if (raw === '') { onValue(null); return }
        const n = Number(raw)
        if (Number.isFinite(n)) onValue(n)
      }}
      // Поле покинули — тримати набраний текст більше нема причини: далі
      // показуємо те, з чим справді рахує програма.
      onBlur={(e) => {
        setTyped(null)
        rest.onBlur?.(e)
      }}
    />
  )
}
