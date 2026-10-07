import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Segmented, Slider } from '../components/controls.tsx'
import { ImageBatch } from './ImageBatch.tsx'
import { IMAGE_ACCEPT } from '../lib/image/decode.ts'
import type { OutFormat } from '../lib/image/process.ts'

const HEIC = '.heic,.heif,image/heic,image/heif'

/** One component serves the general converter and every "X to Y" shortcut; the route id picks the preset. */
export const CONVERT_PRESETS: Record<string, { accept: string; to: OutFormat }> = {
  'image-convert': { accept: IMAGE_ACCEPT, to: 'image/jpeg' },
  'heic-to-jpg': { accept: HEIC, to: 'image/jpeg' },
  'heic-to-png': { accept: HEIC, to: 'image/png' },
  'png-to-jpg': { accept: 'image/png,.png', to: 'image/jpeg' },
  'jpg-to-png': { accept: 'image/jpeg,.jpg,.jpeg', to: 'image/png' },
  'webp-to-jpg': { accept: 'image/webp,.webp', to: 'image/jpeg' },
  'webp-to-png': { accept: 'image/webp,.webp', to: 'image/png' },
  'svg-to-png': { accept: 'image/svg+xml,.svg', to: 'image/png' },
}

export default function ImageConvert() {
  const { id = 'image-convert' } = useParams()
  const preset = CONVERT_PRESETS[id] ?? CONVERT_PRESETS['image-convert']
  const [format, setFormat] = useState<OutFormat>(preset.to)
  const [quality, setQuality] = useState(90)

  return (
    <ImageBatch accept={preset.accept} runLabel="Convert images" opts={{ format, quality: quality / 100 }}>
      {() => (
        <>
          <Segmented
            value={format}
            onChange={setFormat}
            options={[
              { value: 'image/jpeg', label: 'JPG' },
              { value: 'image/png', label: 'PNG', hint: 'lossless' },
              { value: 'image/webp', label: 'WebP' },
              { value: 'image/bmp', label: 'BMP' },
              { value: 'image/x-icon', label: 'ICO', hint: '≤256px' },
            ]}
          />
          {(format === 'image/jpeg' || format === 'image/webp') && (
            <Slider label="Quality" value={quality} min={10} max={100} step={5} unit="%" onChange={setQuality} />
          )}
          {(format === 'image/jpeg' || format === 'image/bmp') && <p className="hint">Transparent areas become white.</p>}
          {format === 'image/x-icon' && <p className="hint">Square icon, longest side capped at 256 px (favicon / app icon).</p>}
        </>
      )}
    </ImageBatch>
  )
}
