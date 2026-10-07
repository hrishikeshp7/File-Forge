import { useState } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { Field, Segmented, Slider } from '../components/controls.tsx'
import { useFiles } from '../components/useFiles.ts'
import { ImageBatch } from './ImageBatch.tsx'
import { IMAGE_ACCEPT, decodeImage } from '../lib/image/decode.ts'
import type { Overlay } from '../lib/image/process.ts'
import { renderTextPng } from '../lib/image/textPng.ts'

type Position = Overlay['position']
const POSITIONS: [Position, string][] = [['br', 'Bottom right'], ['bl', 'Bottom left'], ['tr', 'Top right'], ['tl', 'Top left'], ['center', 'Center'], ['tile', 'Tiled']]

export default function ImageWatermark() {
  const logo = useFiles(false)
  const [kind, setKind] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('© My Name')
  const [color, setColor] = useState('#ffffff')
  const [bold, setBold] = useState(true)
  const [position, setPosition] = useState<Position>('br')
  const [scale, setScale] = useState(30)
  const [opacity, setOpacity] = useState(60)
  const [angle, setAngle] = useState(0)

  return (
    <ImageBatch
      runLabel="Add watermark"
      suffix="-watermarked"
      opts={{ format: 'keep', quality: 0.92 }}
      prepare={async () => {
        if (kind === 'image' && !logo.items.length) throw new Error('Choose a watermark image.')
        if (kind === 'text' && !text.trim()) throw new Error('Enter the watermark text.')
        const source =
          kind === 'text'
            ? await createImageBitmap(new Blob([(await renderTextPng(text.trim(), color, bold)).png as BlobPart], { type: 'image/png' }))
            : await decodeImage(logo.items[0].file)
        return { overlay: { source, scale: scale / 100, opacity: opacity / 100, angle, position } }
      }}
    >
      {() => (
        <>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'text', label: 'Text' }, { value: 'image', label: 'Image / logo' }]} />
          {kind === 'text' ? (
            <>
              <Field label="Text"><input type="text" value={text} onChange={(e) => setText(e.target.value)} maxLength={80} /></Field>
              <div className="two">
                <Field label="Color"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="color" /></Field>
                <label className="check"><input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} /> Bold</label>
              </div>
            </>
          ) : (
            <>
              <FileDrop accept={IMAGE_ACCEPT} compact label="Choose watermark image" onFiles={logo.add} />
              <FileList items={logo.items} onRemove={logo.remove} />
            </>
          )}
          <Field label="Position">
            <select value={position} onChange={(e) => setPosition(e.target.value as Position)}>
              {POSITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Slider label="Size (of image width)" value={scale} min={5} max={100} step={5} unit="%" onChange={setScale} />
          <Slider label="Opacity" value={opacity} min={5} max={100} step={5} unit="%" onChange={setOpacity} />
          <Slider label="Rotation" value={angle} min={-90} max={90} step={5} unit="°" onChange={setAngle} />
        </>
      )}
    </ImageBatch>
  )
}
