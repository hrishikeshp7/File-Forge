import { StandardFonts, degrees, rgb } from 'pdf-lib'
import { isolateContent, toContent, viewOf } from './place.ts'
import { loadPdf } from './ops.ts'

export interface WatermarkOptions {
  png: Uint8Array
  /** Source image size in px (for aspect ratio). */
  width: number
  height: number
  /** Watermark width as a fraction of the visible page width (0–1). */
  scale: number
  opacity: number
  /** Visual angle in degrees, counter-clockwise. */
  angle: number
  mode: 'center' | 'tile'
  /** 0-based page indexes; undefined = all. */
  pages?: number[]
}

export async function addWatermark(bytes: Uint8Array, o: WatermarkOptions): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  const img = await doc.embedPng(o.png)
  const targets = new Set(o.pages ?? doc.getPageIndices())
  for (const [i, page] of doc.getPages().entries()) {
    if (!targets.has(i)) continue
    isolateContent(page)
    const v = viewOf(page)
    const w = v.vw * o.scale
    const h = (w * o.height) / o.width
    const theta = ((o.angle + v.rot) * Math.PI) / 180 // content-space angle that shows as `angle` after /Rotate
    const centers: [number, number][] =
      o.mode === 'center'
        ? [[v.vw / 2, v.vh / 2]]
        : tileCenters(v.vw, v.vh, Math.max(w, h) * 1.5)
    for (const [cx, cy] of centers) {
      const c = toContent(v, cx, cy)
      // pdf-lib rotates about the image's bottom-left corner, so offset that corner from the wanted center.
      page.drawImage(img, {
        x: c.x - ((w / 2) * Math.cos(theta) - (h / 2) * Math.sin(theta)),
        y: c.y - ((w / 2) * Math.sin(theta) + (h / 2) * Math.cos(theta)),
        width: w,
        height: h,
        rotate: degrees((theta * 180) / Math.PI),
        opacity: o.opacity,
      })
    }
  }
  return doc.save({ useObjectStreams: true })
}

function tileCenters(vw: number, vh: number, step: number): [number, number][] {
  const out: [number, number][] = []
  for (let y = step / 2; y < vh + step / 2; y += step) for (let x = step / 2; x < vw + step / 2; x += step) out.push([x, y])
  return out
}

export type NumberPos = 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br'

export interface PageNumberOptions {
  /** Tokens: {n} page number, {total} page count. */
  format: string
  position: NumberPos
  start: number
  size: number
  margin: number
  /** 0-based pages that get a number (numbering still counts from the first page). undefined = all. */
  pages?: number[]
}

export async function addPageNumbers(bytes: Uint8Array, o: PageNumberOptions): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const total = doc.getPageCount()
  const targets = new Set(o.pages ?? doc.getPageIndices())
  for (const [i, page] of doc.getPages().entries()) {
    if (!targets.has(i)) continue
    const text = o.format.replaceAll('{n}', String(o.start + i)).replaceAll('{total}', String(o.start + total - 1))
    let tw: number
    try {
      tw = font.widthOfTextAtSize(text, o.size)
    } catch {
      throw new Error('Page number text supports Latin letters, digits and common punctuation only.')
    }
    isolateContent(page)
    const v = viewOf(page)
    const vx = o.position[1] === 'l' ? o.margin : o.position[1] === 'r' ? v.vw - o.margin - tw : (v.vw - tw) / 2
    const vy = o.position[0] === 'b' ? o.margin : v.vh - o.margin - o.size
    const c = toContent(v, vx, vy)
    page.drawText(text, { x: c.x, y: c.y, size: o.size, font, color: rgb(0.1, 0.1, 0.1), rotate: degrees(v.rot) })
  }
  return doc.save({ useObjectStreams: true })
}
