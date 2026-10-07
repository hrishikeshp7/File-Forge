import { useEffect, useState } from 'react'
import { renderPreview, type PdfDoc } from '../lib/pdf/render.ts'

/** Large preview of one PDF page (rotation applied, like a viewer shows it). */
export function usePagePreview(doc: PdfDoc | null, pageNo: number) {
  const [p, setP] = useState<{ url: string; width: number; height: number } | null>(null)
  useEffect(() => {
    if (!doc) return setP(null)
    let live = true
    let url: string | null = null
    renderPreview(doc, pageNo, 900).then((r) => {
      if (!live) return void URL.revokeObjectURL(r.url)
      url = r.url
      setP(r)
    }, () => {})
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc, pageNo])
  return p
}
