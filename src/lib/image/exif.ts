// Lossless metadata stripping for JPEG and PNG, plus a small EXIF reader (orientation, GPS, camera).
// Pure bytes in/out so it runs in node for the self-check.

export interface ExifSummary {
  orientation: number
  hasGps: boolean
  make?: string
  model?: string
  date?: string
}

const u16 = (b: Uint8Array, o: number, le: boolean) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1])
const u32 = (b: Uint8Array, o: number, le: boolean) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0)
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to)).replace(/\0.*$/s, '').trim()

/** Parse a TIFF block (the payload of an Exif APP1 segment, after "Exif\0\0"). */
export function readTiff(t: Uint8Array): ExifSummary {
  const out: ExifSummary = { orientation: 1, hasGps: false }
  if (t.length < 8) return out
  const le = t[0] === 0x49
  if (!le && t[0] !== 0x4d) return out
  const entries = (ifd: number) => {
    if (ifd + 2 > t.length) return []
    const n = Math.min(u16(t, ifd, le), 200)
    return Array.from({ length: n }, (_, i) => ifd + 2 + i * 12).filter((o) => o + 12 <= t.length)
  }
  const text = (o: number) => {
    const count = u32(t, o + 4, le)
    const at = count > 4 ? u32(t, o + 8, le) : o + 8
    return at + count <= t.length ? ascii(t, at, at + count) : undefined
  }
  let exifIfd = 0
  for (const o of entries(u32(t, 4, le))) {
    const tag = u16(t, o, le)
    if (tag === 0x0112) out.orientation = u16(t, o + 8, le)
    else if (tag === 0x010f) out.make = text(o)
    else if (tag === 0x0110) out.model = text(o)
    else if (tag === 0x8825) out.hasGps = entries(u32(t, o + 8, le)).length > 0
    else if (tag === 0x8769) exifIfd = u32(t, o + 8, le)
  }
  if (exifIfd) for (const o of entries(exifIfd)) if (u16(t, o, le) === 0x9003) out.date = text(o)
  return out
}

const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8
const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47

/** Walk JPEG segments up to the scan data. Returns [marker, start, end] per segment (end exclusive) and where scan data begins. */
function jpegSegments(b: Uint8Array): { segs: [number, number, number][]; scan: number } {
  const segs: [number, number, number][] = []
  let i = 2
  while (i + 4 <= b.length && b[i] === 0xff) {
    const m = b[i + 1]
    if (m === 0xda) break // SOS: entropy-coded data follows, copy verbatim
    if (m === 0xff) { i++; continue }
    const len = (b[i + 2] << 8) | b[i + 3]
    segs.push([m, i, i + 2 + len])
    i += 2 + len
  }
  return { segs, scan: i }
}

/**
 * End (exclusive) of the main image: walk the entropy-coded data, skipping stuffed FF00 and restart markers, and stop at EOI.
 * Phones append extra pictures (depth/HDR gain maps, each with its own Exif) after it; those must not be copied.
 */
function mainImageEnd(b: Uint8Array, from: number): number {
  let i = from
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) { i++; continue }
    const n = b[i + 1]
    if (n === 0 || (n >= 0xd0 && n <= 0xd7)) i += 2
    else if (n === 0xff) i++
    else if (n === 0xd9) return i + 2
    else i += 2 + ((b[i + 2] << 8) | b[i + 3]) // another segment (DHT, SOS of a progressive scan, ...): skip by length
  }
  return b.length
}

const hasPrefix = (b: Uint8Array, at: number, s: string) => [...s].every((c, k) => b[at + k] === c.charCodeAt(0))

export function readExif(b: Uint8Array): ExifSummary | null {
  if (isJpeg(b)) {
    const { segs } = jpegSegments(b)
    for (const [m, s, e] of segs) if (m === 0xe1 && hasPrefix(b, s + 4, 'Exif\0\0')) return readTiff(b.subarray(s + 10, e))
    return null
  }
  if (isPng(b)) {
    for (let i = 8; i + 12 <= b.length; ) {
      const len = u32(b, i, false)
      if (ascii(b, i + 4, i + 8) === 'eXIf') return readTiff(b.subarray(i + 8, i + 8 + len))
      i += 12 + len
    }
  }
  return null
}

/** Minimal Exif APP1 holding only the orientation tag (keeps a rotated photo upright after stripping). */
function orientationOnly(o: number): Uint8Array {
  const tiff = [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0]
  const body = [...'Exif'].map((c) => c.charCodeAt(0)).concat([0, 0], tiff)
  const len = body.length + 2
  return new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, ...body])
}

export interface Stripped {
  bytes: Uint8Array
  /** What was removed, for the result note. */
  removed: string[]
}

/** Remove Exif/XMP/IPTC/comments/thumbnails; keep ICC colour profile, JFIF and Adobe markers. Scan data is copied byte for byte. */
export function stripJpeg(b: Uint8Array): Stripped {
  const { segs, scan } = jpegSegments(b)
  const parts: Uint8Array[] = [b.subarray(0, 2)]
  const removed: string[] = []
  let orientation = 1
  const kept: [number, number][] = []
  for (const [m, s, e] of segs) {
    const isExif = m === 0xe1 && hasPrefix(b, s + 4, 'Exif\0\0')
    const isIcc = m === 0xe2 && hasPrefix(b, s + 4, 'ICC_PROFILE\0')
    const isJfif = m === 0xe0 && hasPrefix(b, s + 4, 'JFIF\0') // a JFXX APP0 carries a thumbnail: drop it
    const keep = m === 0xe0 ? isJfif : !(m >= 0xe1 && m <= 0xef) && m !== 0xfe ? true : m === 0xee || isIcc
    if (isExif) {
      const x = readTiff(b.subarray(s + 10, e))
      orientation = x.orientation
      removed.push(x.hasGps ? 'Exif incl. GPS location' : 'Exif')
    } else if (m === 0xe1) removed.push('XMP')
    else if (m === 0xed) removed.push('IPTC')
    else if (m === 0xfe) removed.push('comment')
    else if (!keep) removed.push('extra data')
    if (keep) kept.push([s, e])
  }
  const firstIsJfif = kept.length > 0 && b[kept[0][0] + 1] === 0xe0
  kept.forEach(([s, e], i) => {
    parts.push(b.subarray(s, e))
    if (i === 0 && firstIsJfif && orientation !== 1) parts.push(orientationOnly(orientation))
  })
  if (!firstIsJfif && orientation !== 1) parts.splice(1, 0, orientationOnly(orientation))
  const end = mainImageEnd(b, scan)
  parts.push(b.subarray(scan, end))
  if (end < b.length) removed.push('extra embedded pictures (depth/HDR maps)')
  return { bytes: concat(parts), removed: [...new Set(removed)] }
}

const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'])

/** Drop text/Exif/time chunks; colour chunks (iCCP, sRGB, gAMA, cHRM) stay. */
export function stripPng(b: Uint8Array): Stripped {
  const parts: Uint8Array[] = [b.subarray(0, 8)]
  const removed = new Set<string>()
  for (let i = 8; i + 12 <= b.length; ) {
    const len = u32(b, i, false)
    const type = ascii(b, i + 4, i + 8)
    if (PNG_DROP.has(type)) removed.add(type === 'eXIf' ? 'Exif' : type === 'tIME' ? 'timestamp' : 'text/XMP')
    else parts.push(b.subarray(i, i + 12 + len))
    i += 12 + len
  }
  return { bytes: concat(parts), removed: [...removed] }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) (out.set(p, o), (o += p.length))
  return out
}

export const kindOf = (b: Uint8Array): 'jpeg' | 'png' | 'other' => (isJpeg(b) ? 'jpeg' : isPng(b) ? 'png' : 'other')
