// Placing marks so they look right on the *visible* page: crop box origin and /Rotate both matter.
import type { PDFPage } from 'pdf-lib'

export interface View {
  x0: number
  y0: number
  /** Unrotated content-space size of the visible box. */
  w: number
  h: number
  /** Page /Rotate, normalized to 0/90/180/270 (clockwise). */
  rot: number
  /** Size as the viewer shows it. */
  vw: number
  vh: number
}

export function viewOf(page: PDFPage): View {
  const { x, y, width, height } = page.getCropBox()
  const rot = (((Math.round(page.getRotation().angle / 90) * 90) % 360) + 360) % 360
  const sideways = rot === 90 || rot === 270
  return { x0: x, y0: y, w: width, h: height, rot, vw: sideways ? height : width, vh: sideways ? width : height }
}

/** Visual point (origin bottom-left of the displayed page) → content-space point. */
export function toContent(v: View, vx: number, vy: number): { x: number; y: number } {
  const { x0, y0, w, h, rot } = v
  switch (rot) {
    case 90: return { x: x0 + (w - vy), y: y0 + vx }
    case 180: return { x: x0 + (w - vx), y: y0 + (h - vy) }
    case 270: return { x: x0 + vy, y: y0 + (h - vx) }
    default: return { x: x0 + vx, y: y0 + vy }
  }
}

/**
 * Real-world PDFs sometimes leave the graphics state transformed (unbalanced q/cm).
 * Wrapping the existing content in q…Q makes our marks start from a clean state.
 */
export function isolateContent(page: PDFPage) {
  const ctx = page.doc.context
  const wrap = (op: Uint8Array) => ctx.register(ctx.flateStream(op))
  const enc = (s: string) => new TextEncoder().encode(s)
  page.node.normalize()
  page.node.wrapContentStreams(wrap(enc('q\n')), wrap(enc('\nQ\n')))
}
