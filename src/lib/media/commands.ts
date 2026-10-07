// ffmpeg argument builders. Pure functions: inputs are paths from inputPath(), outputs go to /out.
import { OUT_DIR, type Probe } from './ffRun.ts'

const out = (name: string) => `${OUT_DIR}/${name}`
const sec = (n: number) => n.toFixed(3)
const evenDown = (n: number) => Math.max(2, n - (n % 2))

/** H.264 + AAC in an MP4-style container that plays everywhere (8-bit 4:2:0, moov atom up front). */
const h264 = (crf: number, preset = 'veryfast') => ['-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
const aac = (kbps = 128) => ['-c:a', 'aac', '-b:a', `${kbps}k`]

export type VideoLevel = 'light' | 'balanced' | 'strong'
export const VIDEO_LEVELS: Record<VideoLevel, { crf: number; maxHeight: number }> = {
  light: { crf: 23, maxHeight: 1080 },
  balanced: { crf: 28, maxHeight: 720 },
  strong: { crf: 32, maxHeight: 480 },
}

/** Scale so the SHORT side is at most `cap` (portrait clips are capped by width). Returns [] when already small enough. */
const capShortSide = (p: Probe, cap: number): string[] =>
  Math.min(p.width, p.height) <= cap ? [] : ['-vf', p.height >= p.width ? `scale=${cap}:-2` : `scale=-2:${cap}`]

/** Shrink a video: re-encode as H.264 (also fixes 10-bit HEVC phone clips) and cap the height. */
export function compressVideo(input: string, p: Probe, level: VideoLevel): { args: string[]; name: string } {
  const { crf, maxHeight } = VIDEO_LEVELS[level]
  const vf = capShortSide(p, maxHeight)
  return { name: 'out.mp4', args: ['-i', input, ...vf, ...h264(crf), ...(p.hasAudio ? aac(level === 'strong' ? 96 : 128) : []), out('out.mp4')] }
}

export type VideoFormat = 'mp4' | 'webm' | 'mkv' | 'mov' | 'avi'
export function convertVideo(input: string, p: Probe, fmt: VideoFormat): { args: string[]; name: string } {
  const name = `out.${fmt}`
  const audio = p.hasAudio
  const codecs: Record<VideoFormat, string[]> = {
    mp4: [...h264(23), ...(audio ? aac() : [])],
    mov: [...h264(23), ...(audio ? aac() : [])],
    mkv: [...h264(23), ...(audio ? aac() : [])],
    // ponytail: VP8 (not VP9) because VP9 in single-threaded wasm is several times slower. Upgrade path: threaded core + VP9.
    webm: ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '0', '-crf', '30', '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'libvorbis', '-q:a', '4'] : [])],
    avi: ['-c:v', 'mpeg4', '-q:v', '4', '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'libmp3lame', '-q:a', '4'] : [])],
  }
  return { name, args: ['-i', input, ...codecs[fmt], out(name)] }
}

export type AudioFormat = 'mp3' | 'm4a' | 'wav' | 'ogg' | 'opus' | 'flac'
export const AUDIO_EXT: AudioFormat[] = ['mp3', 'm4a', 'wav', 'ogg', 'opus', 'flac']
const audioCodec = (fmt: AudioFormat, kbps: number): string[] =>
  ({
    mp3: ['-c:a', 'libmp3lame', '-b:a', `${kbps}k`],
    m4a: ['-c:a', 'aac', '-b:a', `${kbps}k`, '-movflags', '+faststart'],
    wav: ['-c:a', 'pcm_s16le'],
    ogg: ['-c:a', 'libvorbis', '-b:a', `${kbps}k`],
    opus: ['-c:a', 'libopus', '-b:a', `${Math.min(kbps, 256)}k`],
    flac: ['-c:a', 'flac'],
  })[fmt]

/** Audio track (or audio file) → audio file. Used by extract, convert and compress. */
export function toAudio(input: string, fmt: AudioFormat, kbps: number): { args: string[]; name: string } {
  const name = `out.${fmt}`
  return { name, args: ['-i', input, '-vn', ...audioCodec(fmt, kbps), out(name)] }
}

const VIDEO_EXT = /^(mp4|m4v|mov|mkv|webm|avi)$/
/** Cut [start, end] seconds. `exact` re-encodes (frame accurate); otherwise stream copy (fast, snaps to keyframes). */
export function trim(input: string, ext: string, p: Probe, start: number, end: number, exact: boolean): { args: string[]; name: string } {
  const e = ext.toLowerCase() === 'aac' ? 'm4a' : ext.toLowerCase() // raw AAC cannot be stream-copied into an mp3/other muxer
  const isVideo = p.hasVideo && VIDEO_EXT.test(e)
  const container = isVideo ? (e === 'webm' ? 'webm' : e === 'm4v' ? 'mp4' : e) : (AUDIO_EXT as string[]).includes(e) ? e : p.hasVideo ? 'mp4' : 'mp3'
  const name = `out.${container}`
  const cut = ['-ss', sec(start), '-i', input, '-t', sec(Math.max(0.001, end - start))]
  if (!exact) return { name, args: [...cut, '-c', 'copy', '-avoid_negative_ts', 'make_zero', out(name)] }
  if (!isVideo) return { name, args: [...cut, '-vn', ...audioCodec(container as AudioFormat, 192), out(name)] }
  const codecs = container === 'webm' ? ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '0', '-crf', '30', ...(p.hasAudio ? ['-c:a', 'libvorbis'] : [])] : [...h264(20), ...(p.hasAudio ? aac(160) : [])]
  return { name, args: [...cut, ...codecs, out(name)] }
}

/** Join clips. Every clip is scaled/padded to the first clip's size and given a stereo audio track (silence if it had none). */
export function mergeVideos(inputs: string[], probes: Probe[]): { args: string[]; name: string } {
  const W = evenDown(probes[0].width)
  const H = evenDown(probes[0].height)
  const parts: string[] = []
  const labels: string[] = []
  inputs.forEach((_, i) => {
    parts.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${i}]`)
    parts.push(
      probes[i].hasAudio
        ? `[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`
        : `anullsrc=r=44100:cl=stereo,atrim=duration=${sec(probes[i].duration || 1)},asetpts=PTS-STARTPTS[a${i}]`,
    )
    labels.push(`[v${i}][a${i}]`)
  })
  parts.push(`${labels.join('')}concat=n=${inputs.length}:v=1:a=1[v][a]`)
  return { name: 'out.mp4', args: [...inputs.flatMap((p) => ['-i', p]), '-filter_complex', parts.join(';'), '-map', '[v]', '-map', '[a]', ...h264(23), ...aac(), out('out.mp4')] }
}

export function mergeAudio(inputs: string[], fmt: AudioFormat, kbps: number): { args: string[]; name: string } {
  const name = `out.${fmt}`
  const chain = inputs.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=stereo[a${i}]`).join(';')
  const cat = `${inputs.map((_, i) => `[a${i}]`).join('')}concat=n=${inputs.length}:v=0:a=1[a]`
  return { name, args: [...inputs.flatMap((p) => ['-i', p]), '-filter_complex', `${chain};${cat}`, '-map', '[a]', ...audioCodec(fmt, kbps), out(name)] }
}

export function resizeVideo(input: string, p: Probe, height: number): { args: string[]; name: string } {
  // "height" is the short side so 720p means the same for portrait and landscape clips; upscaling is allowed here.
  const vf = p.height >= p.width ? `scale=${evenDown(height)}:-2` : `scale=-2:${evenDown(height)}`
  return { name: 'out.mp4', args: ['-i', input, '-vf', vf, ...h264(23), ...(p.hasAudio ? aac() : []), out('out.mp4')] }
}

export type Turn = 'cw' | 'ccw' | '180' | 'hflip' | 'vflip'
const TURN: Record<Turn, string> = { cw: 'transpose=1', ccw: 'transpose=2', '180': 'hflip,vflip', hflip: 'hflip', vflip: 'vflip' }
export function rotateVideo(input: string, p: Probe, turn: Turn): { args: string[]; name: string } {
  return { name: 'out.mp4', args: ['-i', input, '-vf', TURN[turn], ...h264(23), ...(p.hasAudio ? aac() : []), out('out.mp4')] }
}

/** Playback speed; audio pitch is preserved by chaining atempo (each stage handles 0.5–2×). */
export function changeSpeed(input: string, p: Probe, factor: number): { args: string[]; name: string } {
  const stages: string[] = []
  let f = factor
  while (f > 2) (stages.push('atempo=2'), (f /= 2))
  while (f < 0.5) (stages.push('atempo=0.5'), (f *= 2))
  stages.push(`atempo=${f.toFixed(4)}`)
  const filters = ['-filter_complex', `[0:v]setpts=PTS/${factor}[v]${p.hasAudio ? `;[0:a]${stages.join(',')}[a]` : ''}`, '-map', '[v]', ...(p.hasAudio ? ['-map', '[a]'] : [])]
  return { name: 'out.mp4', args: ['-i', input, ...filters, ...h264(23), ...(p.hasAudio ? aac() : []), out('out.mp4')] }
}

export function muteVideo(input: string, ext: string): { args: string[]; name: string } {
  const name = `out.${/^[a-z0-9]{2,4}$/.test(ext) ? ext : 'mp4'}`
  return { name, args: ['-i', input, '-c:v', 'copy', '-an', out(name)] }
}

export function videoToGif(input: string, start: number, duration: number, fps: number, width: number): { args: string[]; name: string } {
  const vf = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`
  return { name: 'out.gif', args: ['-ss', sec(start), '-t', sec(duration), '-i', input, '-vf', vf, '-loop', '0', out('out.gif')] }
}

/**
 * Frames come out as PNG: this wasm build's MJPEG encoder crashes ("memory access out of bounds") on low qscale and
 * behind the fps filter. The UI converts to JPG with the browser's canvas when asked.
 */
export function extractFrames(input: string, at: { time: number } | { everySeconds: number }): { args: string[]; name: string } {
  if ('time' in at) return { name: 'frame.png', args: ['-ss', sec(at.time), '-i', input, '-frames:v', '1', out('frame.png')] }
  return { name: 'frame_%03d.png', args: ['-i', input, '-vf', `fps=1/${at.everySeconds}`, out('frame_%03d.png')] }
}
