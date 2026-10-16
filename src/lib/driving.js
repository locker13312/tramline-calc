// ── Маршрути машин по полю ────────────────────────────────────────────────
//
// Хто де їде — для карти рухів. Поле їдуть човником: прохід туди, розворот
// за межею поля, прохід назад сусідньою смугою, і так до кінця. Сівалка йде
// своїми проходами від краю, решта машин — своїми проходами по коліях.
//
// Центр проходу машини стоїть там само, де його ставить розрахунок колії:
// від краю робочої частини, з відступом машини, через її захват. Саме в цих
// точках її колеса потрапляють у вимкнені смуги — тому маршрут на карті
// збігається з коліями, а не намальований поруч.
export function machineRoutes(plan, result) {
  if (!plan?.passes?.length || !result?.ok) return null
  const x0 = plan.headland || 0
  const x1 = plan.fieldWidth - x0
  const EPS = 1e-6

  const drill = {
    id: 'drill',
    label: 'Сівалка',
    width: result.step,
    passes: plan.passes.map((p, n) => ({
      x: Math.round(((p.from + p.to) / 2) * 1000) / 1000,
      up: n % 2 === 0,
      n: n + 1,
      pass: p,
    })),
  }

  const machines = []
  for (const m of result.machines ?? []) {
    if (!m.active || !m.fits || !(m.width > 0)) continue
    const xs = []
    for (let j = -1; ; j++) {
      const c = x0 + (m.phase || 0) + (j + 0.5) * m.width
      if (c > x1 + EPS) break
      if (c >= x0 - EPS) xs.push(Math.round(c * 1000) / 1000)
      if (xs.length > 5000) break
    }
    if (!xs.length) continue
    machines.push({
      id: m.id,
      label: m.label,
      kind: m.kind,
      width: m.width,
      passes: xs.map((x, n) => ({ x, up: n % 2 === 0, n: n + 1 })),
    })
  }

  return { drill, machines, x0, x1, headland: x0 }
}
