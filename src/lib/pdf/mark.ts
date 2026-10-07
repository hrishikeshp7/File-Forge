import { StandardFonts, degrees, rgb } from 'pdf-lib'
import type { PDFImage, PDFPage } from 'pdf-lib'
import { isolateContent, toContent, viewOf, type View } from './place.ts'
import { loadPdf } from './ops.ts'

/**
 * Draw `img` so it looks upright on the visible page: centred at visual (cx, cy), size w×h points, turned `angle` degrees
 * counter-clockwise as seen by the reader. Handles /Rotate and the crop-box origin.
 */
export function drawUpright(page: PDFPage, img: PDFImage, v: View, cx: number, cy: number, w: number, h: number, angle: number, opacity = 1) {
  const theta = ((angle + v.rot) * Math.PI) / 180 // content-space angle that shows as `angle` after /Rotate
  const c = toContent(v, cx, cy)
  // pdf-lib rotates about the image's bottom-left corner, so offset that corner from the wanted centre.
  page.drawImage(img, {
    x: c.x - ((w / 2) * Math.cos(theta) - (h / 2) * Math.sin(theta)),
    y: c.y - ((w / 2) * Math.sin(theta) + (h / 2) * Math.cos(theta)),
    width: w,
    height: h,
    rotate: degrees((theta * 180) / Math.PI),
    opacity,
  })
}

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
    const centers: [number, number][] = o.mode === 'center' ? [[v.vw / 2, v.vh / 2]] : tileCenters(v.vw, v.vh, Math.max(w, h) * 1.5)
    for (const [cx, cy] of centers) drawUpright(page, img, v, cx, cy, w, h, o.angle, o.opacity)
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

export interface Placement {
  /** 0-based page. */
  page: number
  /** Centre of the mark as fractions of the visible page, measured from the top-left. */
  cx: number
  cy: number
  /** Width as a fraction of the visible page width. */
  w: number
}

/** Place a picture (e.g. a drawn signature) on pages. This is a visual mark, not a cryptographic digital signature. */
export async function addPicture(bytes: Uint8Array, png: Uint8Array, aspect: number, placements: Placement[]): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  const img = await doc.embedPng(png)
  const pages = doc.getPages()
  for (const pl of placements) {
    const page = pages[pl.page]
    isolateContent(page)
    const v = viewOf(page)
    const w = v.vw * pl.w
    drawUpright(page, img, v, pl.cx * v.vw, (1 - pl.cy) * v.vh, w, w / aspect, 0)
  }
  return doc.save({ useObjectStreams: true })
}

/** Crop = set the crop box to a rectangle given as fractions of the visible page (top-left origin). Content outside is hidden, not deleted. */
export async function cropPages(bytes: Uint8Array, rect: { x: number; y: number; w: number; h: number }, pages?: number[]): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  const targets = new Set(pages ?? doc.getPageIndices())
  for (const [i, page] of doc.getPages().entries()) {
    if (!targets.has(i)) continue
    const v = viewOf(page)
    const a = toContent(v, rect.x * v.vw, (1 - rect.y - rect.h) * v.vh)
    const b = toContent(v, (rect.x + rect.w) * v.vw, (1 - rect.y) * v.vh)
    page.setCropBox(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y))
  }
  return doc.save({ useObjectStreams: true })
}
