import { useRef, type PointerEvent, type ReactNode } from 'react'
import { moveRect, resizeRect, type Handle, type Rect } from '../lib/rect.ts'

interface Props {
  src: string
  /** Natural size, only used to turn a pixel aspect ratio into the fraction space the rect lives in. */
  imgW: number
  imgH: number
  rect: Rect
  onChange: (r: Rect) => void
  /** Fixed w/h ratio in image pixels. Corner handles only when set. */
  aspect?: number
  /** Drawn inside the box (e.g. the signature picture). */
  children?: ReactNode
  /** Dim everything outside the box (crop) instead of just outlining it (placement). */
  dim?: boolean
}

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN = 0.04

/** Draggable, resizable box over a picture. Pointer events + touch-action:none so it works with mouse, pen and touch. */
export function CropBox({ src, imgW, imgH, rect, onChange, aspect, children, dim = true }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; w: number; h: number; start: Rect; mode: Handle | 'move' } | null>(null)
  const fracAspect = aspect ? (aspect * imgH) / imgW : undefined

  const down = (mode: Handle | 'move') => (e: PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const b = stage.current!.getBoundingClientRect() // measured now: the preview is scaled by CSS
    drag.current = { x: e.clientX, y: e.clientY, w: b.width, h: b.height, start: rect, mode }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.x) / d.w
    const dy = (e.clientY - d.y) / d.h
    onChange(d.mode === 'move' ? moveRect(d.start, dx, dy) : resizeRect(d.start, d.mode, dx, dy, { min: MIN, aspect: fracAspect }))
  }
  const up = () => (drag.current = null)

  return (
    <div ref={stage} className="cropstage">
      <img src={src} alt="" draggable={false} />
      <div
        className={`cropbox${dim ? ' dim' : ''}`}
        style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
        onPointerDown={down('move')}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {children}
        {HANDLES.filter((h) => !fracAspect || h.length === 2).map((h) => (
          <span key={h} className={`handle ${h}`} data-handle={h} onPointerDown={down(h)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        ))}
      </div>
    </div>
  )
}
