import { useState } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { Field, Slider } from '../components/controls.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { addPageNumbers, type NumberPos } from '../lib/pdf/mark.ts'
import { pageCount, parseRanges } from '../lib/pdf/ops.ts'
import { baseName } from '../lib/format.ts'

const FORMATS = ['{n}', 'Page {n}', 'Page {n} of {total}', '{n} / {total}', '- {n} -']
const POSITIONS: [NumberPos, string][] = [
  ['bc', 'Bottom center'],
  ['br', 'Bottom right'],
  ['bl', 'Bottom left'],
  ['tc', 'Top center'],
  ['tr', 'Top right'],
  ['tl', 'Top left'],
]

export default function PdfPageNumbers() {
  const files = useFiles(false)
  const r = useRunner()
  const [format, setFormat] = useState(FORMATS[0])
  const [position, setPosition] = useState<NumberPos>('bc')
  const [start, setStart] = useState(1)
  const [size, setSize] = useState(12)
  const [pages, setPages] = useState('')
  const file = files.items[0]?.file

  return (
    <ToolShell
      runLabel="Add page numbers"
      canRun={!!file && !!format.trim()}
      {...r}
      onRun={() =>
        r.run(async () => {
          const input = await bytesOf(file!)
          const wanted = pages.trim() ? parseRanges(pages, await pageCount(input)).flat() : undefined
          const out = await addPageNumbers(input, { format, position, start, size, margin: 28, pages: wanted })
          return [{ id: 'num', name: `${baseName(file!.name)}-numbered.pdf`, blob: new Blob([out as BlobPart], { type: 'application/pdf' }) }]
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" compact={!!file} onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} />
      {file && (
        <section className="panel">
          <Field label="Format">
            <select value={FORMATS.includes(format) ? format : ''} onChange={(e) => e.target.value && setFormat(e.target.value)}>
              {FORMATS.map((f) => <option key={f} value={f}>{f.replace('{n}', '1').replace('{total}', 'N')}</option>)}
              <option value="">Custom…</option>
            </select>
          </Field>
          <Field label="Text ({n} = page, {total} = last number)">
            <input type="text" value={format} onChange={(e) => setFormat(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Position">
            <select value={position} onChange={(e) => setPosition(e.target.value as NumberPos)}>
              {POSITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <div className="two">
            <Field label="First number">
              <input type="number" value={start} onChange={(e) => setStart(Number(e.target.value) || 1)} />
            </Field>
            <Field label="Pages to number (blank = all)">
              <input type="text" inputMode="numeric" placeholder="e.g. 2-" value={pages} onChange={(e) => setPages(e.target.value)} />
            </Field>
          </div>
          <Slider label="Font size" value={size} min={8} max={32} unit=" pt" onChange={setSize} />
        </section>
      )}
    </ToolShell>
  )
}
