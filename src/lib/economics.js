// ── Скільки колія коштує і скільки економить ──────────────────────────────
//
// Колія — це свідомо недосіяна площа, тобто витрата. Питання не в тому,
// скільки вона з'їдає, а в тому, чи з'їдає менше, ніж витоптування без неї.
//
// Модель навмисно проста й уся на видноті, бо точні цифри тут і не потрібні:
// різниця між варіантами зазвичай кратна, а не на відсотки.
//
//   З колією     — недосіяна площа під колесами, раз і назавжди, скільки б
//                  обробок не було за сезон.
//   Без колії    — кожен прохід кладе два сліди по живому. Без підрулювання
//                  сліди щоразу нові, тож втрати додаються від обробки до
//                  обробки, поки не впруться в площу поля.
//
// Витоптане гине не повністю: рання обробка по сходах шкодить менше за
// пізню, тому частка втрат — окреме поле, а не вшита константа.

const mm = (v) => Math.round(v * 1000) / 1000

export function economics(plan, result, {
  yieldPerHa,      // т/га
  pricePerTon,     // ₴/т
  passes,          // обробок за сезон
  damagePct = 70,  // скільки врожаю гине на витоптаному, %
  tyreWidth,
}) {
  if (!plan || plan.tooSmall || !result?.ok) return null
  if (!(yieldPerHa > 0) || !(pricePerTon > 0) || !(passes > 0)) return null

  const perHa = yieldPerHa * pricePerTon        // ₴ з гектара
  const damage = Math.min(Math.max(damagePct, 0), 100) / 100

  // Площа під колесами за один прохід обприскувача по всьому полю.
  const trackHa = mm((plan.strips.length * tyreWidth * plan.workLength) / 10000)

  const withTramlines = {
    ha: plan.lostHa,
    uah: Math.round(plan.lostHa * perHa),
  }

  // Сліди не лягають один в один, але й не можуть накрити більше, ніж усе поле.
  const damagedHa = mm(Math.min(trackHa * passes, plan.workingHa) * damage)
  const without = {
    ha: damagedHa,
    uah: Math.round(damagedHa * perHa),
  }

  return {
    perHa: Math.round(perHa),
    trackHa,
    withTramlines,
    without,
    saving: without.uah - withTramlines.uah,
    // Скільки обробок треба, щоб колія почала окупатися.
    breakEvenPasses: trackHa * damage > 0
      ? Math.ceil(plan.lostHa / (trackHa * damage))
      : null,
  }
}
