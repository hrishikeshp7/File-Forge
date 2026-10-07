import { useEffect, useState } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { Field, Segmented } from '../components/controls.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { chunkPages, pageCount, parseRanges, splitPdf } from '../lib/pdf/ops.ts'
import { baseName } from '../lib/format.ts'
import { friendlyError } from '../lib/errors.ts'

type Mode = 'ranges' | 'every' | 'each'

export default function PdfSplit() {
  const files = useFiles(false)
  const r = useRunner()
  const [pages, setPages] = useState<number | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('ranges')
  const [ranges, setRanges] = useState('')
  const [every, setEvery] = useState(1)
  const [combine, setCombine] = useState(false)
  const file = files.items[0]?.file

  useEffect(() => {
    setPages(null)
    setLoadErr(null)
    if (!file) return
    let live = true
    bytesOf(file)
      .then(pageCount)
      .then((n) => live && setPages(n))
      .catch((e) => live && setLoadErr(friendlyError(e)))
    return () => void (live = false)
  }, [file])

  return (
    <ToolShell
      runLabel="Split PDF"
      canRun={!!file && pages !== null}
      {...r}
      error={loadErr ?? r.error}
      onRun={() =>
        r.run(async (report) => {
          const total = pages!
          let groups: number[][]
          if (mode === 'ranges') {
            groups = parseRanges(ranges, total)
            if (combine) groups = [groups.flat()]
          } else if (mode === 'every') {
            groups = chunkPages(total, Math.max(1, every))
          } else {
            groups = chunkPages(total, 1)
          }
          report(0, 1, 'Splitting…')
          const outs = await splitPdf(await bytesOf(file!), groups)
          const base = baseName(file!.name)
          return outs.map((bytes, i) => {
            const g = groups[i]
            const span = g.length === 1 ? `${g[0] + 1}` : `${g[0] + 1}-${g[g.length - 1] + 1}`
            return {
              id: `p${i}`,
              name: groups.length === 1 ? `${base}-extract.pdf` : `${base}-${span}.pdf`,
              blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
              note: `${g.length} page${g.length > 1 ? 's' : ''}`,
            }
          })
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" compact={!!file} onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} meta={pages ? { [files.items[0].id]: `${pages} pages` } : undefined} />
      {file && pages !== null && (
        <section className="panel">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'ranges', label: 'By range' },
              { value: 'every', label: 'Every N pages' },
              { value: 'each', label: 'Each page' },
            ]}
          />
          {mode === 'ranges' && (
            <>
              <Field label="Pages">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={`e.g. 1-3, 5, 8-${pages}`}
                  value={ranges}
                  onChange={(e) => setRanges(e.target.value)}
                />
              </Field>
              <label className="check">
                <input type="checkbox" checked={combine} onChange={(e) => setCombine(e.target.checked)} />
                Combine all ranges into one PDF (extract pages)
              </label>
            </>
          )}
          {mode === 'every' && (
            <Field label="Pages per file">
              <input type="number" min={1} max={pages} value={every} onChange={(e) => setEvery(Number(e.target.value))} />
            </Field>
          )}
          {mode === 'each' && <p className="hint">One PDF per page ({pages} files, downloadable as ZIP).</p>}
        </section>
      )}
    </ToolShell>
  )
}
