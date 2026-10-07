import { zipSync } from 'fflate'

/** Store-only zip (inputs are already compressed PDFs/images). Names are de-duplicated. */
export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const seen = new Map<string, number>()
  const entries: Record<string, Uint8Array> = {}
  for (const f of files) {
    const n = seen.get(f.name) ?? 0
    seen.set(f.name, n + 1)
    const name = n ? f.name.replace(/(\.[^.]+)?$/, ` (${n})$1`) : f.name
    entries[name] = new Uint8Array(await f.blob.arrayBuffer())
  }
  return new Blob([zipSync(entries, { level: 0 }) as BlobPart], { type: 'application/zip' })
}
