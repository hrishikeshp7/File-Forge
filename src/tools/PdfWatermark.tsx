import { useState } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { Field, Segmented, Slider } from '../components/controls.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { bytesOf, useFiles } from '../components/useFiles.ts'
import { addWatermark } from '../lib/pdf/mark.ts'
import { pageCount, parseRanges } from '../lib/pdf/ops.ts'
import { renderTextPng } from '../lib/image/textPng.ts'
import { IMAGE_ACCEPT } from '../lib/image/decode.ts'
import { processImage } from '../lib/image/process.ts'
import { baseName } from '../lib/format.ts'

export default function PdfWatermark() {
  const files = useFiles(false)
  const logo = useFiles(false)
  const r = useRunner()
  const [kind, setKind] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('CONFIDENTIAL')
  const [color, setColor] = useState('#e5484d')
  const [bold, setBold] = useState(true)
  const [scale, setScale] = useState(50)
  const [opacity, setOpacity] = useState(30)
  const [angle, setAngle] = useState(45)
  const [mode, setMode] = useState<'center' | 'tile'>('center')
  const [pages, setPages] = useState('')
  const file = files.items[0]?.file
  const ready = !!file && (kind === 'text' ? !!text.trim() : logo.items.length > 0)

  return (
    <ToolShell
      runLabel="Add watermark"
      canRun={ready}
      {...r}
      onRun={() =>
        r.run(async () => {
          const input = await bytesOf(file!)
          const mark =
            kind === 'text'
              ? await renderTextPng(text.trim(), color, bold)
              : await processImage(logo.items[0].file, { format: 'image/png', quality: 1, maxWidth: 1200, maxHeight: 1200 }).then(async (res) => ({
                  png: new Uint8Array(await res.blob.arrayBuffer()),
                  width: res.width,
                  height: res.height,
                }))
          const wanted = pages.trim() ? parseRanges(pages, await pageCount(input)).flat() : undefined
          const out = await addWatermark(input, { ...mark, scale: scale / 100, opacity: opacity / 100, angle, mode, pages: wanted })
          return [{ id: 'wm', name: `${baseName(file!.name)}-watermarked.pdf`, blob: new Blob([out as BlobPart], { type: 'application/pdf' }) }]
        })
      }
    >
      <FileDrop accept="application/pdf,.pdf" compact={!!file} onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} />
      {file && (
        <section className="panel">
          <Segmented value={kind} onChange={setKind} options={[{ value: 'text', label: 'Text' }, { value: 'image', label: 'Image' }]} />
          {kind === 'text' ? (
            <>
              <Field label="Text">
                <input type="text" value={text} onChange={(e) => setText(e.target.value)} maxLength={80} />
              </Field>
              <div className="two">
                <Field label="Color">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="color" />
                </Field>
                <label className="check"><input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} /> Bold</label>
              </div>
            </>
          ) : (
            <>
              <FileDrop accept={IMAGE_ACCEPT} compact label="Choose watermark image" onFiles={logo.add} />
              <FileList items={logo.items} onRemove={logo.remove} />
            </>
          )}
          <Segmented value={mode} onChange={setMode} options={[{ value: 'center', label: 'Single' }, { value: 'tile', label: 'Tiled' }]} />
          <Slider label="Size (of page width)" value={scale} min={10} max={100} step={5} unit="%" onChange={setScale} />
          <Slider label="Opacity" value={opacity} min={5} max={100} step={5} unit="%" onChange={setOpacity} />
          <Slider label="Rotation" value={angle} min={-90} max={90} step={5} unit="°" onChange={setAngle} />
          <Field label="Pages (blank = all)">
            <input type="text" inputMode="numeric" placeholder="e.g. 1-3, 7" value={pages} onChange={(e) => setPages(e.target.value)} />
          </Field>
        </section>
      )}
    </ToolShell>
  )
}
