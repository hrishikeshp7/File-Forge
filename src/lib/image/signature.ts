/** Crop a canvas to its visible (non-transparent) pixels plus a small margin and return it as PNG. */
export async function trimToPng(src: HTMLCanvasElement): Promise<{ png: Uint8Array; aspect: number; width: number; height: number } | null> {
  const { width: w, height: h } = src
  const d = src.getContext('2d')!.getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) (x < x0 && (x0 = x), x > x1 && (x1 = x), y < y0 && (y0 = y), y > y1 && (y1 = y))
  if (x1 < 0) return null // nothing drawn
  const pad = 6
  const sx = Math.max(0, x0 - pad), sy = Math.max(0, y0 - pad)
  const cw = Math.min(w, x1 + pad) - sx + 1, ch = Math.min(h, y1 + pad) - sy + 1
  const out = document.createElement('canvas')
  out.width = cw
  out.height = ch
  out.getContext('2d')!.drawImage(src, sx, sy, cw, ch, 0, 0, cw, ch)
  const blob = await new Promise<Blob>((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('Encode failed'))), 'image/png'))
  return { png: new Uint8Array(await blob.arrayBuffer()), aspect: cw / ch, width: cw, height: ch }
}

/** Ink-on-paper photo → transparent PNG canvas: white paper becomes transparent, darkness becomes opacity of `ink`. */
export function paperToInk(src: CanvasImageSource & { width: number; height: number }, ink: string, maxW = 1200): HTMLCanvasElement {
  const k = Math.min(1, maxW / src.width)
  const c = document.createElement('canvas')
  c.width = Math.round(src.width * k)
  c.height = Math.round(src.height * k)
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0, c.width, c.height)
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16))
  for (let i = 0; i < img.data.length; i += 4) {
    const lum = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]
    img.data[i + 3] = lum > 225 ? 0 : Math.min(255, (225 - lum) * 2.2)
    img.data[i] = r
    img.data[i + 1] = g
    img.data[i + 2] = b
  }
  ctx.putImageData(img, 0, 0)
  return c
}
