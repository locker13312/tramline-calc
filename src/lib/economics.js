// ── Скільки колія коштує і скільки економить ──────────────────────────────
//
// Колія — це свідомо недосіяна площа, тобто витрата. Питання не в тому,
// скільки вона з'їдає, а в тому, чи з'їдає менше, ніж витоптування без неї.
//
// Модель навмисно проста й уся на видноті, бо точні цифри тут і не потрібні:
// різниця між варіантами зазвичай кратна, а не на відсотки.
//
//   З колією     — недосіяна площа під колесами, раз і назавжди, скільки б
//                  машин і обробок по ній не пройшло.
//   Без колії    — кожен прохід кожної машини кладе два сліди по живому. Без
//                  підрулювання сліди щоразу нові, тож втрати додаються від
//                  проходу до проходу, поки не впруться в площу поля.
//
// Машин різні: обприскувач ходить чотири рази за сезон вузькою шиною,
// комбайн — один раз, але шиною 80 см. Тому витоптане рахується по кожній
// окремо, а не однією «середньою» машиною.
//
// Витоптане гине не повністю: рання обробка по сходах шкодить менше за
// пізню, тому частка втрат — окреме поле, а не вшита константа.

const mm = (v) => Math.round(v * 1000) / 1000

export function economics(plan, result, {
  yieldPerHa,      // т/га
  pricePerTon,     // ₴/т
  passes,          // обробок за сезон — для машин, що не задали своє число
  damagePct = 70,  // скільки врожаю гине на витоптаному, %
  tyreWidth,       // стара коротка форма на одну машину
}) {
  if (!plan || plan.tooSmall || !result?.ok) return null
  if (!(yieldPerHa > 0) || !(pricePerTon > 0)) return null

  const perHa = yieldPerHa * pricePerTon        // ₴ з гектара
  const damage = Math.min(Math.max(damagePct, 0), 100) / 100

  // Площа під колесами однієї машини за всі її проходи полем за сезон.
  const machines = (result.machines || []).filter((m) => m.active && m.width > 0)
  const perMachine = machines.map((m) => {
    const tyre = m.tyreWidth || tyreWidth || 0
    const seasonPasses = m.passesPerSeason > 0 ? m.passesPerSeason : passes
    const fieldPasses = Math.ceil(plan.workWidth / m.width)
    // Задня вісь іде слідом передньої, тож толочить та сама смуга — беремо
    // найширшу шину машини, а не суму осей.
    const ha = mm((2 * tyre * fieldPasses * plan.workLength) / 10000)
    return {
      id: m.id, label: m.label, width: m.width, tyre,
      passes: seasonPasses, fieldPasses,
      haPerPass: ha,
      ha: mm(ha * seasonPasses),
    }
  })

  const totalPasses = perMachine.reduce((a, m) => a + m.passes, 0)
  if (!(totalPasses > 0)) return null

  const trackHa = mm(perMachine.reduce((a, m) => a + m.haPerPass, 0))
  const rawDamagedHa = perMachine.reduce((a, m) => a + m.ha, 0)

  const withTramlines = {
    ha: plan.lostHa,
    uah: Math.round(plan.lostHa * perHa),
  }

  // Сліди не лягають один в один, але й не можуть накрити більше, ніж усе поле.
  const damagedHa = mm(Math.min(rawDamagedHa, plan.workingHa) * damage)
  const without = {
    ha: damagedHa,
    uah: Math.round(damagedHa * perHa),
  }

  // Скільки проходів треба, щоб колія почала окупатися. Беремо середній
  // прохід наявного парку: машини різні, а число має бути одне.
  const avgPerPass = trackHa / perMachine.length
  return {
    perHa: Math.round(perHa),
    trackHa,
    machines: perMachine,
    totalPasses,
    withTramlines,
    without,
    saving: without.uah - withTramlines.uah,
    breakEvenPasses: avgPerPass * damage > 0
      ? Math.ceil(plan.lostHa / (avgPerPass * damage))
      : null,
  }
}
