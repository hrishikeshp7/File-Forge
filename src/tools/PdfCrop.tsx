import { useEffect, useState } from 'react'
import { CropBox } from '../components/CropBox.tsx'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { Field, Segmented } from '../components/controls.tsx'
import { Pager } from '../components/Pager.tsx'
import { usePdfDoc } from '../components/PdfThumb.tsx'
import { usePagePreview } from '../components/usePagePreview.ts'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { cropPages } from '../lib/pdf/mark.ts'
import { eraseOutside } from '../lib/pdf/mupdf.ts'
import { parseRanges } from '../lib/pdf/ops.ts'
import { initialRect, type Rect } from '../lib/rect.ts'
import { baseName } from '../lib/format.ts'

export default function PdfCrop() {
  const files = useFiles(false)
  const r = useRunner()
  const file = files.items[0]?.file
  const { doc, error: loadErr } = usePdfDoc(file)
  const [page, setPage] = useState(1)
  const pv = usePagePreview(doc, page)
  const [rect, setRect] = useState<Rect>(initialRect(undefined, 0.9))
  const [scope, setScope] = useState<'all' | 'range'>('all')
  const [range, setRange] = useState('')
  const [erase, setErase] = useState(true)
  useEffect(() => { setPage(1); setRect(initialRect(undefined, 0.9)) }, [file])

  return (
    <ToolShell
      runLabel="Crop PDF"
      canRun={!!doc}
      {...r}
      error={loadErr ?? r.error}
      onRun={() =>
        r.run(async () => {
          const pages = scope === 'range' ? parseRanges(range, doc!.numPages).flat() : undefined
          let bytes: Uint8Array = await bytesOf(file!)
          if (erase) bytes = await eraseOutside(bytes, rect, pages) // must run before the crop box changes the page space
          const out = await cropPages(bytes, rect, pages)
          return [{ id: 'crop', name: `${baseName(file!.name)}-cropped.pdf`, blob: new Blob([out as BlobPart], { type: 'application/pdf' }), note: erase ? 'outside content deleted' : 'outside content hidden only' }]
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" compact={!!file} onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} meta={doc ? { [files.items[0].id]: `${doc.numPages} pages` } : undefined} />
      {doc && (
        <section className="panel">
          <Pager page={page} count={doc.numPages} onChange={setPage} />
          {pv ? (
            <div className="stage-wrap"><CropBox src={pv.url} imgW={pv.width} imgH={pv.height} rect={rect} onChange={setRect} /></div>
          ) : (
            <p className="hint">Loading preview…</p>
          )}
          <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'All pages' }, { value: 'range', label: 'Some pages' }]} />
          {scope === 'range' && (
            <Field label="Pages"><input type="text" inputMode="numeric" placeholder="e.g. 1-3, 7" value={range} onChange={(e) => setRange(e.target.value)} /></Field>
          )}
          <label className="check"><input type="checkbox" checked={erase} onChange={(e) => setErase(e.target.checked)} /> Permanently delete everything outside the box</label>
          <p className="hint">
            The same area is kept on every chosen page.{' '}
            {erase
              ? 'Text and image pixels outside the box are removed from the file. Text cut by the edge keeps its visible part; a drawing that crosses the edge stays.'
              : 'The outside is only hidden: the content stays in the file and can be recovered.'}
          </p>
        </section>
      )}
    </ToolShell>
  )
}
