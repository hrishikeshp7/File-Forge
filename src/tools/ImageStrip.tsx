import { useEffect, useState } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles, type Item } from '../components/useFiles.ts'
import { IMAGE_ACCEPT } from '../lib/image/decode.ts'
import { kindOf, readExif, stripJpeg, stripPng } from '../lib/image/exif.ts'
import { EXT, processImage } from '../lib/image/process.ts'
import { baseName } from '../lib/format.ts'

/** What a photo gives away, in plain words. */
async function describe(f: File): Promise<string> {
  const x = readExif(await bytesOf(f))
  if (!x) return 'no metadata found'
  const bits = [x.hasGps && 'GPS location', [x.make, x.model].filter(Boolean).join(' ') || false, x.date && `taken ${x.date.slice(0, 10).replaceAll(':', '-')}`].filter(Boolean)
  return bits.length ? (bits as string[]).join(' · ') : 'Exif found'
}

export default function ImageStrip() {
  const files = useFiles(true)
  const r = useRunner()
  const [info, setInfo] = useState<Record<string, string>>({})
  useEffect(() => {
    let live = true
    for (const it of files.items as Item[]) describe(it.file).then((t) => live && setInfo((m) => ({ ...m, [it.id]: t })), () => {})
    return () => void (live = false)
  }, [files.items])

  return (
    <ToolShell
      runLabel="Remove metadata"
      canRun={files.items.length > 0}
      {...r}
      onRun={() =>
        r.run(async (report) => {
          const out = []
          for (const [i, { id, file }] of files.items.entries()) {
            report(i, files.items.length, file.name)
            const bytes = await bytesOf(file)
            const kind = kindOf(bytes)
            const exif = readExif(bytes)
            // A PNG whose Exif says "rotated" cannot be stripped losslessly (the browser would show it sideways): re-encode instead.
            if (kind === 'jpeg' || (kind === 'png' && (exif?.orientation ?? 1) === 1)) {
              const s = kind === 'jpeg' ? stripJpeg(bytes) : stripPng(bytes)
              const type = kind === 'jpeg' ? 'image/jpeg' : 'image/png'
              out.push({ id, name: `${baseName(file.name)}-clean.${EXT[type]}`, blob: new Blob([s.bytes as BlobPart], { type }), preview: 'image' as const, note: s.removed.length ? `removed ${s.removed.join(', ')} · pixels untouched` : 'no metadata found · pixels untouched' })
            } else {
              try {
                const res = await processImage(file, { format: 'keep', quality: 0.95 })
                out.push({ id, name: `${baseName(file.name)}-clean.${EXT[res.blob.type] ?? 'png'}`, blob: res.blob, preview: 'image' as const, note: 'metadata dropped by re-encoding (this format cannot be cleaned losslessly)' })
              } catch {
                out.push({ id, name: file.name, blob: file, error: 'Could not read this image (corrupt or unsupported)' })
              }
            }
          }
          return out
        })
      }
    >
      <FileDrop accept={IMAGE_ACCEPT} multiple compact={files.items.length > 0} label="Add photos" onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} meta={info} />
      {files.items.length > 0 && (
        <section className="panel">
          <p className="hint">
            JPEG and PNG are cleaned without touching the picture data: Exif (GPS, camera, dates), XMP, IPTC and comments go; the colour profile
            stays, and a rotated photo stays upright. Other formats are re-encoded.
          </p>
        </section>
      )}
    </ToolShell>
  )
}
