import { useState } from 'react'
import { TramlineIcon, FieldIcon, MoneyIcon, SavedIcon } from './icons'

// Вхід і реєстрація на весь екран, двома половинами: ліва пояснює, куди
// людина потрапила і що дає акаунт, права — сама форма.
//
// Чому не маленька панель, як було: по цей екран приходять з «моїх полів»,
// тобто з питанням «чому в мене просять пошту». Відповідь на нього — не
// примітка під полем введення, а те, з чим форма стоїть поруч. Ліва половина
// і є відповіддю, тому вона не окраса: без неї форма вимагає пошту молча.
//
// Розрахунок при цьому нікуди не дівається: кнопка «далі без акаунта»
// повертає в програму. Акаунт тут потрібен рівно для того, щоб було де
// тримати поля й техніку, і ні для чого більше.

const GAINS = [
  { icon: SavedIcon, text: 'Поля господарства — назви, розміри, культура' },
  { icon: FieldIcon, text: 'Комплекти техніки з усіма колісними базами' },
  { icon: MoneyIcon, text: 'Врожайність і ціна тонни лишаються на місці' },
]

// Чи міцний пароль. Міра тут підказка, а не вимога: сервер вимагає вісім
// символів, і вигадувати суворіші правила на клієнті означало б не пускати
// туди, куди сервер пускає.
function strength(pw) {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/\d/.test(pw) && /\p{L}/u.test(pw)) s++
  if (/[^\p{L}\d]/u.test(pw)) s++
  return s
}
const STRENGTH_WORD = ['', 'коротко', 'згодиться', 'добре', 'надійно']

// Око: показати чи сховати пароль. Набраний пароль не видно, а помилка в
// ньому — найчастіша причина, чому «вхід не працює».
function EyeIcon({ off }) {
  const base = {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
    width: 17, height: 17,
  }
  return off ? (
    <svg {...base}>
      <path d="M17.9 17.9A9.9 9.9 0 0 1 12 19.8c-6.5 0-10.2-7.8-10.2-7.8a17.6 17.6 0 0 1 4.7-5.5" />
      <path d="M9.9 4.4A8.6 8.6 0 0 1 12 4.2c6.5 0 10.2 7.8 10.2 7.8a17.7 17.7 0 0 1-2 3.1" />
      <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" />
      <path d="M2 2l20 20" />
    </svg>
  ) : (
    <svg {...base}>
      <path d="M1.8 12S5.5 4.2 12 4.2 22.2 12 22.2 12 18.5 19.8 12 19.8 1.8 12 1.8 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

// Поле пароля з оком. Решту властивостей пропускає в input як є.
function PwField({ label, hint, ...rest }) {
  const [show, setShow] = useState(false)
  return (
    <label>
      {label}
      <span className="au-pw">
        <input {...rest} type={show ? 'text' : 'password'} />
        <button type="button" tabIndex={-1} className="au-eye"
          aria-label={show ? 'сховати пароль' : 'показати пароль'}
          title={show ? 'сховати пароль' : 'показати пароль'}
          onClick={() => setShow((s) => !s)}>
          <EyeIcon off={show} />
        </button>
      </span>
      {hint}
    </label>
  )
}

export default function AuthScreen({
  onAuth, onHome, onSkip, initialMode = 'login', lead, mark,
}) {
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({ email: '', password: '', confirm: '', name: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const register = mode === 'register'
  const to = (m) => { if (m !== mode) { setMode(m); setError('') } }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (register) {
      if (form.password.length < 8) { setError('Пароль — щонайменше 8 символів'); return }
      if (form.password !== form.confirm) { setError('Паролі не збігаються'); return }
    }
    setBusy(true)
    try {
      await onAuth(mode, { email: form.email, password: form.password, name: form.name })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const can = register
    ? form.email && form.password && form.confirm
    : form.email && form.password
  const s = strength(form.password)

  return (
    <div className="au">
      <div className="au-top">
        {onHome && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={onHome}>
            ‹ На головну
          </button>
        )}
        {onSkip && (
          <button type="button" className="mlink" onClick={onSkip}>
            далі без акаунта
          </button>
        )}
      </div>

      <div className="au-card">
        {/* ── Ліва половина: куди потрапили й що дає акаунт ── */}
        <div className="au-side">
          <div className="au-side-brand">
            {mark}
            <span className="lp-logo-t">
              <b>Колія</b>
              <i>розрахунок технологічної колії</i>
            </span>
          </div>

          <span className="au-side-badge">акаунт потрібен лише для збереження</span>

          <div key={mode} className="au-side-say">
            <h2 className="au-side-h">
              {register ? 'Господарство вводять раз' : 'З поверненням'}
            </h2>
            <p className="au-side-t">
              {lead || (register
                ? 'Парк і поля в господарстві не міняються роками. Створіть акаунт — і більше не вводьте їх щоразу заново.'
                : 'Увійдіть, щоб відкрити свої поля й комплекти техніки. Сам розрахунок працює й без входу.')}
            </p>
          </div>

          <ul className="au-gains">
            {GAINS.map((g, i) => (
              <li key={g.text} style={{ animationDelay: `${0.12 + i * 0.09}s` }}>
                <span className="au-gain-i"><g.icon width="15" height="15" /></span>
                {g.text}
              </li>
            ))}
          </ul>

          <p className="au-side-foot">
            <TramlineIcon width="15" height="15" />
            Розрахунок цілком у браузері — сервер до нього не причетний.
          </p>
        </div>

        {/* ── Права половина: форма ─────────────────────── */}
        <div className="au-form">
          <form onSubmit={submit} key={mode}>
            <h1 className="au-h">{register ? 'Створити акаунт' : 'Вхід'}</h1>
            <p className="au-h-sub">
              {register ? 'Пошта, пароль — і все.' : 'Пошта й пароль, якими реєструвались.'}
            </p>

            <div className="seg au-seg">
              <button type="button" className={!register ? 'is-on' : ''} onClick={() => to('login')}>
                Увійти
              </button>
              <button type="button" className={register ? 'is-on' : ''} onClick={() => to('register')}>
                Створити акаунт
              </button>
            </div>

            {register && (
              <label>
                Як до вас звертатись
                <input value={form.name} onChange={(e) => set('name', e.target.value)}
                  autoComplete="name" placeholder="необовʼязково" />
              </label>
            )}

            <label>
              Пошта
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                autoComplete="email" placeholder="ваша@пошта.ua"
                autoFocus={!register} required />
            </label>

            {register ? (
              <>
                <div className="au-two">
                  <PwField label="Пароль" value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    autoComplete="new-password" required />
                  <PwField label="Ще раз" value={form.confirm}
                    onChange={(e) => set('confirm', e.target.value)}
                    autoComplete="new-password" required />
                </div>
                {form.password && (
                  <div className="au-meter">
                    <span className="au-meter-bars">
                      {[1, 2, 3, 4].map((n) => (
                        <i key={n} className={n <= s ? 'is-on' : ''} />
                      ))}
                    </span>
                    <span className="au-meter-k">
                      {form.password.length < 8 ? 'щонайменше 8 символів' : STRENGTH_WORD[s]}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <PwField label="Пароль" value={form.password}
                onChange={(e) => set('password', e.target.value)}
                autoComplete="current-password" required />
            )}

            {error && <p className="warn au-err">{error}</p>}

            <button className="btn au-go" type="submit" disabled={busy || !can}>
              {busy ? 'Хвилинку…' : register ? 'Створити акаунт' : 'Увійти'}
            </button>

            <p className="au-switch">
              {register ? 'Акаунт уже є?' : 'Ще без акаунта?'}{' '}
              <button type="button" className="mlink" onClick={() => to(register ? 'login' : 'register')}>
                {register ? 'Увійти' : 'Створити'}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
