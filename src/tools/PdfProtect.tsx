import { useState } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { Field } from '../components/controls.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { protectPdf } from '../lib/pdf/mupdf.ts'
import { baseName } from '../lib/format.ts'

export default function PdfProtect() {
  const files = useFiles(false)
  const r = useRunner()
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [print, setPrint] = useState(true)
  const [copy, setCopy] = useState(true)
  const [edit, setEdit] = useState(true)
  const file = files.items[0]?.file
  const problem = pw.includes(',') ? 'Passwords cannot contain a comma.' : pw && again && pw !== again ? 'Passwords do not match.' : null

  return (
    <ToolShell
      runLabel="Protect PDF"
      canRun={!!file && !!pw && pw === again && !problem}
      {...r}
      onRun={() =>
        r.run(async () => {
          const out = await protectPdf(await bytesOf(file!), pw, { print, copy, edit })
          return [
            {
              id: 'protected',
              name: `${baseName(file!.name)}-protected.pdf`,
              blob: new Blob([out as BlobPart], { type: 'application/pdf' }),
              note: 'AES-256 encrypted',
            },
          ]
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" compact={!!file} onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} />
      {file && (
        <section className="panel">
          <Field label="Password to open the PDF">
            <input type={show ? 'text' : 'password'} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label="Repeat password">
            <input type={show ? 'text' : 'password'} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
          </label>
          <div className="field-label">Allow people who open it to…</div>
          <label className="check"><input type="checkbox" checked={print} onChange={(e) => setPrint(e.target.checked)} /> Print</label>
          <label className="check"><input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} /> Copy text</label>
          <label className="check"><input type="checkbox" checked={edit} onChange={(e) => setEdit(e.target.checked)} /> Edit, annotate and rearrange pages</label>
          {problem && <p className="err-text">{problem}</p>}
          <p className="hint">AES-256 encryption. There is no way to recover a forgotten password. Some viewers ignore the permission checkboxes.</p>
        </section>
      )}
    </ToolShell>
  )
}
