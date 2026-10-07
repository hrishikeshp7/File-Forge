import { useEffect, useState } from 'react'
import { decodeImage } from '../lib/image/decode.ts'

export interface Preview {
  url: string
  /** Full-resolution, EXIF-oriented size: crop fractions refer to this picture. */
  width: number
  height: number
}

/** Browser-displayable preview of any decodable image (HEIC, TIFF, SVG too). Fractions of it map onto the full-size bitmap. */
export function usePreview(file: Blob | undefined, maxSide = 1400): Preview | null {
  const [p, setP] = useState<Preview | null>(null)
  useEffect(() => {
    setP(null)
    if (!file) return
    let live = true
    let url: string | null = null
    ;(async () => {
      const bmp = await decodeImage(file)
      const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
      const c = document.createElement('canvas')
      c.width = Math.round(bmp.width * k)
      c.height = Math.round(bmp.height * k)
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
      const full = { width: bmp.width, height: bmp.height }
      bmp.close()
      const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('preview failed'))), 'image/jpeg', 0.9))
      if (!live) return
      url = URL.createObjectURL(blob)
      setP({ url, ...full })
    })().catch(() => {})
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [file, maxSide])
  return p
}
