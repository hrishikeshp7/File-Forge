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

// image sizing
assert.deepEqual(fitSize(4000, 2000, { maxWidth: 1000, maxHeight: 1000 }), { width: 1000, height: 500 })
assert.deepEqual(fitSize(400, 200, { maxWidth: 1000 }), { width: 400, height: 200 }) // no upscale via max
assert.deepEqual(fitSize(400, 200, { width: 100 }), { width: 100, height: 50 })
assert.deepEqual(fitSize(400, 200, { width: 800, height: 800, contain: true }), { width: 800, height: 400 })
assert.deepEqual(fitSize(400, 200, { width: 100, height: 100 }), { width: 100, height: 100 })
assert.deepEqual(fitSize(400, 200, { scale: 0.5 }), { width: 200, height: 100 })

console.log('selfcheck ok')
