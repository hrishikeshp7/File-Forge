// ffmpeg core driver. Pure: takes a loader, so the same code runs in a Web Worker (app) and in node (self-check).
export interface Core {
  FS: any
  exec(...args: string[]): number
  ffprobe(...args: string[]): number
  reset(): void
  setLogger(fn: (l: { type: string; message: string }) => void): void
  setProgress(fn: (p: { progress: number; time: number }) => void): void
}
export type CoreLoader = () => Promise<Core>

export interface FfInput {
  /** Becomes /in/<name>. Callers pick safe, unique names (see inputPath). */
  name: string
  /** Blob → mounted lazily via WORKERFS (no copy). Uint8Array → written into memory. */
  data: Blob | Uint8Array
}
export interface FfFile {
  name: string
  data: Uint8Array
}

/** Stable, collision-free path for the i-th input, independent of the user's file name. */
export const inputName = (i: number, original: string) => `in${i}${/\.[a-z0-9]{1,5}$/i.exec(original)?.[0].toLowerCase() ?? ''}`
export const inputPath = (i: number, original: string) => `/in/${inputName(i, original)}`
export const OUT_DIR = '/out'

async function prepare(core: Core, inputs: FfInput[]) {
  const { FS } = core
  FS.mkdir('/in')
  FS.mkdir(OUT_DIR)
  const blobs = inputs.filter((i) => i.data instanceof Blob)
  if (blobs.length) FS.mount(FS.filesystems.WORKERFS, { blobs: blobs.map((b) => ({ name: b.name, data: b.data })) }, '/in')
  for (const i of inputs) if (!(i.data instanceof Blob)) FS.writeFile(`/in/${i.name}`, i.data)
}

function logger(core: Core) {
  const tail: string[] = []
  core.setLogger(({ message }) => {
    tail.push(message)
    if (tail.length > 40) tail.shift()
  })
  return tail
}

/** Run ffmpeg once; everything written to /out is returned. Throws with ffmpeg's last lines on failure. */
export async function runFf(
  load: CoreLoader,
  inputs: FfInput[],
  args: string[],
  onProgress?: (ratio: number) => void,
): Promise<FfFile[]> {
  const core = await load()
  const tail = logger(core)
  core.setProgress(({ progress }) => onProgress?.(Math.max(0, Math.min(1, progress))))
  await prepare(core, inputs)
  const rc = core.exec(...args)
  core.reset()
  if (rc !== 0) throw new Error(ffError(tail))
  const names: string[] = core.FS.readdir(OUT_DIR).filter((n: string) => n !== '.' && n !== '..')
  if (!names.length) throw new Error(ffError(tail) || 'ffmpeg produced no output')
  return names.sort().map((name) => ({ name, data: core.FS.readFile(`${OUT_DIR}/${name}`) as Uint8Array }))
}

export interface Probe {
  duration: number
  /** Upright (after rotation metadata). */
  width: number
  height: number
  hasVideo: boolean
  hasAudio: boolean
  videoCodec?: string
  pixFmt?: string
  /** Container names as ffprobe reports them, e.g. "mov,mp4,m4a,3gp,3g2,mj2". */
  format?: string
  audioCodec?: string
}

/** ffprobe JSON → the few facts the tools need. */
export async function probeFf(load: CoreLoader, inputs: FfInput[], path: string): Promise<Probe> {
  const core = await load()
  const out: string[] = []
  core.setLogger(({ type, message }) => type === 'stdout' && out.push(message))
  await prepare(core, inputs)
  core.ffprobe('-v', 'error', '-show_format', '-show_streams', '-of', 'json', path)
  core.reset()
  let j: any
  try {
    j = JSON.parse(out.join('\n'))
  } catch {
    throw new Error('Could not read this media file.')
  }
  const v = j.streams?.find((s: any) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1)
  // Phone clips are stored landscape with a rotation flag; ffmpeg auto-rotates, so report the upright size.
  const rot = Number(v?.side_data_list?.find((d: any) => d.rotation !== undefined)?.rotation ?? v?.tags?.rotate ?? 0)
  const turned = Math.abs(rot) % 180 === 90
  const a = j.streams?.find((s: any) => s.codec_type === 'audio')
  return {
    duration: Number(j.format?.duration ?? v?.duration ?? a?.duration ?? 0),
    width: (turned ? v?.height : v?.width) ?? 0,
    height: (turned ? v?.width : v?.height) ?? 0,
    hasVideo: !!v,
    hasAudio: !!a,
    videoCodec: v?.codec_name,
    pixFmt: v?.pix_fmt,
    format: j.format?.format_name,
    audioCodec: a?.codec_name,
  }
}

function ffError(tail: string[]): string {
  const useful = tail.filter((l) => /error|invalid|no such|unable|not found|failed|unsupported|cannot/i.test(l))
  return (useful.length ? useful : tail).slice(-3).join(' · ')
}
