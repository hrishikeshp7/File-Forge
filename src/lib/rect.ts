// Drag-box geometry in fractions of the image (0..1, top-left origin). Pure, so it is unit-tested in node.
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

export const moveRect = (r: Rect, dx: number, dy: number): Rect => ({ ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) })

/**
 * Drag one handle by (dx, dy). Edges are clamped to the image and `min` size. With `aspect` (w/h in fraction space)
 * only corner handles are meaningful: the opposite corner stays put and the ratio is kept.
 */
export function resizeRect(r: Rect, handle: Handle, dx: number, dy: number, o: { min: number; aspect?: number }): Rect {
  const { min, aspect } = o
  let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h
  if (handle.includes('w')) x0 = clamp(x0 + dx, 0, x1 - min)
  if (handle.includes('e')) x1 = clamp(x1 + dx, x0 + min, 1)
  if (handle.includes('n')) y0 = clamp(y0 + dy, 0, y1 - min)
  if (handle.includes('s')) y1 = clamp(y1 + dy, y0 + min, 1)
  if (!aspect || handle.length !== 2) return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }

  const sx = handle.includes('w') ? -1 : 1
  const sy = handle.includes('n') ? -1 : 1
  const ax = sx > 0 ? r.x : r.x + r.w // anchor corner
  const ay = sy > 0 ? r.y : r.y + r.h
  // follow the axis the pointer changed the most (relative to the current size)
  const relW = (x1 - x0) / r.w
  const relH = (y1 - y0) / r.h
  let w = Math.max(min, r.w * (Math.abs(relW - 1) >= Math.abs(relH - 1) ? relW : relH))
  let h = w / aspect
  const k = Math.min(1, (sx > 0 ? 1 - ax : ax) / w, (sy > 0 ? 1 - ay : ay) / h)
  w *= k
  h *= k
  return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h }
}

/** Centered box covering `fill` of the image, optionally with a fixed aspect ratio (w/h in fraction space). */
export function initialRect(aspect: number | undefined, fill = 0.8): Rect {
  if (!aspect) return { x: (1 - fill) / 2, y: (1 - fill) / 2, w: fill, h: fill }
  const w = aspect >= 1 ? fill : fill * aspect
  const h = w / aspect
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

/** Whole-pixel crop of a w×h image, never empty and always inside it. */
export function pixelRect(r: Rect, w: number, h: number) {
  const sx = Math.min(Math.round(r.x * w), w - 1)
  const sy = Math.min(Math.round(r.y * h), h - 1)
  return { sx, sy, sw: Math.max(1, Math.min(Math.round(r.w * w), w - sx)), sh: Math.max(1, Math.min(Math.round(r.h * h), h - sy)) }
}
