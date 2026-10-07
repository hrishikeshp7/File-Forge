import { decodeImage } from './decode.ts'
import { pixelRect, type Rect } from '../rect.ts'

export type OutFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/bmp' | 'image/x-icon'
export const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
}

export interface ImageOptions {
  /** 'keep' = same as input (unknown types fall back to PNG). */
  format: OutFormat | 'keep'
  quality: number // 0..1, ignored by PNG
  maxWidth?: number
  maxHeight?: number
  /** Exact target; with only one set the other follows the aspect ratio. */
  width?: number
  height?: number
  /** Uniform multiplier of the source size (resize by percent). */
  scale?: number
  /** With both width and height: fit inside that box keeping aspect (may upscale) instead of stretching. */
  contain?: boolean
  /** Crop first, as fractions of the (EXIF-oriented) picture. */
  crop?: Rect
  /** Then turn clockwise and/or mirror the result. */
  rotate?: 0 | 90 | 180 | 270
  flipH?: boolean
  flipV?: boolean
  /** Drawn last, on top (watermark). */
  overlay?: Overlay
  /** Apply EXIF rotation (default true). Off for images embedded in PDFs, which ignore EXIF. */
  exif?: boolean
}

export interface Overlay {
  source: CanvasImageSource & { width: number; height: number }
  /** Width as a fraction of the output width. */
  scale: number
  opacity: number
  /** Degrees counter-clockwise. */
  angle: number
  position: 'center' | 'tl' | 'tr' | 'bl' | 'br' | 'tile'
}

export interface ImageResult {
  blob: Blob
  width: number
  height: number
}

/** Target size: exact width/height win, then max bounds; never upscales via max*. */
export function fitSize(
  w: number,
  h: number,
  o: Pick<ImageOptions, 'maxWidth' | 'maxHeight' | 'width' | 'height' | 'scale' | 'contain'>,
) {
  if (o.scale) return { width: Math.max(1, Math.round(w * o.scale)), height: Math.max(1, Math.round(h * o.scale)) }
  if (o.contain && o.width && o.height) {
    const k = Math.min(o.width / w, o.height / h)
    return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
  }
  if (o.width || o.height) {
    const tw = o.width ?? Math.round((w * o.height!) / h)
    const th = o.height ?? Math.round((h * o.width!) / w)
    return { width: Math.max(1, tw), height: Math.max(1, th) }
  }
  const k = Math.min(1, (o.maxWidth ?? Infinity) / w, (o.maxHeight ?? Infinity) / h)
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

const le = (n: number, bytes: number) => Array.from({ length: bytes }, (_, i) => (n >>> (8 * i)) & 0xff)

/** 24-bit bottom-up BMP (no alpha; caller paints white first). */
function encodeBmp(ctx: CanvasRenderingContext2D, w: number, h: number): Blob {
  const { data } = ctx.getImageData(0, 0, w, h)
  const stride = Math.ceil((w * 3) / 4) * 4
  const out = new Uint8Array(54 + stride * h)
  out.set([0x42, 0x4d, ...le(out.length, 4), 0, 0, 0, 0, ...le(54, 4), ...le(40, 4), ...le(w, 4), ...le(h, 4), ...le(1, 2), ...le(24, 2), 0, 0, 0, 0, ...le(stride * h, 4)])
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((h - 1 - y) * w + x) * 4
      const d = 54 + y * stride + x * 3
      out[d] = data[s + 2]
      out[d + 1] = data[s + 1]
      out[d + 2] = data[s]
    }
  }
  return new Blob([out], { type: 'image/bmp' })
}

/** Single-image ICO wrapping a PNG (Vista+ and all browsers). Size 256 is stored as 0. */
async function encodeIco(png: Blob, size: number): Promise<Blob> {
  const dim = size >= 256 ? 0 : size
  const head = new Uint8Array([0, 0, 1, 0, 1, 0, dim, dim, 0, 0, 1, 0, 32, 0, ...le(png.size, 4), ...le(22, 4)])
  return new Blob([head, png], { type: 'image/x-icon' })
}

function encode(c: OffscreenCanvas | HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  if (c instanceof OffscreenCanvas) return c.convertToBlob({ type, quality })
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Encode failed'))), type, quality))
}

/** "Same format": JPEG/WebP/PNG stay; photos from phones (HEIC) become JPEG; everything else PNG. */
function keepType(file: Blob): OutFormat {
  if (file.type === 'image/jpeg' || file.type === 'image/webp') return file.type
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test((file as File).name ?? '') ? 'image/jpeg' : 'image/png'
}

function drawOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, o: Overlay) {
  const w = W * o.scale
  const h = (w * o.source.height) / o.source.width
  const margin = Math.min(W, H) * 0.03
  const at = (cx: number, cy: number) => {
    ctx.save()
    ctx.globalAlpha = o.opacity
    ctx.translate(cx, cy)
    ctx.rotate((-o.angle * Math.PI) / 180)
    ctx.drawImage(o.source, -w / 2, -h / 2, w, h)
    ctx.restore()
  }
  if (o.position === 'tile') {
    const step = Math.max(w, h) * 1.5
    for (let y = step / 2; y < H + step / 2; y += step) for (let x = step / 2; x < W + step / 2; x += step) at(x, y)
    return
  }
  const cx = o.position === 'center' ? W / 2 : o.position.endsWith('l') ? margin + w / 2 : W - margin - w / 2
  const cy = o.position === 'center' ? H / 2 : o.position.startsWith('t') ? margin + h / 2 : H - margin - h / 2
  at(cx, cy)
}

export async function processImage(file: Blob, opts: ImageOptions): Promise<ImageResult> {
  const bmp = await decodeImage(file, opts.exif !== false)
  try {
    const { sx, sy, sw, sh } = opts.crop ? pixelRect(opts.crop, bmp.width, bmp.height) : { sx: 0, sy: 0, sw: bmp.width, sh: bmp.height }
    const quarter = opts.rotate === 90 || opts.rotate === 270
    const fit = fitSize(quarter ? sh : sw, quarter ? sw : sh, opts)
    const type: OutFormat =
      opts.format === 'keep' ? keepType(file) : opts.format
    const ico = type === 'image/x-icon'
    const side = Math.min(256, Math.max(fit.width, fit.height))
    const { width, height } = ico ? { width: side, height: side } : fit
    const canvas = makeCanvas(width, height)
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    if (type === 'image/jpeg' || type === 'image/bmp') {
      ctx.fillStyle = '#fff' // no alpha in these formats
      ctx.fillRect(0, 0, width, height)
    }
    ctx.imageSmoothingQuality = 'high'
    if (ico) {
      const k = Math.min(side / sw, side / sh)
      const w = Math.round(sw * k)
      const h = Math.round(sh * k)
      ctx.drawImage(bmp, sx, sy, sw, sh, Math.round((side - w) / 2), Math.round((side - h) / 2), w, h)
      return { blob: await encodeIco(await encode(canvas, 'image/png', 1), side), width, height }
    }
    // Mirror applies to the turned picture, so scale() is set before rotate() (canvas transforms apply last-set first).
    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.scale(opts.flipH ? -1 : 1, opts.flipV ? -1 : 1)
    ctx.rotate(((opts.rotate ?? 0) * Math.PI) / 180)
    ctx.drawImage(bmp, sx, sy, sw, sh, quarter ? -height / 2 : -width / 2, quarter ? -width / 2 : -height / 2, quarter ? height : width, quarter ? width : height)
    ctx.restore()
    if (opts.overlay) drawOverlay(ctx, width, height, opts.overlay)
    if (type === 'image/bmp') return { blob: encodeBmp(ctx, width, height), width, height }
    return { blob: await encode(canvas, type, opts.quality), width, height }
  } finally {
    bmp.close()
  }
}
