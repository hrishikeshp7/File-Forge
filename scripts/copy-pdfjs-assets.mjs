// Copy pdf.js runtime assets (CJK cmaps, base-14 fonts, JPX/JBIG2 wasm) into public/ so rendering works offline.
import { cpSync, mkdirSync } from 'node:fs'

const src = 'node_modules/pdfjs-dist'
for (const d of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  mkdirSync(`public/pdfjs/${d}`, { recursive: true })
  cpSync(`${src}/${d}`, `public/pdfjs/${d}`, { recursive: true })
}
