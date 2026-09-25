import { rhythmOf } from '../lib/tramline'
import { num } from '../lib/format'

// Довідник, який у виробників висить у посібнику до сівалки: захват сівалки
// проти захвату обприскувача — і ритм на перетині. Тут він живий: рахується
// тією ж функцією, що й головна відповідь, тож розійтися вони не можуть.
//
// Наш розрахунок точніший за паперову таблицю, бо враховує ще колію, шину й
// міжряддя. Але таблиця відповідає на інше питання — «а що взагалі
// поєднується з чим», — і саме його ставлять, коли обирають техніку.
const DRILLS = [3, 4, 4.5, 6, 8, 9, 12]
const SPRAYERS = [12, 15, 16, 18, 20, 21, 24, 27, 28, 30, 36]

// Власні захвати рідко збігаються зі стандартним рядом (8,4 м сівалки під
// соняшник там нема й близько), тому додаємо їх у таблицю — інакше обіцянка
// «ваша комбінація підсвічена» не виконується.
function withOwn(list, own) {
  if (!(own > 0)) return list
  if (list.some((v) => Math.abs(v - own) < 0.05)) return list
  return [...list, Math.round(own * 100) / 100].sort((a, b) => a - b)
}

export default function RhythmTable({ drillWidth, sprayerWidth }) {
  const drills = withOwn(DRILLS, drillWidth)
  const sprayers = withOwn(SPRAYERS, sprayerWidth)

  return (
    <div className="panel">
      <h2>довідник ритмів</h2>
      <p className="note" style={{ margin: '0 0 14px' }}>
        Число на перетині — ритм: скільки проходів сівалки до повтору візерунка.
        Саме його вводять у термінал. Порожня клітинка — захвати не поєднуються,
        колії не вийде. Ваша комбінація підсвічена.
      </p>

      <div className="table-scroll">
        <table className="rhythm-table">
          <thead>
            <tr>
              <th>сівалка \ обприскувач</th>
              {sprayers.map((s) => <th key={s}>{num(s)}</th>)}
            </tr>
          </thead>
          <tbody>
            {drills.map((w) => (
              <tr key={w}>
                <th>{num(w)} м</th>
                {sprayers.map((s) => {
                  const r = rhythmOf(s, w)
                  const here = Math.abs(w - drillWidth) < 0.05 && Math.abs(s - sprayerWidth) < 0.05
                  return (
                    <td key={s}
                      className={[
                        r ? '' : 'is-none',
                        r && !r.symmetric ? 'is-async' : '',
                        here ? 'is-here' : '',
                      ].filter(Boolean).join(' ')}
                      title={r
                        ? `${r.rhythm} проходів до повтору${r.symmetric ? '' : ', асиметричний'}`
                        : 'захвати не поєднуються'}>
                      {r ? r.rhythm : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="legend">
        <span><i className="sw sw-row" /> звичайний ритм</span>
        <span><i className="sw sw-off" /> асиметричний — колія з половинок на різних проходах</span>
      </div>
    </div>
  )
}
