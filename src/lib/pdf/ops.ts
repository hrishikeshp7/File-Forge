// Pure PDF operations on bytes (no DOM) so they run in node for the self-check.
import { PDFDocument, degrees } from 'pdf-lib'

export const loadPdf = (bytes: Uint8Array) => PDFDocument.load(bytes)

export async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await loadPdf(bytes)).getPageCount()
}

export async function mergePdfs(inputs: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const bytes of inputs) {
    const src = await loadPdf(bytes)
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  return out.save({ useObjectStreams: true })
}

/** Copy the given 0-based page groups into one PDF per group. */
export async function splitPdf(bytes: Uint8Array, groups: number[][]): Promise<Uint8Array[]> {
  const src = await loadPdf(bytes)
  const outs: Uint8Array[] = []
  for (const group of groups) {
    const doc = await PDFDocument.create()
    const pages = await doc.copyPages(src, group)
    pages.forEach((p) => doc.addPage(p))
    outs.push(await doc.save({ useObjectStreams: true }))
  }
  return outs
}

/** "1-3, 5, 8-" → [[0,1,2],[4],[7..n-1]]. One group per comma part. Throws on bad input. */
export function parseRanges(spec: string, total: number): number[][] {
  const groups: number[][] = []
  for (const raw of spec.split(',')) {
    const part = raw.trim()
    if (!part) continue
    const m = /^(\d*)\s*(-)?\s*(\d*)$/.exec(part)
    if (!m || (!m[1] && !m[3])) throw new Error(`Bad range "${part}"`)
    const from = m[1] ? Number(m[1]) : 1
    const to = m[2] ? (m[3] ? Number(m[3]) : total) : from
    if (from < 1 || to > total || from > to) throw new Error(`Range "${part}" outside 1-${total}`)
    groups.push(Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i))
  }
  if (!groups.length) throw new Error('Enter at least one page range')
  return groups
}

export const chunkPages = (total: number, size: number): number[][] =>
  Array.from({ length: Math.ceil(total / size) }, (_, i) =>
    Array.from({ length: Math.min(size, total - i * size) }, (_, j) => i * size + j),
  )

/** Add `deltas[i]` degrees (multiple of 90) to page i's existing rotation. */
export async function rotatePdf(bytes: Uint8Array, deltas: number[]): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  doc.getPages().forEach((page, i) => {
    const d = deltas[i] ?? 0
    if (d) page.setRotation(degrees((((page.getRotation().angle + d) % 360) + 360) % 360))
  })
  return doc.save({ useObjectStreams: true })
}
