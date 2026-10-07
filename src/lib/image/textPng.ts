/** Render text to a transparent PNG so any script (Devanagari, CJK, emoji) works as a watermark. */
export async function renderTextPng(text: string, color: string, bold: boolean): Promise<{ png: Uint8Array; width: number; height: number }> {
  const size = 160
  const font = `${bold ? 700 : 400} ${size}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
  const probe = document.createElement('canvas').getContext('2d')!
  probe.font = font
  const pad = size * 0.2
  const width = Math.ceil(probe.measureText(text).width + pad * 2)
  const height = Math.ceil(size * 1.4 + pad)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, pad, height / 2)
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Encode failed'))), 'image/png'))
  return { png: new Uint8Array(await blob.arrayBuffer()), width, height }
}
