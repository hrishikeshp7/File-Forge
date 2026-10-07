import { useEffect, useRef, useState } from 'react'
import { FileDrop } from './FileDrop.tsx'
import { Field, Segmented } from './controls.tsx'
import { IMAGE_ACCEPT, decodeImage } from '../lib/image/decode.ts'
import { paperToInk, trimToPng } from '../lib/image/signature.ts'

export interface Signature {
  png: Uint8Array
  aspect: number
  url: string
}

const INKS = ['#111111', '#1a3cff', '#c4121a']
const FONTS: [string, string][] = [
  ['Cursive', `"Snell Roundhand", "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive`],
  ['Italic serif', `italic Georgia, "Times New Roman", serif`],
  ['Marker', `"Marker Felt", "Comic Sans MS", "Chalkboard SE", fantasy`],
]

/** Make a signature: draw it, type it, or upload a photo of it. Emits a trimmed transparent PNG. */
export function SignaturePad({ onChange }: { onChange: (s: Signature | null) => void }) {
  const [mode, setMode] = useState<'draw' | 'type' | 'upload'>('draw')
  const [ink, setInk] = useState(INKS[0])
  const [text, setText] = useState('')
  const [font, setFont] = useState(0)
  const [removeBg, setRemoveBg] = useState(true)
  const [photo, setPhoto] = useState<ImageBitmap | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const url = useRef<string | null>(null)

  const emit = async (c: HTMLCanvasElement | null) => {
    if (url.current) URL.revokeObjectURL(url.current)
    url.current = null
    const t = c && (await trimToPng(c))
    if (!t) return onChange(null)
    url.current = URL.createObjectURL(new Blob([t.png as BlobPart], { type: 'image/png' }))
    onChange({ png: t.png, aspect: t.aspect, url: url.current })
  }
  useEffect(() => () => void (url.current && URL.revokeObjectURL(url.current)), [])

  // Typed name → canvas
  useEffect(() => {
    if (mode !== 'type') return
    if (!text.trim()) return void emit(null)
    const c = document.createElement('canvas')
    c.width = 1400
    c.height = 360
    const ctx = c.getContext('2d')!
    ctx.fillStyle = ink
    ctx.font = `150px ${FONTS[font][1]}`
    ctx.textBaseline = 'middle'
    ctx.fillText(text.trim(), 40, 180, 1320)
    void emit(c)
  }, [mode, text, font, ink]) // eslint-disable-line react-hooks/exhaustive-deps

  // Uploaded photo → transparent ink
  useEffect(() => {
    if (mode !== 'upload' || !photo) return
    if (!removeBg) {
      const c = document.createElement('canvas')
      c.width = photo.width
      c.height = photo.height
      c.getContext('2d')!.drawImage(photo, 0, 0)
      void emit(c)
    } else void emit(paperToInk(photo, ink))
  }, [mode, photo, removeBg, ink]) // eslint-disable-line react-hooks/exhaustive-deps

  const pos = (e: React.PointerEvent) => {
    const c = canvas.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
  }
  const down = (e: React.PointerEvent) => {
    drawing.current = true
    last.current = pos(e)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const ctx = canvas.current!.getContext('2d')!
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.arc(last.current.x, last.current.y, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return
    const p = pos(e)
    const ctx = canvas.current!.getContext('2d')!
    ctx.strokeStyle = ink
    ctx.lineWidth = 7
    ctx.lineCap = ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    void emit(canvas.current)
  }
  const clear = () => {
    canvas.current?.getContext('2d')!.clearRect(0, 0, 1200, 320)
    void emit(null)
  }

  return (
    <div className="grid-gap">
      <Segmented value={mode} onChange={setMode} options={[{ value: 'draw', label: 'Draw' }, { value: 'type', label: 'Type' }, { value: 'upload', label: 'Upload' }]} />
      <div className="chip-row">
        {INKS.map((c) => (
          <button key={c} className={`chip ink${ink === c ? ' on' : ''}`} style={{ borderColor: c }} aria-label={`Ink ${c}`} onClick={() => setInk(c)}>
            <span style={{ background: c }} />
          </button>
        ))}
      </div>
      {mode === 'draw' && (
        <>
          <canvas ref={canvas} className="sigpad" width={1200} height={320} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          <button className="btn ghost small" onClick={clear}>Clear</button>
        </>
      )}
      {mode === 'type' && (
        <>
          <Field label="Your name"><input type="text" value={text} onChange={(e) => setText(e.target.value)} maxLength={40} /></Field>
          <div className="chip-row">
            {FONTS.map(([label, f], i) => (
              <button key={label} className={`chip${font === i ? ' on' : ''}`} style={{ font: `22px ${f}` }} onClick={() => setFont(i)}>{text.trim() || label}</button>
            ))}
          </div>
        </>
      )}
      {mode === 'upload' && (
        <>
          <FileDrop accept={IMAGE_ACCEPT} compact label="Choose a photo of your signature" onFiles={async (f) => setPhoto(await decodeImage(f[0]))} />
          <label className="check"><input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} /> Make the white paper transparent</label>
        </>
      )}
    </div>
  )
}
