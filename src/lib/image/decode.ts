// Anything the browser cannot decode natively (HEIC/HEIF, TIFF) goes through wasm/JS decoders; SVG gets rasterized.
// Native decoders handle JPEG, PNG, WebP, GIF, BMP, ICO, AVIF.
export const IMAGE_ACCEPT = 'image/*,.heic,.heif,.tif,.tiff'

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'])

type Kind = 'heic' | 'tiff' | 'svg' | 'native'

async function sniff(file: Blob): Promise<Kind> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
  if (ascii(4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(8, 12))) return 'heic'
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a)) return 'tiff'
  const name = (file as File).name?.toLowerCase() ?? ''
  if (file.type === 'image/svg+xml' || name.endsWith('.svg')) return 'svg'
  return 'native'
}

let heifModule: Promise<Awaited<ReturnType<typeof loadHeif>>> | undefined
const loadHeif = async () => (await import('libheif-js/libheif-wasm/libheif-bundle.mjs')).default()

async function decodeHeic(file: Blob): Promise<ImageBitmap> {
  const heif = await (heifModule ??= loadHeif())
  // libheif applies the HEIC rotation/mirror transforms itself, so no EXIF handling needed.
  const [img] = new heif.HeifDecoder().decode(new Uint8Array(await file.arrayBuffer()))
  if (!img) throw new Error('Empty HEIC file')
  const target = { data: new Uint8ClampedArray(img.get_width() * img.get_height() * 4), width: img.get_width(), height: img.get_height() }
  await new Promise<void>((res, rej) => img.display(target, (r) => (r ? res() : rej(new Error('Could not decode HEIC')))))
  return createImageBitmap(new ImageData(target.data, target.width, target.height))
}

async function decodeTiff(file: Blob): Promise<ImageBitmap> {
  const UTIF = await import('utif2')
  const buf = await file.arrayBuffer()
  const ifd = UTIF.decode(buf)[0]
  if (!ifd) throw new Error('Empty TIFF file')
  UTIF.decodeImage(buf, ifd)
  return createImageBitmap(new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(ifd)), ifd.width, ifd.height))
}

async function decodeSvg(file: Blob): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const w = img.naturalWidth || 1024
    const h = img.naturalHeight || 1024
    const k = Math.max(1, 1024 / Math.max(w, h)) // vectors scale up for free; icons are often 24px
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * k)
    canvas.height = Math.round(h * k)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return createImageBitmap(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function decodeImage(file: Blob, exif = true): Promise<ImageBitmap> {
  switch (await sniff(file)) {
    case 'heic':
      return decodeHeic(file)
    case 'tiff':
      return decodeTiff(file)
    case 'svg':
      return decodeSvg(file)
    default:
      return createImageBitmap(file, { imageOrientation: exif ? 'from-image' : 'none' })
  }
}
