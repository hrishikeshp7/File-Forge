import { useState } from 'react'
import { Field, Segmented, Slider } from '../components/controls.tsx'
import { ImageBatch } from './ImageBatch.tsx'
import type { OutFormat } from '../lib/image/process.ts'

const SIZES = [0, 3840, 2560, 1920, 1280, 1024]

export default function ImageCompress() {
  const [quality, setQuality] = useState(75)
  const [format, setFormat] = useState<OutFormat | 'keep'>('keep')
  const [maxDim, setMaxDim] = useState(0)

  return (
    <ImageBatch
      runLabel="Compress images"
      suffix="-compressed"
      keepIfLarger
      showSavings
      opts={{ format, quality: quality / 100, maxWidth: maxDim || undefined, maxHeight: maxDim || undefined }}
    >
      {(files) => (
        <>
          <Slider label="Quality" value={quality} min={10} max={100} step={5} unit="%" onChange={setQuality} />
          <Field label="Output format">
            <Segmented
              value={format}
              onChange={setFormat}
              options={[
                { value: 'keep', label: 'Same' },
                { value: 'image/jpeg', label: 'JPEG' },
                { value: 'image/webp', label: 'WebP' },
              ]}
            />
          </Field>
          <Field label="Limit longest side">
            <select value={maxDim} onChange={(e) => setMaxDim(Number(e.target.value))}>
              {SIZES.map((s) => (
                <option key={s} value={s}>{s ? `${s} px` : 'Original size'}</option>
              ))}
            </select>
          </Field>
          {format === 'keep' && files.some((f) => f.type === 'image/png') && (
            <p className="hint">PNG is lossless, so quality has no effect. Pick WebP or JPEG for big savings.</p>
          )}
        </>
      )}
    </ImageBatch>
  )
}
