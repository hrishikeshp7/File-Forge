import { PDFDocument } from 'pdf-lib'

export interface PageImage {
  bytes: Uint8Array
  kind: 'jpg' | 'png'
  width: number
  height: number
}
export type PageSize = 'fit' | 'a4' | 'letter'

const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const

/** One image per page. 'fit' makes the page the image's size (96 dpi → points); others center it inside the margin. */
export async function imagesToPdf(images: PageImage[], size: PageSize, margin = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (const im of images) {
    const emb = im.kind === 'jpg' ? await doc.embedJpg(im.bytes) : await doc.embedPng(im.bytes)
    if (size === 'fit') {
      const w = im.width * 0.75
      const h = im.height * 0.75
      doc.addPage([w, h]).drawImage(emb, { x: 0, y: 0, width: w, height: h })
      continue
    }
    const [pw, ph] = im.width > im.height ? [SIZES[size][1], SIZES[size][0]] : SIZES[size]
    const k = Math.min((pw - 2 * margin) / im.width, (ph - 2 * margin) / im.height)
    const w = im.width * k
    const h = im.height * k
    doc.addPage([pw, ph]).drawImage(emb, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
  }
  return doc.save({ useObjectStreams: true })
}
