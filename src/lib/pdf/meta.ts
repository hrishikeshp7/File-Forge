import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib'

export const META_FIELDS = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'] as const
export type MetaField = (typeof META_FIELDS)[number]
export type Meta = Record<MetaField, string>

// updateMetadata:false stops pdf-lib stamping itself as Producer and bumping ModDate on load.
const load = (bytes: Uint8Array) => PDFDocument.load(bytes, { updateMetadata: false })

/** The Info dictionary, created if the file has none (pdf-lib's own getter is private). */
function infoDict(doc: PDFDocument): PDFDict {
  const { context } = doc
  const existing = context.trailerInfo.Info && context.lookup(context.trailerInfo.Info, PDFDict)
  if (existing) return existing
  const fresh = context.obj({})
  context.trailerInfo.Info = context.register(fresh)
  return fresh
}

const text = (v: unknown) => (v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : '')

export async function readMeta(bytes: Uint8Array): Promise<Meta & { hasXmp: boolean }> {
  const doc = await load(bytes)
  const info = infoDict(doc)
  const out = Object.fromEntries(META_FIELDS.map((f) => [f, text(info.lookup(PDFName.of(f)))])) as Meta
  return { ...out, hasXmp: doc.catalog.has(PDFName.of('Metadata')) }
}

/**
 * Write the given fields (empty string removes a field). `strip` removes everything: Info dictionary entries including dates.
 * The XMP stream (/Metadata) is always dropped: viewers prefer it over Info, so a stale copy would show the old title.
 */
export async function writeMeta(bytes: Uint8Array, meta: Partial<Meta>, strip = false): Promise<Uint8Array> {
  const doc = await load(bytes)
  const info = infoDict(doc)
  if (strip) for (const key of info.keys()) info.delete(key)
  else for (const f of META_FIELDS) if (f in meta) (meta[f] ? info.set(PDFName.of(f), PDFHexString.fromText(meta[f]!)) : info.delete(PDFName.of(f)))
  doc.catalog.delete(PDFName.of('Metadata'))
  return doc.save({ useObjectStreams: true, updateFieldAppearances: false })
}
