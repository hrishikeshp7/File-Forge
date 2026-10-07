// Ghostscript (pdfwrite) compression. Takes a module loader so it runs in a Web Worker (app) and node (self-check).
import type { GhostscriptModule } from '@okathira/ghostpdl-wasm'

export type Level = 'light' | 'balanced' | 'strong' | 'extreme'

/** dpi = image downsample target; q = JPEG QFactor (lower = better quality). */
export const GS_LEVELS: Record<Level, { dpi: number; q: number }> = {
  light: { dpi: 200, q: 0.4 },
  balanced: { dpi: 150, q: 0.76 },
  strong: { dpi: 100, q: 1.3 },
  extreme: { dpi: 72, q: 2.0 },
}

export type Loader = (hooks: { print: (s: string) => void; printErr: (s: string) => void }) => Promise<GhostscriptModule>

const jpegDict = (q: number) => `<</QFactor ${q} /Blend 1 /HSamples [1 1 1 1] /VSamples [1 1 1 1]>>`

export async function gsCompress(
  load: Loader,
  input: Uint8Array,
  level: Level,
  onPage?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const { dpi, q } = GS_LEVELS[level]
  // Ghostscript turns garbage into an empty PDF with exit code 0, so reject non-PDFs up front.
  if (!new TextDecoder('latin1').decode(input.subarray(0, 1024)).includes('%PDF-')) throw new Error('Not a valid PDF file.')
  let total = 0
  const errs: string[] = []
  const gs = await load({
    print: (s) => {
      const t = /through (\d+)/.exec(s)
      if (t) total = Number(t[1])
      const p = /^Page (\d+)/.exec(s)
      if (p) onPage?.(Number(p[1]), total)
    },
    printErr: (s) => errs.push(s),
  })
  gs.FS.writeFile('in.pdf', input)
  const rc = gs.callMain([
    '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dNOPAUSE', '-dBATCH', '-dSAFER',
    '-dDetectDuplicateImages=true', '-dCompressFonts=true', '-dSubsetFonts=true',
    '-dDownsampleColorImages=true', '-dDownsampleGrayImages=true', '-dDownsampleMonoImages=true',
    `-dColorImageResolution=${dpi}`, `-dGrayImageResolution=${dpi}`, `-dMonoImageResolution=${dpi * 2}`,
    '-dColorImageDownsampleType=/Bicubic', '-dGrayImageDownsampleType=/Bicubic',
    '-sOutputFile=out.pdf',
    '-c',
    `<</ColorImageDict ${jpegDict(q)} /GrayImageDict ${jpegDict(q)} /AutoFilterColorImages false /ColorImageFilter /DCTEncode /AutoFilterGrayImages false /GrayImageFilter /DCTEncode>> setdistillerparams`,
    '-f', 'in.pdf',
  ])
  let out: Uint8Array | null = null
  try {
    out = gs.FS.readFile('out.pdf')
  } catch {}
  if (rc !== 0 || !out?.length || total === 0) {
    const msg = errs.join(' ')
    throw new Error(/password/i.test(msg) ? 'password-protected' : msg ? `Ghostscript failed: ${msg.slice(0, 200)}` : 'Could not read this PDF.')
  }
  return out
}
