import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Порожній base робить збірку переносною: dist/ відкривається і з файлової
// системи, і з будь-якого підкаталогу на сервері.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5180, open: true },
})
