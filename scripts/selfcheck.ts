// Zero-framework self-check for the pure PDF/image logic. Run: npm run check
import assert from 'node:assert/strict'
import { crc32, deflateSync } from 'node:zlib'
import { PDFDocument, concatTransformationMatrix, pushGraphicsState } from 'pdf-lib'
import { chunkPages, mergePdfs, pageCount, parseRanges, rotatePdf, splitPdf, loadPdf } from '../src/lib/pdf/ops.ts'
import loadWASM from '@okathira/ghostpdl-wasm'
import { gsCompress } from '../src/lib/pdf/gsRun.ts'
import { imagesToPdf } from '../src/lib/pdf/fromImages.ts'
import { organizePdf, protectPdf, unlockPdf } from '../src/lib/pdf/mupdfRun.ts'
import { addPageNumbers, addWatermark } from '../src/lib/pdf/mark.ts'
import { readExif, stripJpeg, stripPng } from '../src/lib/image/exif.ts'
import { readMeta, writeMeta } from '../src/lib/pdf/meta.ts'
import { eraseOutside, flattenPdf } from '../src/lib/pdf/mupdfRun.ts'
import { addPicture, cropPages } from '../src/lib/pdf/mark.ts'
import { initialRect, moveRect, pixelRect, resizeRect } from '../src/lib/rect.ts'
import { readFileSync } from 'node:fs'
import { fitSize } from '../src/lib/image/process.ts'


async function makePdf(pages: number, size: [number, number] = [200, 300]) {
  const d = await PDFDocument.create()
  for (let i = 0; i < pages; i++) d.addPage(size)
  return d.save()
}

// merge
const a = await makePdf(2), b = await makePdf(3)
const merged = await mergePdfs([a, b])
assert.equal(await pageCount(merged), 5)

// ranges
assert.deepEqual(parseRanges('1-3, 5', 5), [[0, 1, 2], [4]])
assert.deepEqual(parseRanges('4-', 5), [[3, 4]])
assert.throws(() => parseRanges('9', 5))
assert.throws(() => parseRanges('3-1', 5))
assert.throws(() => parseRanges('', 5))
assert.deepEqual(chunkPages(5, 2), [[0, 1], [2, 3], [4]])

// split
const parts = await splitPdf(merged, [[0, 1], [4]])
assert.deepEqual(await Promise.all(parts.map(pageCount)), [2, 1])

// rotate: delta applies on top of existing rotation, wraps at 360
const rot = await rotatePdf(merged, [90, 0, -90, 0, 270])
const angles = (await loadPdf(rot)).getPages().map((p) => p.getRotation().angle)
assert.deepEqual(angles, [90, 0, 270, 0, 270])
const rot2 = await rotatePdf(rot, [270, 0, 90, 0, 90])
assert.deepEqual((await loadPdf(rot2)).getPages().map((p) => p.getRotation().angle), [0, 0, 0, 0, 0])

// compress (Ghostscript wasm): shrinks an image-heavy PDF, keeps page count, rejects garbage
function noisyPng(n: number): Uint8Array {
  const raw = Buffer.alloc(n * (n * 3 + 1))
  let seed = 7
  for (let y = 0; y < n; y++) for (let i = 0; i < n * 3; i++) raw[y * (n * 3 + 1) + 1 + i] = ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 24) & 0xff
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 2
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
}
const src = await PDFDocument.create()
const img = await src.embedPng(noisyPng(500)) // Flate image: what the old JPEG-only path could not shrink
for (let i = 0; i < 2; i++) src.addPage([300, 300]).drawImage(img, { x: 0, y: 0, width: 300, height: 300 })
const srcBytes = await src.save()
const out = await gsCompress((h) => loadWASM(h), srcBytes, 'strong')
assert.equal(await pageCount(out), 2)
assert.ok(out.length < srcBytes.length, `gs output ${out.length} < ${srcBytes.length}`)
assert.equal(await pageCount(await gsCompress((h) => loadWASM(h), a, 'balanced')), 2)
await assert.rejects(gsCompress((h) => loadWASM(h), new Uint8Array([1, 2, 3]), 'light'))

// images -> PDF: A4 portrait/landscape by image shape, 'fit' follows image size
const png = noisyPng(40)
const pdfImgs = await imagesToPdf([{ bytes: png, kind: 'png', width: 40, height: 80 }, { bytes: png, kind: 'png', width: 80, height: 40 }], 'a4', 10)
const sizes = (await loadPdf(pdfImgs)).getPages().map((p) => p.getSize())
assert.equal(sizes.length, 2)
assert.ok(sizes[0].height > sizes[0].width && sizes[1].width > sizes[1].height)
const fit = (await loadPdf(await imagesToPdf([{ bytes: png, kind: 'png', width: 40, height: 80 }], 'fit'))).getPage(0).getSize()
assert.deepEqual([fit.width, fit.height], [30, 60])

// ---- MuPDF: protect / unlock / organize ----
async function gsPages(bytes: Uint8Array, password?: string): Promise<number> {
  let pages = 0
  const gs = await loadWASM({ print: (l: string) => void (pages = Number(/through (\d+)/.exec(l)?.[1] ?? pages)), printErr: () => {} })
  gs.FS.writeFile('in.pdf', bytes)
  gs.callMain(['-sDEVICE=nullpage', '-dNOPAUSE', '-dBATCH', ...(password ? [`-sPDFPassword=${password}`] : []), 'in.pdf'])
  return pages
}
const ALL = { print: true, copy: true, edit: true }
for (const pw of ['plain', 'x=y', 'sp ace', 'quo"te', 'पासवर्ड']) {
  const locked = protectPdf(merged, pw, ALL)
  assert.equal(await pageCount(unlockPdf(locked, pw)), 5, `round-trip ${pw}`)
  assert.throws(() => unlockPdf(locked, pw + 'x'), /Wrong password/)
  assert.throws(() => unlockPdf(locked, ''), /Enter the password/)
}
assert.throws(() => protectPdf(merged, 'a,b', ALL), /comma/)
const lockedGs = protectPdf(merged, 'secret', ALL) // second reader must accept the same password
assert.equal(await gsPages(lockedGs, 'secret'), 5, 'ghostscript reads it with the right password')
assert.equal(await gsPages(lockedGs, 'nope'), 0, 'ghostscript cannot read it with a wrong password')
assert.ok(!Buffer.from(unlockPdf(lockedGs, 'secret')).includes('/Encrypt'))
assert.throws(() => unlockPdf(merged, ''), /not protected/)
// permissions are really written
const mu = await import('mupdf')
const noPrint = mu.Document.openDocument(protectPdf(merged, 'pw', { print: false, copy: false, edit: true }), 'application/pdf')
noPrint.authenticatePassword('pw')
assert.equal(noPrint.hasPermission('print'), false)
assert.equal(noPrint.hasPermission('copy'), false)
// owner-only restricted PDF (no user password) opens freely; unlock strips the restrictions
const ownerOnly = (mu.Document.openDocument(merged, 'application/pdf') as import('mupdf').PDFDocument).saveToBuffer('encrypt=aes-256,owner-password=o,permissions=-3904').asUint8Array()
assert.ok(Buffer.from(unlockPdf(ownerOnly, '')).indexOf('/Encrypt') < 0)

// organize: reorder, drop, duplicate (widths identify pages)
const w3 = await PDFDocument.create()
;[100, 200, 300].forEach((w) => w3.addPage([w, 100]))
const w3b = await w3.save()
const widths = async (b: Uint8Array) => (await loadPdf(b)).getPages().map((p) => p.getSize().width)
assert.deepEqual(await widths(organizePdf(w3b, [2, 0, 0])), [300, 100, 100])
assert.deepEqual(await widths(organizePdf(w3b, [1])), [200])
assert.throws(() => organizePdf(w3b, []))

// ---- watermark / page numbers land in the right place on real-world-shaped pages ----
function solidPng(n: number, rgb: [number, number, number]): Uint8Array {
  const raw = Buffer.alloc(n * (n * 3 + 1))
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) raw.set(rgb, y * (n * 3 + 1) + 1 + x * 3)
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 2
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
}
async function render(pdf: Uint8Array) {
  const log: string[] = []
  const gs = await loadWASM({ print: (l: string) => log.push(l), printErr: (l: string) => log.push(l) })
  gs.FS.writeFile('in.pdf', pdf)
  gs.callMain(['-sDEVICE=bmp16m', '-r72', '-dUseCropBox', '-dNOPAUSE', '-dBATCH', '-dQUIET', '-sOutputFile=out.bmp', 'in.pdf'])
  let bmp: Uint8Array
  try {
    bmp = gs.FS.readFile('out.bmp')
  } catch {
    throw new Error('render failed: ' + log.join(' | '))
  }
  const dv = new DataView(bmp.buffer, bmp.byteOffset)
  const w = dv.getInt32(18, true), h = dv.getInt32(22, true), off = dv.getUint32(10, true)
  const stride = Math.ceil((w * 3) / 4) * 4
  // 24-bit bottom-up BGR → [r,g,b] at (x,y) from the top-left
  return { w, h, px: (x: number, y: number) => { const o = off + (h - 1 - Math.round(y)) * stride + Math.round(x) * 3; return [bmp[o + 2], bmp[o + 1], bmp[o]] } }
}
const isRed = ([r, g, b]: number[]) => r > 200 && g < 90 && b < 90
const isWhite = ([r, g, b]: number[]) => r > 245 && g > 245 && b > 245
const red = solidPng(20, [255, 0, 0])
const mark = { png: red, width: 20, height: 20, scale: 0.2, opacity: 1, angle: 0, mode: 'center' as const }

// (a) page whose content leaves the CTM scaled/moved (unbalanced q + cm)
const dirty = await PDFDocument.create()
const dp = dirty.addPage([200, 300])
dp.pushOperators(pushGraphicsState(), concatTransformationMatrix(0.5, 0, 0, 0.5, 100, 100))
let r = await render(await addWatermark(await dirty.save(), mark))
assert.ok(isRed(r.px(100, 150)), 'center is red despite dirty content state')
assert.ok(isWhite(r.px(10, 10)), 'corner untouched')

// (b) /Rotate 90: visual page is 300x200, mark still centered
const rotated = await PDFDocument.create()
rotated.addPage([200, 300]).setRotation((await import('pdf-lib')).degrees(90))
r = await render(await addWatermark(await rotated.save(), mark))
assert.equal(r.w, 300)
assert.ok(isRed(r.px(150, 100)), 'rotated page: center is red')

// (c) crop box with an origin offset
const cropped = await PDFDocument.create()
cropped.addPage([400, 400]).setCropBox(100, 100, 200, 200)
r = await render(await addWatermark(await cropped.save(), mark))
assert.equal(r.w, 200)
assert.ok(isRed(r.px(100, 100)), 'cropped page: center is red')

// (d) page numbers: bottom-left of the *visible* page, also on a rotated page
const numbered = (await PDFDocument.create())
numbered.addPage([200, 300]).setRotation((await import('pdf-lib')).degrees(90))
r = await render(await addPageNumbers(await numbered.save(), { format: '{n}', position: 'bl', start: 1, size: 40, margin: 10 }))
const dark = (x0: number, y0: number, x1: number, y1: number) => {
  let n = 0
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (r.px(x, y)[0] < 100) n++
  return n
}
assert.ok(dark(10, r.h - 52, 40, r.h - 8) > 20, 'number sits bottom-left of rotated page')
assert.equal(dark(0, 0, 100, 60), 0, 'nothing top-left')
await assert.rejects(addPageNumbers(merged, { format: 'पेज {n}', position: 'bc', start: 1, size: 12, margin: 10 }), /Latin/)

// ---- drag-box geometry ----
const R = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 }
assert.deepEqual(moveRect(R, 1, 1), { x: 0.6, y: 0.6, w: 0.4, h: 0.4 }, 'move clamps to the image')
assert.deepEqual(moveRect(R, -1, -1), { x: 0, y: 0, w: 0.4, h: 0.4 })
let r2 = resizeRect(R, 'se', 5, 5, { min: 0.05 }); assert.deepEqual([r2.x + r2.w, r2.y + r2.h], [1, 1], 'free resize clamps at the edge')
r2 = resizeRect(R, 'nw', 5, 5, { min: 0.05 }); assert.ok(Math.abs(r2.w - 0.05) < 1e-9 && Math.abs(r2.x + r2.w - 0.6) < 1e-9, 'min size, opposite edge fixed')
for (const h of ['nw', 'ne', 'se', 'sw'] as const) for (const [dx, dy] of [[0.3, 0.1], [-0.5, 0.4], [0.9, 0.9], [-0.9, -0.9]]) {
  const q = resizeRect(R, h, dx, dy, { min: 0.05, aspect: 2 })
  assert.ok(Math.abs(q.w / q.h - 2) < 1e-9, `aspect kept ${h} ${dx},${dy}`)
  assert.ok(q.x >= -1e-9 && q.y >= -1e-9 && q.x + q.w <= 1 + 1e-9 && q.y + q.h <= 1 + 1e-9, `inside image ${h} ${dx},${dy}`)
}
const ir = initialRect(16 / 9 * (900 / 1600)); assert.ok(Math.abs(ir.w / ir.h - 16 / 9 * (900 / 1600)) < 1e-9 && ir.x + ir.w <= 1 && ir.y + ir.h <= 1)
assert.deepEqual(pixelRect({ x: 0.333, y: 0.5, w: 0.5, h: 0.6 }, 100, 50), { sx: 33, sy: 25, sw: 50, sh: 25 })

// ---- lossless metadata stripping ----
const jpg = new Uint8Array(readFileSync(new URL('./fixtures/exif.jpg', import.meta.url)))
const before = readExif(jpg)!
assert.deepEqual([before.orientation, before.hasGps, before.make, before.date], [6, true, 'TestCam', '2026:01:02 03:04:05'])
const sj = stripJpeg(jpg)
const after = readExif(sj.bytes)!
assert.equal(after.hasGps, false, 'GPS gone'); assert.equal(after.make, undefined, 'camera info gone'); assert.equal(after.orientation, 6, 'orientation kept so the photo stays upright')
assert.ok(Buffer.from(sj.bytes).includes('ICC_PROFILE'), 'ICC colour profile kept')
assert.ok(!Buffer.from(sj.bytes).includes('secret note'), 'comment removed')
const sosAt = (b: Uint8Array) => { for (let i = 2; i + 1 < b.length; ) { if (b[i + 1] === 0xda) return i; i += 2 + ((b[i + 2] << 8) | b[i + 3]) } return -1 }
assert.deepEqual(sj.bytes.subarray(sosAt(sj.bytes)), jpg.subarray(sosAt(jpg)), 'compressed image data is byte-identical')
const mj = mu.Image && new mu.Image(sj.bytes); assert.deepEqual([mj.getWidth(), mj.getHeight()], [48, 32], 'result still decodes')
assert.ok(sj.removed.includes('Exif incl. GPS location'))

// Phone-style JPEG: no JFIF APP0, and a second complete picture (with its own Exif/GPS) appended after the main EOI
{
  const segEnd = (i: number) => i + 2 + ((jpg[i + 2] << 8) | jpg[i + 3])
  assert.equal(jpg[3], 0xe0, 'fixture starts with JFIF APP0')
  const noJfif = Uint8Array.from([...jpg.subarray(0, 2), ...jpg.subarray(segEnd(2))])
  const phone = Uint8Array.from([...noJfif, ...jpg]) // main picture + embedded second picture
  const out = stripJpeg(phone)
  const text = Buffer.from(out.bytes)
  assert.ok(!text.includes('TestCam') && !text.includes('Model X') && !text.includes('2026:01:02'), 'no camera/date bytes anywhere, including the appended picture')
  assert.equal(readExif(out.bytes)?.hasGps, false, 'no GPS')
  assert.equal(readExif(out.bytes)?.orientation, 6, 'orientation kept (minimal Exif inserted, no JFIF to follow)')
  assert.ok(text.includes('ICC_PROFILE'), 'ICC kept')
  assert.deepEqual([...out.bytes.subarray(-2)], [0xff, 0xd9], 'ends at the main EOI')
  assert.ok(out.bytes.length < phone.length / 2 + 200 && out.removed.some((x) => x.includes('extra embedded')))
  const mi = new mu.Image(out.bytes); assert.deepEqual([mi.getWidth(), mi.getHeight()], [48, 32], 'still decodes')
  // JFXX thumbnail APP0 is dropped, JFIF kept
  const jfxx = Uint8Array.from([0xff, 0xe0, 0, 16, ...'JFXX\0'.split('').map((c) => c.charCodeAt(0)), 0x10, 1, 1, 0, 0, 0, 0, 0, 0])
  const withJfxx = Uint8Array.from([...jpg.subarray(0, segEnd(2)), ...jfxx, ...jpg.subarray(segEnd(2))])
  assert.ok(!Buffer.from(stripJpeg(withJfxx).bytes).includes('JFXX') && Buffer.from(stripJpeg(withJfxx).bytes).includes('JFIF'))
}

const metaPng = new Uint8Array(readFileSync(new URL('./fixtures/meta.png', import.meta.url)))
const sp = stripPng(metaPng)
assert.ok(metaPng.length > sp.bytes.length && !Buffer.from(sp.bytes).includes('Someone') && !Buffer.from(sp.bytes).includes('eXIf'), 'png text and exif removed')
assert.ok(Buffer.from(sp.bytes).includes('iCCP'), 'png colour profile kept')
const mp = new mu.Image(sp.bytes); assert.deepEqual([mp.getWidth(), mp.getHeight()], [48, 32])

// ---- PDF metadata ----
{
  const d = await PDFDocument.create(); d.addPage([200, 200]); d.setTitle('Old title'); d.setAuthor('Old author')
  const xmp = d.context.stream('<x:xmpmeta><dc:title>Old title</dc:title></x:xmpmeta>', { Type: 'Metadata', Subtype: 'XML' })
  d.catalog.set((await import('pdf-lib')).PDFName.of('Metadata'), d.context.register(xmp))
  const src = await d.save()
  const m0 = await readMeta(src); assert.deepEqual([m0.Title, m0.hasXmp], ['Old title', true])
  const edited = await writeMeta(src, { Title: 'Neuer Titel ✓', Author: '' })
  const m1 = await readMeta(edited)
  assert.deepEqual([m1.Title, m1.Author, m1.hasXmp], ['Neuer Titel ✓', '', false], 'edit applied, stale XMP dropped')
  assert.equal(m1.Producer, m0.Producer, 'untouched fields keep their value (no pdf-lib stamp)')
  const reader = mu.Document.openDocument(edited, 'application/pdf')
  assert.equal(reader.getMetaData('info:Title'), 'Neuer Titel ✓', 'second reader agrees')
  const stripped = await writeMeta(src, {}, true)
  const m2 = await readMeta(stripped)
  assert.deepEqual([m2.Title, m2.Author, m2.Producer, m2.hasXmp], ['', '', '', false])
  assert.equal(mu.Document.openDocument(stripped, 'application/pdf').getMetaData('info:Title') ?? '', '')
}

// ---- flatten (MuPDF bake) ----
{
  const d = await PDFDocument.create(); const pg = d.addPage([300, 200])
  const form = d.getForm(); const f = form.createTextField('name'); f.setText('HELLOWORLD'); f.addToPage(pg, { x: 20, y: 120, width: 200, height: 40, borderWidth: 0 })
  const src = await d.save()
  const widgets = (b: Uint8Array) => (mu.Document.openDocument(b, 'application/pdf') as import('mupdf').PDFDocument).loadPage(0).getWidgets().length
  assert.equal(widgets(src), 1)
  const flat = flattenPdf(src)
  assert.equal(widgets(flat), 0, 'no fields remain')
  assert.ok(!Buffer.from(flat).includes('/AcroForm') || widgets(flat) === 0)
  r = await render(flat)
  let ink = 0
  for (let y = 40; y < 80; y++) for (let x = 20; x < 220; x++) if (r.px(x, y)[0] < 100) ink++
  assert.ok(ink > 40, `the typed value is still visible after flattening (${ink} dark px)`)
}

// ---- crop PDF ----
{
  const d = await PDFDocument.create(); d.addPage([400, 400]).drawRectangle({ x: 115, y: 115, width: 20, height: 20, color: (await import('pdf-lib')).rgb(1, 0, 0) })
  const out = await cropPages(await d.save(), { x: 0.2, y: 0.5, w: 0.3, h: 0.3 })
  r = await render(out)
  assert.deepEqual([r.w, r.h], [120, 120], 'crop box size')
  assert.ok(isRed(r.px(45, 75)), 'cropped content in the right place')
  assert.deepEqual([r.w, r.h], [(await render(await gsCompress((h) => loadWASM(h), out, 'balanced'))).w, 120], 'Ghostscript compress keeps the crop')
  // rotated page: visual 300x200, crop the bottom-right quarter; marker sits there
  const rd = await PDFDocument.create(); const rp = rd.addPage([200, 300]); rp.setRotation((await import('pdf-lib')).degrees(90))
  rp.drawRectangle({ x: 140, y: 215, width: 20, height: 20, color: (await import('pdf-lib')).rgb(1, 0, 0) }) // content (150,225) = visual (225, 50 from bottom)
  r = await render(await cropPages(await rd.save(), { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }))
  assert.deepEqual([r.w, r.h], [150, 100], 'rotated page crop size')
  assert.ok(isRed(r.px(75, 50)), 'rotated page: marker is centred in the crop')
}

// ---- picture/signature placement ----
{
  const flatPage = await PDFDocument.create(); flatPage.addPage([200, 300])
  r = await render(await addPicture(await flatPage.save(), red, 1, [{ page: 0, cx: 0.25, cy: 0.75, w: 0.2 }]))
  assert.ok(isRed(r.px(50, 225)), 'picture centred at (25%, 75% from top)')
  assert.ok(isWhite(r.px(150, 50)))
  const rotPage = await PDFDocument.create(); rotPage.addPage([200, 300]).setRotation((await import('pdf-lib')).degrees(90))
  r = await render(await addPicture(await rotPage.save(), red, 1, [{ page: 0, cx: 0.25, cy: 0.75, w: 0.2 }]))
  assert.deepEqual([r.w, r.h], [300, 200]); assert.ok(isRed(r.px(75, 150)), 'rotated page: same visual spot')
}

// ---- crop that really deletes what is outside ----
{
  const pdfLib = await import('pdf-lib')
  const mkDoc = async (rotate: number) => {
    const d = await PDFDocument.create(); const f = await d.embedFont(pdfLib.StandardFonts.Helvetica)
    const p = d.addPage([400, 400]); if (rotate) p.setRotation(pdfLib.degrees(rotate))
    p.drawText('SECRETOUTSIDE', { x: 20, y: 370, size: 20, font: f }) // top-left of the content
    p.drawText('KEEPINSIDE', { x: 150, y: 190, size: 20, font: f })
    p.drawImage(await d.embedPng(noisyPng(120)), { x: 10, y: 10, width: 120, height: 120 }) // bottom-left photo, to be cropped away
    return d.save()
  }
  const textOf = (b: Uint8Array) => (mu.Document.openDocument(b, 'application/pdf') as import('mupdf').PDFDocument).loadPage(0).toStructuredText('preserve-whitespace').asText()
  // unrotated: keep the middle band (x 100-300, y from top 140-240 → content y 160-260)
  const src = await mkDoc(0)
  const keep = { x: 0.25, y: 0.35, w: 0.5, h: 0.25 }
  const erased = eraseOutside(src, keep)
  assert.ok(textOf(erased).includes('KEEPINSIDE'), 'text inside the box is kept')
  assert.ok(!textOf(erased).includes('SECRETOUTSIDE'), 'text outside is gone')
  assert.ok(erased.length < src.length * 0.6, `image data outside is removed (${src.length} -> ${erased.length})`)
  // the crop box can be thrown away afterwards and the deleted content does not come back
  const cropped = await cropPages(erased, keep)
  const stripped = await PDFDocument.load(cropped); stripped.getPage(0).node.delete(pdfLib.PDFName.of('CropBox'))
  assert.ok(!textOf(await stripped.save()).includes('SECRETOUTSIDE'), 'still gone with the crop box removed')
  r = await render(cropped); assert.deepEqual([r.w, r.h], [200, 100], 'crop box applied')
  let ink = 0; for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.px(x, y)[0] < 100) ink++
  assert.ok(ink > 30, 'the kept text is still drawn')
  // /Rotate 90: fractions refer to the visible page. KEEPINSIDE runs down the page at x≈190, y≈150..250 (from the top).
  const keep90 = { x: 0.4, y: 0.3, w: 0.2, h: 0.4 }
  const rot = eraseOutside(await mkDoc(90), keep90)
  assert.ok(textOf(rot).includes('KEEPINSIDE'), 'rotated page: text inside kept whole')
  assert.ok(!textOf(rot).includes('SECRETOUTSIDE'), 'rotated page: text outside gone')
  assert.ok(rot.length < src.length * 0.6, 'rotated page: image outside removed')
  // text touching the box edge is not lost: a title 4pt inside a tight margin crop survives, while a line cut by the edge keeps its visible part
  const edge = await PDFDocument.create(); const ef = await edge.embedFont(pdfLib.StandardFonts.Helvetica); const ep = edge.addPage([600, 800])
  ep.drawText('TITLE', { x: 50, y: 770, size: 24, font: ef }) // line box reaches ~30pt from the top
  ep.drawText('CUTTHROUGHHERE', { x: 300, y: 400, size: 20, font: ef }) // box edge at x=360 slices through it
  const edgeOut = eraseOutside(await edge.save(), { x: 0.05, y: 0.03, w: 0.55, h: 0.94 }) // keeps x 30..360, y 24..776
  const et = textOf(edgeOut)
  assert.ok(et.includes('TITLE'), 'title near the margin survives')
  assert.ok(et.includes('CUTTH') && !et.includes('CUTTHROUGHHERE'), 'characters wholly outside are removed, visible ones stay: ' + JSON.stringify(et.trim()))
}

// image sizing
assert.deepEqual(fitSize(4000, 2000, { maxWidth: 1000, maxHeight: 1000 }), { width: 1000, height: 500 })
assert.deepEqual(fitSize(400, 200, { maxWidth: 1000 }), { width: 400, height: 200 }) // no upscale via max
assert.deepEqual(fitSize(400, 200, { width: 100 }), { width: 100, height: 50 })
assert.deepEqual(fitSize(400, 200, { width: 800, height: 800, contain: true }), { width: 800, height: 400 })
assert.deepEqual(fitSize(400, 200, { width: 100, height: 100 }), { width: 100, height: 100 })
assert.deepEqual(fitSize(400, 200, { scale: 0.5 }), { width: 200, height: 100 })

console.log('selfcheck ok')
