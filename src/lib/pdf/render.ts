// pdf.js wrapper: thumbnails and page rasterizing. Browser only.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const asset = (dir: string) => new URL(`${import.meta.env.BASE_URL}pdfjs/${dir}/`, document.baseURI).href

export type PdfDoc = pdfjs.PDFDocumentProxy

export const openPdf = (bytes: Uint8Array): Promise<PdfDoc> =>
  pdfjs.getDocument({
    data: bytes.slice(), // pdf.js detaches the buffer it is given
    cMapUrl: asset('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: asset('standard_fonts'),
    wasmUrl: asset('wasm'),
    iccUrl: asset('iccs'),
  }).promise

export const closePdf = (doc: PdfDoc) => doc.loadingTask.destroy()

async function renderToCanvas(doc: PdfDoc, pageNo: number, scale: number) {
  const page = await doc.getPage(pageNo)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')!
  await page.render({ canvas, canvasContext: ctx, viewport, background: '#fff' }).promise
  page.cleanup()
  return canvas
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Encode failed'))), type, q))

/** Page preview as an object URL plus the page's visible size in PDF points (what crop/placement fractions refer to). */
export async function renderPreview(doc: PdfDoc, pageNo: number, side: number): Promise<{ url: string; width: number; height: number }> {
  const { width, height } = (await doc.getPage(pageNo)).getViewport({ scale: 1 })
  return { url: await renderThumb(doc, pageNo, side), width, height }
}

/** Thumbnail as an object URL (caller revokes). `side` = longest edge in px. */
export async function renderThumb(doc: PdfDoc, pageNo: number, side: number): Promise<string> {
  const page = await doc.getPage(pageNo)
  const { width, height } = page.getViewport({ scale: 1 })
  const canvas = await renderToCanvas(doc, pageNo, side / Math.max(width, height))
  return URL.createObjectURL(await toBlob(canvas, 'image/jpeg', 0.8))
}

const MAX_SIDE = 4096 // keeps canvas memory sane on phones

/** One page as an image blob. `dpi` is clamped so the longest side stays under MAX_SIDE. */
export async function renderPageBlob(doc: PdfDoc, pageNo: number, dpi: number, type: 'image/jpeg' | 'image/png', quality = 0.92) {
  const page = await doc.getPage(pageNo)
  const { width, height } = page.getViewport({ scale: 1 }) // PDF points
  const canvas = await renderToCanvas(doc, pageNo, Math.min(dpi / 72, MAX_SIDE / Math.max(width, height)))
  const blob = await toBlob(canvas, type, quality)
  canvas.width = canvas.height = 0 // free pixel memory now
  return blob
}
