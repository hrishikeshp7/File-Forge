import { useEffect, useRef, useState, type ReactNode } from 'react'
import { closePdf, openPdf, renderThumb, type PdfDoc } from '../lib/pdf/render.ts'
import { friendlyError } from '../lib/errors.ts'

/** Opens a PDF with pdf.js for previews; closes it when the file changes or the tool unmounts. */
export function usePdfDoc(file: File | undefined) {
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDoc(null)
    setError(null)
    if (!file) return
    let live = true
    let opened: PdfDoc | null = null
    file
      .arrayBuffer()
      .then((b) => openPdf(new Uint8Array(b)))
      .then((d) => {
        opened = d
        if (live) setDoc(d)
        else void closePdf(d)
      })
      .catch((e) => live && setError(friendlyError(e)))
    return () => {
      live = false
      if (opened) void closePdf(opened)
    }
  }, [file])

  return { doc, error }
}

interface Props {
  doc: PdfDoc
  pageNo: number
  rotation?: number
  label?: string
  onClick?: () => void
  children?: ReactNode
}

/** Lazy page preview: renders only once scrolled near the viewport. `rotation` is a visual CSS turn. */
export function PdfThumb({ doc, pageNo, rotation = 0, label, onClick, children }: Props) {
  const cell = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    let live = true
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        renderThumb(doc, pageNo, 260).then((u) => {
          if (live) setSrc((url = u))
          else URL.revokeObjectURL(u)
        })
      },
      { rootMargin: '200px' },
    )
    io.observe(cell.current!)
    return () => {
      live = false
      io.disconnect()
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc, pageNo])

  const box = (
    <span className="page-box">{src && <img src={src} alt="" style={{ transform: `rotate(${rotation}deg)` }} />}</span>
  )
  return (
    <div ref={cell} className="page">
      {onClick ? (
        <button className="page-hit" onClick={onClick} aria-label={`Rotate page ${pageNo}`}>
          {box}
        </button>
      ) : (
        box
      )}
      <small>{label ?? pageNo}</small>
      {children}
    </div>
  )
}
