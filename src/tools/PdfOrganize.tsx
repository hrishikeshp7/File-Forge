import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, RotateCw, Trash2 } from 'lucide-react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { PdfThumb, usePdfDoc } from '../components/PdfThumb.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { organizePdf } from '../lib/pdf/mupdf.ts'
import { rotatePdf } from '../lib/pdf/ops.ts'
import { baseName } from '../lib/format.ts'

interface Slot {
  id: number
  src: number // 0-based page in the original file
  rot: number
}

let nextId = 0
const fresh = (n: number): Slot[] => Array.from({ length: n }, (_, src) => ({ id: nextId++, src, rot: 0 }))

export default function PdfOrganize() {
  const files = useFiles(false)
  const r = useRunner()
  const file = files.items[0]?.file
  const { doc, error: loadErr } = usePdfDoc(file)
  const [slots, setSlots] = useState<Slot[]>([])
  useEffect(() => setSlots(doc ? fresh(doc.numPages) : []), [doc])

  const move = (i: number, d: -1 | 1) =>
    setSlots((s) => {
      const j = i + d
      if (j < 0 || j >= s.length) return s
      const n = [...s]
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
  const dup = (i: number) => setSlots((s) => [...s.slice(0, i + 1), { ...s[i], id: nextId++ }, ...s.slice(i + 1)])
  const del = (i: number) => setSlots((s) => s.filter((_, j) => j !== i))
  const rot = (i: number) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, rot: x.rot + 90 } : x)))
  const changed = !!doc && (slots.length !== doc.numPages || slots.some((s, i) => s.src !== i || s.rot % 360 !== 0))

  return (
    <ToolShell
      runLabel="Save PDF"
      canRun={!!doc && slots.length > 0 && changed}
      {...r}
      error={loadErr ?? r.error}
      onRun={() =>
        r.run(async () => {
          let out = await organizePdf(await bytesOf(file!), slots.map((s) => s.src))
          if (slots.some((s) => s.rot % 360)) out = await rotatePdf(out, slots.map((s) => s.rot))
          return [
            {
              id: 'org',
              name: `${baseName(file!.name)}-organized.pdf`,
              blob: new Blob([out as BlobPart], { type: 'application/pdf' }),
              note: `${slots.length} pages`,
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
            <button className="btn ghost small" onClick={() => setSlots(fresh(doc.numPages))}>Reset</button>
            <span className="hint">{slots.length} of {doc.numPages} pages kept. Use the arrows to reorder.</span>
          </div>
          <div className="pages">
            {slots.map((s, i) => (
              <PdfThumb key={s.id} doc={doc} pageNo={s.src + 1} rotation={s.rot} label={`${i + 1}`}>
                <div className="page-actions">
                  <button className="icon-btn" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}><ChevronLeft size={16} /></button>
                  <button className="icon-btn" aria-label="Rotate" onClick={() => rot(i)}><RotateCw size={16} /></button>
                  <button className="icon-btn" aria-label="Duplicate" onClick={() => dup(i)}><Copy size={16} /></button>
                  <button className="icon-btn" aria-label="Delete" onClick={() => del(i)}><Trash2 size={16} /></button>
                  <button className="icon-btn" aria-label="Move later" disabled={i === slots.length - 1} onClick={() => move(i, 1)}><ChevronRight size={16} /></button>
                </div>
              </PdfThumb>
            ))}
          </div>
          {!slots.length && <p className="hint">All pages deleted. Press Reset to start over.</p>}
        </section>
      )}
    </ToolShell>
  )
}
