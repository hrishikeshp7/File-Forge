import { useEffect, useState } from 'react'
import { RotateCcw, RotateCw } from 'lucide-react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { rotatePdf } from '../lib/pdf/ops.ts'
import { baseName } from '../lib/format.ts'
import { PdfThumb, usePdfDoc } from '../components/PdfThumb.tsx'

export default function PdfRotate() {
  const files = useFiles(false)
  const r = useRunner()
  const file = files.items[0]?.file
  const { doc, error: loadErr } = usePdfDoc(file)
  const [deltas, setDeltas] = useState<number[]>([])
  useEffect(() => setDeltas(doc ? new Array(doc.numPages).fill(0) : []), [doc])

  const turn = (i: number, by: number) => setDeltas((d) => d.map((v, j) => (j === i ? v + by : v)))
  const turnAll = (by: number) => setDeltas((d) => d.map((v) => v + by))

  return (
    <ToolShell
      runLabel="Save rotated PDF"
      canRun={!!doc && deltas.some((d) => d % 360 !== 0)}
      {...r}
      error={loadErr ?? r.error}
      onRun={() =>
        r.run(async () => {
          const out = await rotatePdf(await bytesOf(file!), deltas)
          return [
            {
              id: 'rot',
              name: `${baseName(file!.name)}-rotated.pdf`,
              blob: new Blob([out as BlobPart], { type: 'application/pdf' }),
              note: `${deltas.filter((d) => d % 360).length} pages rotated`,
            },
          ]
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" compact={!!file} onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} meta={doc ? { [files.items[0].id]: `${doc.numPages} pages` } : undefined} />
      {doc && (
        <section className="panel">
          <div className="toolbar">
            <button className="btn secondary small" onClick={() => turnAll(-90)}><RotateCcw size={16} /> All left</button>
            <button className="btn secondary small" onClick={() => turnAll(90)}><RotateCw size={16} /> All right</button>
            <button className="btn ghost small" onClick={() => setDeltas(new Array(doc.numPages).fill(0))}>Reset</button>
          </div>
          <p className="hint">Tap a page to rotate it 90° clockwise.</p>
          <div className="pages">
            {deltas.map((d, i) => (
              <PdfThumb key={i} doc={doc} pageNo={i + 1} rotation={d} onClick={() => turn(i, 90)} />
            ))}
          </div>
        </section>
      )}
    </ToolShell>
  )
}
