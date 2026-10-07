import { useState } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { Field, Segmented } from '../components/controls.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { useFiles } from '../components/useFiles.ts'
import { imagesToPdf, type PageImage, type PageSize } from '../lib/pdf/fromImages.ts'
import { IMAGE_ACCEPT } from '../lib/image/decode.ts'
import { processImage } from '../lib/image/process.ts'

const KEEPS_ALPHA = /^image\/(png|gif|webp|svg)/

export default function ImageToPdf() {
  const files = useFiles(true)
  const r = useRunner()
  const [size, setSize] = useState<PageSize>('a4')
  const [margin, setMargin] = useState(24)

  return (
    <ToolShell
      runLabel="Create PDF"
      canRun={files.items.length > 0}
      {...r}
      onRun={() =>
        r.run(async (report) => {
          const pages: PageImage[] = []
          for (const [i, { file }] of files.items.entries()) {
            report(i, files.items.length, file.name)
            // ponytail: always re-encoded (JPEG q92) so EXIF rotation and HEIC/WebP/TIFF inputs just work.
            // Upgrade path: embed original JPEG bytes when it has no EXIF orientation.
            const kind = KEEPS_ALPHA.test(file.type) ? 'png' : 'jpg'
            const res = await processImage(file, { format: kind === 'png' ? 'image/png' : 'image/jpeg', quality: 0.92 })
            pages.push({ bytes: new Uint8Array(await res.blob.arrayBuffer()), kind, width: res.width, height: res.height })
          }
          const out = await imagesToPdf(pages, size, size === 'fit' ? 0 : margin)
          return [{ id: 'pdf', name: 'images.pdf', blob: new Blob([out as BlobPart], { type: 'application/pdf' }), note: `${pages.length} pages` }]
        })
      }
    >
      <FileDrop accept={IMAGE_ACCEPT} multiple compact={files.items.length > 0} label="Add images" onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} onMove={files.move} />
      {files.items.length > 0 && (
        <section className="panel">
          <Field label="Page size">
            <Segmented
              value={size}
              onChange={setSize}
              options={[
                { value: 'a4', label: 'A4' },
                { value: 'letter', label: 'Letter' },
                { value: 'fit', label: 'Fit image' },
              ]}
            />
          </Field>
          {size !== 'fit' && (
            <Field label="Margin" value={`${margin} pt`}>
              <input type="range" min={0} max={72} step={4} value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
            </Field>
          )}
          <p className="hint">One image per page, in the order shown. Use the arrows to reorder.</p>
        </section>
      )}
    </ToolShell>
  )
}
