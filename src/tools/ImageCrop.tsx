import { useEffect, useState } from 'react'
import { CropBox } from '../components/CropBox.tsx'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { useFiles } from '../components/useFiles.ts'
import { usePreview } from '../components/usePreview.ts'
import { IMAGE_ACCEPT } from '../lib/image/decode.ts'
import { EXT, processImage } from '../lib/image/process.ts'
import { initialRect, pixelRect, type Rect } from '../lib/rect.ts'
import { baseName } from '../lib/format.ts'

const RATIOS: [string, number | undefined][] = [['Free', undefined], ['1:1', 1], ['4:3', 4 / 3], ['3:2', 3 / 2], ['16:9', 16 / 9], ['3:4', 3 / 4], ['9:16', 9 / 16]]

export default function ImageCrop() {
  const files = useFiles(false)
  const r = useRunner()
  const file = files.items[0]?.file
  const pv = usePreview(file)
  const [aspect, setAspect] = useState<number | undefined>(undefined)
  const [rect, setRect] = useState<Rect>(initialRect(undefined))
  useEffect(() => setRect(initialRect(aspect && pv ? (aspect * pv.height) / pv.width : undefined)), [aspect, pv])
  const px = pv ? pixelRect(rect, pv.width, pv.height) : null

  return (
    <ToolShell
      runLabel="Crop image"
      canRun={!!file && !!pv}
      {...r}
      onRun={() =>
        r.run(async () => {
          const res = await processImage(file!, { format: 'keep', quality: 0.92, crop: rect })
          return [{ id: 'crop', name: `${baseName(file!.name)}-cropped.${EXT[res.blob.type] ?? 'png'}`, blob: res.blob, preview: 'image', note: `${res.width}×${res.height}` }]
        })
      }
    >
      <FileDrop accept={IMAGE_ACCEPT} compact={!!file} onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} />
      {file && (
        <section className="panel">
          <div className="chip-row">
            {RATIOS.map(([label, a]) => (
              <button key={label} className={`chip${aspect === a ? ' on' : ''}`} onClick={() => setAspect(a)}>{label}</button>
            ))}
          </div>
          {pv ? (
            <div className="stage-wrap">
              <CropBox src={pv.url} imgW={pv.width} imgH={pv.height} rect={rect} onChange={setRect} aspect={aspect} />
            </div>
          ) : (
            <p className="hint">Loading preview…</p>
          )}
          {px && <p className="hint">Result: {px.sw} × {px.sh} px. Drag the box, pull the handles.</p>}
        </section>
      )}
    </ToolShell>
  )
}
