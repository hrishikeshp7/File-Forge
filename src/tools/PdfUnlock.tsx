import { useState } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { Field } from '../components/controls.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { unlockPdf } from '../lib/pdf/mupdf.ts'
import { baseName } from '../lib/format.ts'

export default function PdfUnlock() {
  const files = useFiles(false)
  const r = useRunner()
  const [pw, setPw] = useState('')
  const file = files.items[0]?.file

  return (
    <ToolShell
      runLabel="Unlock PDF"
      canRun={!!file}
      {...r}
      onRun={() =>
        r.run(async () => {
          const out = await unlockPdf(await bytesOf(file!), pw)
          return [
            {
              id: 'unlocked',
              name: `${baseName(file!.name)}-unlocked.pdf`,
              blob: new Blob([out as BlobPart], { type: 'application/pdf' }),
              note: 'Password and restrictions removed',
            },
          ]
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" compact={!!file} onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} />
      {file && (
        <section className="panel">
          <Field label="Password">
            <input type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Leave empty if the PDF opens without one" />
          </Field>
          <p className="hint">
            Removes the password. For PDFs that open freely but block printing or copying, leave the password empty. You need the password
            for files that ask for one: this tool does not crack passwords.
          </p>
        </section>
      )}
    </ToolShell>
  )
}
