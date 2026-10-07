import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { mergePdfs } from '../lib/pdf/ops.ts'

export default function PdfMerge() {
  const files = useFiles(true)
  const r = useRunner()

  return (
    <ToolShell
      runLabel="Merge PDFs"
      canRun={files.items.length >= 2}
      {...r}
      onRun={() =>
        r.run(async (report) => {
          const inputs: Uint8Array[] = []
          for (const [i, it] of files.items.entries()) {
            report(i, files.items.length, it.file.name)
            inputs.push(await bytesOf(it.file))
          }
          report(files.items.length, files.items.length, 'Merging…')
          const out = await mergePdfs(inputs)
          return [
            {
              id: 'merged',
              name: 'merged.pdf',
              blob: new Blob([out as BlobPart], { type: 'application/pdf' }),
              note: `${inputs.length} files`,
            },
          ]
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" multiple compact={files.items.length > 0} label="Add PDFs" onFiles={files.add} />
      <FileList items={files.items} onRemove={files.remove} onMove={files.move} />
      {files.items.length === 1 && <p className="hint">Add at least one more PDF. Use the arrows to set the order.</p>}
    </ToolShell>
  )
}
