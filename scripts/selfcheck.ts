// Zero-framework self-check for the pure PDF/image logic. Run: npm run check
import assert from 'node:assert/strict'
import { crc32, deflateSync } from 'node:zlib'
import { PDFDocument } from 'pdf-lib'
import { chunkPages, mergePdfs, pageCount, parseRanges, rotatePdf, splitPdf, loadPdf } from '../src/lib/pdf/ops.ts'
import loadWASM from '@okathira/ghostpdl-wasm'
import { gsCompress } from '../src/lib/pdf/gsRun.ts'
import { imagesToPdf } from '../src/lib/pdf/fromImages.ts'
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

// image sizing
assert.deepEqual(fitSize(4000, 2000, { maxWidth: 1000, maxHeight: 1000 }), { width: 1000, height: 500 })
assert.deepEqual(fitSize(400, 200, { maxWidth: 1000 }), { width: 400, height: 200 }) // no upscale via max
assert.deepEqual(fitSize(400, 200, { width: 100 }), { width: 100, height: 50 })
assert.deepEqual(fitSize(400, 200, { width: 800, height: 800, contain: true }), { width: 800, height: 400 })
assert.deepEqual(fitSize(400, 200, { width: 100, height: 100 }), { width: 100, height: 100 })
assert.deepEqual(fitSize(400, 200, { scale: 0.5 }), { width: 200, height: 100 })

console.log('selfcheck ok')
