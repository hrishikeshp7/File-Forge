import { useEffect, useState } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { Field } from '../components/controls.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { META_FIELDS, readMeta, writeMeta, type Meta } from '../lib/pdf/meta.ts'
import { friendlyError } from '../lib/errors.ts'
import { baseName } from '../lib/format.ts'

const EMPTY = Object.fromEntries(META_FIELDS.map((f) => [f, ''])) as Meta

export default function PdfMetadata() {
  const files = useFiles(false)
  const r = useRunner()
  const file = files.items[0]?.file
  const [meta, setMeta] = useState<Meta>(EMPTY)
  const [hasXmp, setHasXmp] = useState(false)
  const [strip, setStrip] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setMeta(EMPTY)
    setLoaded(false)
    setLoadErr(null)
    if (!file) return
    let live = true
    bytesOf(file).then(readMeta).then(({ hasXmp, ...m }) => live && (setMeta(m), setHasXmp(hasXmp), setLoaded(true)), (e) => live && setLoadErr(friendlyError(e)))
    return () => void (live = false)
  }, [file])

  return (
    <ToolShell
      runLabel={strip ? 'Remove all metadata' : 'Save metadata'}
      canRun={!!file && loaded}
      {...r}
      error={loadErr ?? r.error}
      onRun={() =>
        r.run(async () => {
          const out = await writeMeta(await bytesOf(file!), meta, strip)
          return [{ id: 'meta', name: `${baseName(file!.name)}-${strip ? 'clean' : 'edited'}.pdf`, blob: new Blob([out as BlobPart], { type: 'application/pdf' }), note: strip ? 'all document properties removed' : undefined }]
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" compact={!!file} onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} />
      {file && loaded && (
        <section className="panel">
          {META_FIELDS.map((f) => (
            <Field key={f} label={f}>
              <input type="text" value={meta[f]} disabled={strip} onChange={(e) => setMeta({ ...meta, [f]: e.target.value })} />
            </Field>
          ))}
          <label className="check"><input type="checkbox" checked={strip} onChange={(e) => setStrip(e.target.checked)} /> Remove all properties instead (title, author, dates, …)</label>
          <p className="hint">
            Empty fields are removed.{hasXmp ? ' This file also carries an XMP copy of its properties; it is dropped when you save so viewers do not show stale values.' : ''}
          </p>
        </section>
      )}
    </ToolShell>
  )
}
