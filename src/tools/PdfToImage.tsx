import { useState } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { Field, Segmented } from '../components/controls.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { closePdf, openPdf, renderPageBlob } from '../lib/pdf/render.ts'
import { parseRanges } from '../lib/pdf/ops.ts'
import { baseName } from '../lib/format.ts'

type Fmt = 'image/jpeg' | 'image/png'

export default function PdfToImage() {
  const files = useFiles(false)
  const r = useRunner()
  const [fmt, setFmt] = useState<Fmt>('image/jpeg')
  const [dpi, setDpi] = useState(150)
  const [pages, setPages] = useState('')
  const file = files.items[0]?.file

  return (
    <ToolShell
      runLabel="Convert to images"
      canRun={!!file}
      {...r}
      onRun={() =>
        r.run(async (report) => {
          const doc = await openPdf(await bytesOf(file!))
          try {
            const wanted = pages.trim() ? parseRanges(pages, doc.numPages).flat() : Array.from({ length: doc.numPages }, (_, i) => i)
            const ext = fmt === 'image/png' ? 'png' : 'jpg'
            const out = []
            for (const [i, idx] of wanted.entries()) {
              report(i, wanted.length, `Page ${idx + 1}`)
              out.push({
                id: `p${idx}`,
                name: `${baseName(file!.name)}-page-${idx + 1}.${ext}`,
                blob: await renderPageBlob(doc, idx + 1, dpi, fmt),
                preview: 'image' as const,
              })
            }
            return out
          } finally {
            await closePdf(doc)
          }
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" compact={!!file} onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} />
      {file && (
        <section className="panel">
          <Segmented
            value={fmt}
            onChange={setFmt}
            options={[
              { value: 'image/jpeg', label: 'JPG' },
              { value: 'image/png', label: 'PNG', hint: 'lossless' },
            ]}
          />
          <Field label="Quality (resolution)">
            <Segmented
              value={String(dpi)}
              onChange={(v) => setDpi(Number(v))}
              options={[
                { value: '72', label: 'Screen', hint: '72 dpi' },
                { value: '150', label: 'Good', hint: '150 dpi' },
                { value: '220', label: 'High', hint: '220 dpi' },
                { value: '300', label: 'Print', hint: '300 dpi' },
              ]}
            />
          </Field>
          <Field label="Pages (blank = all)">
            <input type="text" inputMode="numeric" placeholder="e.g. 1-3, 7" value={pages} onChange={(e) => setPages(e.target.value)} />
          </Field>
        </section>
      )}
    </ToolShell>
  )
}
