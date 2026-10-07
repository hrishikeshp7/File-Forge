import { useEffect, useRef, useState } from 'react'
import { RotateCcw, RotateCw } from 'lucide-react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { rotatePdf } from '../lib/pdf/ops.ts'
import { closePdf, openPdf, renderThumb, type PdfDoc } from '../lib/pdf/render.ts'
import { baseName } from '../lib/format.ts'
import { friendlyError } from '../lib/errors.ts'

function Thumb({ doc, pageNo, rotation, onClick }: { doc: PdfDoc; pageNo: number; rotation: number; onClick: () => void }) {
  const cell = useRef<HTMLButtonElement>(null)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    let live = true
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      renderThumb(doc, pageNo, 260).then((u) => {
        if (live) setSrc((url = u))
        else URL.revokeObjectURL(u)
      })
    }, { rootMargin: '200px' })
    io.observe(cell.current!)
    return () => {
      live = false
      io.disconnect()
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc, pageNo])

  return (
    <button ref={cell} className="page" onClick={onClick} aria-label={`Rotate page ${pageNo}`}>
      <span className="page-box">{src && <img src={src} alt="" style={{ transform: `rotate(${rotation}deg)` }} />}</span>
      <small>{pageNo}</small>
    </button>
  )
}

export default function PdfRotate() {
  const files = useFiles(false)
  const r = useRunner()
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [deltas, setDeltas] = useState<number[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const file = files.items[0]?.file

  useEffect(() => {
    setDoc(null)
    setDeltas([])
    setLoadErr(null)
    if (!file) return
    let live = true
    let opened: PdfDoc | null = null
    bytesOf(file)
      .then(openPdf)
      .then((d) => {
        opened = d
        if (!live) return void closePdf(d)
        setDoc(d)
        setDeltas(new Array(d.numPages).fill(0))
      })
      .catch((e) => live && setLoadErr(friendlyError(e)))
    return () => {
      live = false
      if (opened) void closePdf(opened)
    }
  }, [file])

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
              <Thumb key={i} doc={doc} pageNo={i + 1} rotation={d} onClick={() => turn(i, 90)} />
            ))}
          </div>
        </section>
      )}
    </ToolShell>
  )
}
