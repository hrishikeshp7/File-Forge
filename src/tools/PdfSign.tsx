import { useEffect, useState } from 'react'
import { CropBox } from '../components/CropBox.tsx'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { Field, Segmented } from '../components/controls.tsx'
import { Pager } from '../components/Pager.tsx'
import { usePdfDoc } from '../components/PdfThumb.tsx'
import { SignaturePad, type Signature } from '../components/SignaturePad.tsx'
import { usePagePreview } from '../components/usePagePreview.ts'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { addPicture, type Placement } from '../lib/pdf/mark.ts'
import { parseRanges } from '../lib/pdf/ops.ts'
import type { Rect } from '../lib/rect.ts'
import { baseName } from '../lib/format.ts'

type Scope = 'this' | 'all' | 'last' | 'range'

export default function PdfSign() {
  const files = useFiles(false)
  const r = useRunner()
  const file = files.items[0]?.file
  const { doc, error: loadErr } = usePdfDoc(file)
  const [sig, setSig] = useState<Signature | null>(null)
  const [page, setPage] = useState(1)
  const pv = usePagePreview(doc, page)
  const [rect, setRect] = useState<Rect | null>(null)
  const [scope, setScope] = useState<Scope>('this')
  const [range, setRange] = useState('')
  useEffect(() => setPage(1), [file])
  // Start at the bottom right, a third of the page wide, with the signature's own proportions.
  useEffect(() => {
    if (!sig || !pv) return
    const w = 0.3
    const h = (w * pv.width) / (pv.height * sig.aspect)
    setRect({ x: 0.62, y: Math.min(0.9 - h, 0.8), w, h })
  }, [sig, pv?.width, pv?.height]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ToolShell
      runLabel="Sign PDF"
      canRun={!!doc && !!sig && !!rect}
      {...r}
      error={loadErr ?? r.error}
      onRun={() =>
        r.run(async () => {
          const n = doc!.numPages
          const pages = scope === 'this' ? [page - 1] : scope === 'last' ? [n - 1] : scope === 'all' ? Array.from({ length: n }, (_, i) => i) : parseRanges(range, n).flat()
          const where: Placement[] = pages.map((p) => ({ page: p, cx: rect!.x + rect!.w / 2, cy: rect!.y + rect!.h / 2, w: rect!.w }))
          const out = await addPicture(await bytesOf(file!), sig!.png, sig!.aspect, where)
          return [{ id: 'sig', name: `${baseName(file!.name)}-signed.pdf`, blob: new Blob([out as BlobPart], { type: 'application/pdf' }), note: `signature on ${pages.length} page${pages.length > 1 ? 's' : ''}` }]
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" compact={!!file} onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} meta={doc ? { [files.items[0].id]: `${doc.numPages} pages` } : undefined} />
      {file && (
        <section className="panel">
          <h3>1. Your signature</h3>
          <SignaturePad onChange={setSig} />
        </section>
      )}
      {doc && sig && (
        <section className="panel">
          <h3>2. Place it</h3>
          <Pager page={page} count={doc.numPages} onChange={setPage} />
          {pv && rect ? (
            <div className="stage-wrap">
              <CropBox src={pv.url} imgW={pv.width} imgH={pv.height} rect={rect} onChange={setRect} aspect={sig.aspect} dim={false}>
                <img className="fill" src={sig.url} alt="" />
              </CropBox>
            </div>
          ) : (
            <p className="hint">Loading preview…</p>
          )}
          <Field label="Put it on">
            <Segmented value={scope} onChange={setScope} options={[{ value: 'this', label: 'This page' }, { value: 'all', label: 'All' }, { value: 'last', label: 'Last' }, { value: 'range', label: 'Pages…' }]} />
          </Field>
          {scope === 'range' && <Field label="Pages"><input type="text" inputMode="numeric" placeholder="e.g. 1-3, 7" value={range} onChange={(e) => setRange(e.target.value)} /></Field>}
          <p className="hint">This adds a picture of your signature. It is not a certified digital signature and has no legal verification built in.</p>
        </section>
      )}
    </ToolShell>
  )
}
