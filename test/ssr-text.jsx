// Той самий рендер, але текстом: що саме людина прочитає на сторінці.
// Схем і верстки тут не видно, зате видно головне — чи складаються слова в
// речення й чи немає в них «undefined м» або «1 машин».

import { renderToString } from 'react-dom/server'
import Calculator from '../src/components/Calculator'
import { DEFAULTS } from '../src/lib/presets'
import { newMachine } from '../src/lib/machines'

const input = {
  ...DEFAULTS,
  machines: [
    newMachine('sprayer', { width: 18, axles: [{ trackWidth: 3.0, tyreWidth: 0.35 }] }),
    newMachine('combine', { width: 9, axles: [{ trackWidth: 3.0, tyreWidth: 0.8 }] }),
    newMachine('cart', { width: 9, axles: [{ trackWidth: 3.0, tyreWidth: 0.65 }] }),
  ],
}

const html = renderToString(<Calculator input={input} setInput={() => {}} />)

// Беремо лише те, що читається: вердикт, цифри й присуд по машинах.
const text = html
  .replace(/<svg[\s\S]*?<\/svg>/g, '')
  .replace(/<(script|style)[\s\S]*?<\/\1>/g, '')
  .replace(/<\/(div|p|td|th|tr|h2|span|button|label|option)>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&#x2F;/g, '/').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
  .split('\n').map((s) => s.trim()).filter(Boolean)

const stop = text.findIndex((l) => l.includes('цикл сівби'))
console.log(text.slice(0, stop > 0 ? stop : 120).join('\n'))
