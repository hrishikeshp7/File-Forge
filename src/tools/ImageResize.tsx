import { useState } from 'react'
import { Field, Segmented, Slider } from '../components/controls.tsx'
import { ImageBatch } from './ImageBatch.tsx'
import type { ImageOptions } from '../lib/image/process.ts'

const PRESETS = [
  { label: 'HD', w: 1280, h: 720 },
  { label: 'Full HD', w: 1920, h: 1080 },
  { label: '4K', w: 3840, h: 2160 },
  { label: 'Square 1080', w: 1080, h: 1080 },
  { label: 'Portrait 1080×1350', w: 1080, h: 1350 },
]

const num = (s: string) => (s && Number(s) > 0 ? Math.round(Number(s)) : undefined)

export default function ImageResize() {
  const [mode, setMode] = useState<'percent' | 'dims'>('percent')
  const [percent, setPercent] = useState(50)
  const [w, setW] = useState('')
  const [h, setH] = useState('')
  const [keepAspect, setKeepAspect] = useState(true)

  const opts: ImageOptions =
    mode === 'percent'
      ? { format: 'keep', quality: 0.92, scale: percent / 100 }
      : { format: 'keep', quality: 0.92, width: num(w), height: num(h), contain: keepAspect }

  return (
    <ImageBatch runLabel="Resize images" suffix="-resized" showSavings opts={opts}>
      {() => (
        <>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'percent', label: 'By percent' },
              { value: 'dims', label: 'By pixels' },
            ]}
          />
          {mode === 'percent' ? (
            <Slider label="Scale" value={percent} min={5} max={200} step={5} unit="%" onChange={setPercent} />
          ) : (
            <>
              <div className="chips">
                {PRESETS.map((p) => (
                  <button key={p.label} className="chip" onClick={() => { setW(String(p.w)); setH(String(p.h)); setKeepAspect(true) }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="two">
                <Field label="Width (px)">
                  <input type="number" min={1} inputMode="numeric" value={w} onChange={(e) => setW(e.target.value)} placeholder="auto" />
                </Field>
                <Field label="Height (px)">
                  <input type="number" min={1} inputMode="numeric" value={h} onChange={(e) => setH(e.target.value)} placeholder="auto" />
                </Field>
              </div>
              <label className="check">
                <input type="checkbox" checked={keepAspect} onChange={(e) => setKeepAspect(e.target.checked)} />
                Keep aspect ratio (fit inside the size)
              </label>
              {!w && !h && <p className="hint">Enter a width, a height, or both.</p>}
            </>
          )}
        </>
      )}
    </ImageBatch>
  )
}
