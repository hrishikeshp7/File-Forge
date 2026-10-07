import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { flattenPdf } from '../lib/pdf/mupdf.ts'
import { baseName } from '../lib/format.ts'

export default function PdfFlatten() {
  const files = useFiles(true)
  const r = useRunner()
  return (
    <ToolShell
      runLabel="Flatten PDFs"
      canRun={files.items.length > 0}
      {...r}
      onRun={() =>
        r.run(async (report) => {
          const out = []
          for (const [i, { id, file }] of files.items.entries()) {
            report(i, files.items.length, file.name)
            const bytes = await flattenPdf(await bytesOf(file))
            out.push({ id, name: `${baseName(file.name)}-flattened.pdf`, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), note: 'forms and annotations are now part of the page' })
          }
          return out
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" multiple compact={files.items.length > 0} label="Add PDFs" onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} />
      {files.items.length > 0 && (
        <section className="panel">
          <p className="hint">Fills in form fields and burns comments, highlights and stamps into the page so they can no longer be edited or removed. Use it before sharing a filled-in form.</p>
        </section>
      )}
    </ToolShell>
  )
}
