import { useState } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { Segmented } from '../components/controls.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { compressPdf, type Level } from '../lib/pdf/gs.ts'
import { friendlyError } from '../lib/errors.ts'
import { baseName, formatBytes, savedPercent } from '../lib/format.ts'

export default function PdfCompress() {
  const files = useFiles(true)
  const r = useRunner()
  const [level, setLevel] = useState<Level>('balanced')

  return (
    <ToolShell
      runLabel="Compress PDFs"
      canRun={files.items.length > 0}
      {...r}
      cancellable
      onRun={() =>
        r.run(async (report, signal) => {
          const out = []
          for (const [i, { id, file }] of files.items.entries()) {
            const label = `${file.name} (${i + 1}/${files.items.length})`
            const input = await bytesOf(file)
            let bytes: Uint8Array
            try {
              bytes = await compressPdf(input, level, (d, t) => report(d, t, label), signal)
            } catch (e) {
              out.push({ id, name: file.name, blob: file, error: friendlyError(e) })
              continue
            }
            const kept = bytes.length >= input.length
            const final = kept ? input : bytes
            out.push({
              id,
              name: `${baseName(file.name)}-compressed.pdf`,
              blob: new Blob([final as BlobPart], { type: 'application/pdf' }),
              note: kept
                ? 'Already optimized, kept original'
                : `−${savedPercent(input.length, final.length)}% · was ${formatBytes(input.length)}`,
            })
          }
          return out
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" multiple compact={files.items.length > 0} label="Add PDFs" onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} />
      {files.items.length > 0 && (
        <section className="panel">
          <Segmented
            value={level}
            onChange={setLevel}
            options={[
              { value: 'light', label: 'Light', hint: 'best quality' },
              { value: 'balanced', label: 'Balanced', hint: 'recommended' },
              { value: 'strong', label: 'Strong', hint: 'smaller' },
              { value: 'extreme', label: 'Extreme', hint: 'smallest' },
            ]}
          />
          <p className="hint">
            Downsamples and re-encodes every image (JPEG, PNG, scans), merges duplicates and subsets fonts. Text stays sharp and selectable.
            {level === 'extreme' ? ' Extreme looks soft when zoomed in.' : ''}
          </p>
        </section>
      )}
    </ToolShell>
  )
}
