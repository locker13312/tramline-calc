// Довідники, щоб не вбивати цифри руками. Значення типові для України;
// будь-яке з них у формі можна перебити власним.

export const CROPS = [
  { key: 'sunflower', label: 'Соняшник',      rowSpacing: 0.70, rows: 12 },
  { key: 'corn',      label: 'Кукурудза',     rowSpacing: 0.70, rows: 12 },
  { key: 'soy',       label: 'Соя',           rowSpacing: 0.45, rows: 16 },
  { key: 'sugarbeet', label: 'Цукровий буряк', rowSpacing: 0.45, rows: 18 },
  { key: 'wheat',     label: 'Пшениця',       rowSpacing: 0.15, rows: 24 },
  { key: 'barley',    label: 'Ячмінь',        rowSpacing: 0.15, rows: 24 },
  { key: 'rapeseed',  label: 'Ріпак',         rowSpacing: 0.25, rows: 16 },
]

// Ширини захвату обприскувачів, що реально ходять по полях.
export const SPRAYER_WIDTHS = [12, 14, 15, 16, 18, 20, 21, 24, 25.2, 27, 28, 30, 32, 36]

// Колія та шина: у просапних культур вузькі шини, у зернових — ширші.
export const SPRAYER_PRESETS = [
  { key: 'row-crop', label: 'Просапний (вузька шина)', trackWidth: 2.25, tyreWidth: 0.32 },
  { key: 'universal', label: 'Універсальний',          trackWidth: 2.00, tyreWidth: 0.42 },
  { key: 'wide',      label: 'Широка шина / флотація', trackWidth: 2.25, tyreWidth: 0.65 },
]

export const DEFAULTS = {
  crop: 'sunflower',
  rows: 12,
  rowSpacing: 0.7,
  sprayerWidth: 25.2,
  trackWidth: 2.25,
  tyreWidth: 0.32,
  margin: 0.1,
  halfStart: false,
  fieldWidth: 600,
  fieldLength: 800,
  headland: 24,          // два заходи обприскувача — типовий обсів
  spreaderWidth: 0,      // 0 = розкидач не рахуємо
  yieldPerHa: 2.8,       // соняшник, середнє по Україні
  pricePerTon: 18000,
  passes: 4,             // обприскувань за сезон
  damagePct: 70,         // скільки врожаю гине під колесом
}
