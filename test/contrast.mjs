// Checks text contrast for every theme and accent, by the numbers.
//
// "Hard to read on dark green" is a real complaint that eyeballing cannot
// settle: the same grey passes against paper and fails against near-black.
// So the token values are pulled straight out of index.css and every
// text-on-background pair the app actually uses is measured against WCAG.
//
// 4.5:1 is the bar for body text, 3:1 for large text (18px+ or bold 14px+).
// Anything below gets printed and fails the run.

import { readFileSync } from 'node:fs'

// Comments go first: a comment ahead of a rule would otherwise be swallowed
// into the selector, and ":root" would never match anything.
const css = readFileSync('src/index.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// Token values per selector block, in source order: later blocks win, which
// is how the cascade reads them too.
function blocks() {
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(css))) {
    const sel = m[1].trim().replace(/\s+/g, ' ')
    const vars = {}
    for (const d of m[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      vars[d[1]] = d[2].trim()
    }
    if (Object.keys(vars).length) out.push({ sel, vars })
  }
  return out
}

const all = blocks()

// Resolve the token set for one theme + accent combination.
function tokens(theme, accent) {
  const want = (sel) => {
    if (sel.includes('[data-accent=')) {
      return sel.includes(`[data-accent="${accent}"]`)
    }
    if (sel.includes('[data-theme="dark"]')) return theme === 'dark'
    // Inside the prefers-color-scheme block the selector carries :not([light]).
    if (sel.includes(':not([data-theme="light"])')) return theme === 'dark-auto'
    if (sel === ':root') return true
    return false
  }
  const vars = {}
  for (const b of all) if (want(b.sel)) Object.assign(vars, b.vars)

  // One level of var() indirection is all the stylesheet uses.
  const deref = (v, depth = 0) => {
    const hit = /^var\((--[a-z0-9-]+)\)$/.exec(v?.trim() ?? '')
    if (!hit || depth > 4) return v
    return deref(vars[hit[1]], depth + 1)
  }
  for (const k of Object.keys(vars)) vars[k] = deref(vars[k])
  return vars
}

const srgb = (hex) => {
  const h = hex.trim().replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
}
const lum = (hex) => {
  const [r, g, b] = srgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// Every pair that carries real text in the interface, with the bar it has to
// clear. "large" marks headings and the big figures.
const PAIRS = [
  ['--ink', '--bg', 4.5, 'основний текст на тлі'],
  ['--ink', '--panel', 4.5, 'основний текст у картці'],
  ['--ink', '--sunken', 4.5, 'текст у полі введення'],
  ['--ink-2', '--panel', 4.5, 'підписи полів, пояснення'],
  ['--ink-2', '--sunken', 4.5, 'підписи на втопленому тлі'],
  ['--ink-2', '--bg', 4.5, 'підвал і вкладки'],
  ['--ink-3', '--panel', 4.5, 'примітки, лінійки схем, заголовки панелей'],
  ['--ink-3', '--sunken', 4.5, 'примітки у картках машин'],
  ['--ink-3', '--bg', 4.5, 'дрібний текст на тлі'],
  ['--ink', '--crop-soft', 4.5, 'виділений мишею текст'],
  ['--crop', '--panel', 4.5, 'акцент текстом: ритм, «їде готовою»'],
  ['--crop', '--crop-soft', 4.5, 'акцент на своєму підкладі'],
  ['--crop', '--sunken', 4.5, 'акцент у картці'],
  ['--track', '--panel', 4.5, 'номери вимкнених сошників'],
  ['--track', '--track-soft', 4.5, 'колія на своєму підкладі'],
  ['--track', '--sunken', 4.5, 'колія в картці циклу'],
  ['--warn', '--warn-soft', 4.5, 'попередження'],
  ['--m1', '--panel', 3, 'підпис машини 1'],
  ['--m2', '--panel', 3, 'підпис машини 2'],
  ['--m3', '--panel', 3, 'підпис машини 3'],
  ['--m4', '--panel', 3, 'підпис машини 4'],
  ['--m5', '--panel', 3, 'підпис машини 5'],
  ['--line-2', '--panel', 1.3, 'рамка поля введення'],
]

const THEMES = ['light', 'dark', 'dark-auto']
const ACCENTS = ['green', 'blue', 'teal', 'violet', 'slate']

let bad = 0
let worst = { r: Infinity }
let worstText = { r: Infinity }
for (const theme of THEMES) {
  for (const accent of ACCENTS) {
    const v = tokens(theme, accent)
    for (const [fg, bgk, bar, what] of PAIRS) {
      const isText = bar >= 3
      const a = v[fg]
      const b = v[bgk]
      if (!a || !b || !a.startsWith('#') || !b.startsWith('#')) {
        console.log(`?  ${theme}/${accent}  ${fg} on ${bgk}: не визначено (${a} / ${b})`)
        bad++
        continue
      }
      const r = ratio(a, b)
      if (r < worst.r) worst = { r, theme, accent, fg, bgk, what }
      if (isText && r < worstText.r) worstText = { r, theme, accent, fg, bgk, what }
      if (r < bar) {
        bad++
        console.log(`FAIL ${theme}/${accent}  ${r.toFixed(2)}:1 < ${bar}  ${fg} (${a}) на ${bgk} (${b})  — ${what}`)
      }
    }
  }
}

console.log(`\nнайтісніший текст: ${worstText.r.toFixed(2)}:1 — ${worstText.fg} на ${worstText.bgk}`
  + ` (${worstText.theme}/${worstText.accent}, ${worstText.what})`)
console.log(`найтісніша межа:   ${worst.r.toFixed(2)}:1 — ${worst.fg} на ${worst.bgk}`
  + ` (${worst.theme}/${worst.accent}, ${worst.what})`)
console.log(bad
  ? `\n${bad} пар не дотягують`
  : `\nусі ${PAIRS.length * THEMES.length * ACCENTS.length} пар проходять`)
process.exit(bad ? 1 : 0)
