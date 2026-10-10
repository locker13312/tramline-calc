// Checks every className used in components has a rule in index.css.
// Catches the classic refactor bug: markup renamed, stylesheet not.
import { readFileSync, readdirSync } from 'node:fs'

const css = readFileSync('src/index.css', 'utf8')
const defined = new Set([...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]))

const files = [
  ...readdirSync('src/components').map((f) => `src/components/${f}`),
  'src/App.jsx',
]

const used = new Map()
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  // className="a b", className={`a${x ? ' b' : ''}`}, className={'a'}
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
    const raw = (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, ' ')
    for (const cls of raw.split(/\s+/).filter(Boolean)) {
      if (!used.has(cls)) used.set(cls, new Set())
      used.get(cls).add(f)
    }
  }
  // conditional fragments inside template literals: ' is-hit'
  for (const m of src.matchAll(/\?\s*'\s+([a-z][a-z0-9-]*)'/g)) {
    if (!used.has(m[1])) used.set(m[1], new Set())
    used.get(m[1]).add(f)
  }
}

const missing = [...used.entries()].filter(([c]) => !defined.has(c))
for (const [cls, where] of missing) {
  console.log(`MISSING .${cls}  <- ${[...where].join(', ')}`)
}
console.log(missing.length
  ? `\n${missing.length} classes have no style`
  : `\nall ${used.size} classes styled`)
process.exit(missing.length ? 1 : 0)
