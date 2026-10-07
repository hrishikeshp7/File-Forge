import { useState } from 'react'
import { Segmented } from '../components/controls.tsx'
import { ImageBatch } from './ImageBatch.tsx'

export default function ImageRotate() {
  const [turn, setTurn] = useState<0 | 90 | 180 | 270>(90)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  return (
    <ImageBatch runLabel="Apply" suffix="-rotated" opts={{ format: 'keep', quality: 0.92, rotate: turn, flipH, flipV }}>
      {() => (
        <>
          <Segmented
            value={String(turn)}
            onChange={(v) => setTurn(Number(v) as 0 | 90 | 180 | 270)}
            options={[
              { value: '0', label: 'No turn' },
              { value: '90', label: '90° right' },
              { value: '270', label: '90° left' },
              { value: '180', label: '180°' },
            ]}
          />
          <label className="check"><input type="checkbox" checked={flipH} onChange={(e) => setFlipH(e.target.checked)} /> Mirror left ↔ right</label>
          <label className="check"><input type="checkbox" checked={flipV} onChange={(e) => setFlipV(e.target.checked)} /> Flip top ↕ bottom</label>
          <p className="hint">Turning is applied first, then mirroring. JPEG and WebP are re-encoded at 92% quality.</p>
        </>
      )}
    </ImageBatch>
  )
}
