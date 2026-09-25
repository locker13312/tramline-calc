import { useState } from 'react'

// Вхід і реєстрація однією формою: поля ті самі, різниця лише в тому, куди
// піде запит. Окремі сторінки для двох полів — зайвий клік на порожньому місці.
export default function AuthPanel({ onAuth, title, lead }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onAuth(mode, { email, password, name })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const register = mode === 'register'

  return (
    <div className="panel auth">
      <h2>{title || (register ? 'реєстрація' : 'вхід')}</h2>
      {lead && <p className="note" style={{ margin: '0 0 14px' }}>{lead}</p>}

      <div className="seg">
        <button type="button" className={!register ? 'is-on' : ''} onClick={() => { setMode('login'); setError('') }}>
          Увійти
        </button>
        <button type="button" className={register ? 'is-on' : ''} onClick={() => { setMode('register'); setError('') }}>
          Створити акаунт
        </button>
      </div>

      <form onSubmit={submit}>
        {register && (
          <label>
            Як до вас звертатись
            <input value={name} onChange={(e) => setName(e.target.value)}
              autoComplete="name" placeholder="необовʼязково" />
          </label>
        )}
        <label>
          Пошта
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" required />
        </label>
        <label>
          Пароль
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={register ? 'new-password' : 'current-password'} required />
          {register && <span className="note" style={{ display: 'block', margin: '5px 0 0' }}>Щонайменше 8 символів.</span>}
        </label>

        {error && <p className="warn" style={{ marginTop: 0 }}>{error}</p>}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Хвилинку…' : register ? 'Створити акаунт' : 'Увійти'}
        </button>
      </form>
    </div>
  )
}
