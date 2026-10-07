// Runs the real ffmpeg core in node and verifies outputs with ffprobe. Run: npm run check:media
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { probeFf, runFf, type CoreLoader, type FfInput, type Probe } from '../src/lib/media/ffRun.ts'
import * as C from '../src/lib/media/commands.ts'

// The UMD core expects a worker-like global and fetches wasm itself; give it the bytes instead.
Object.assign(globalThis, { self: globalThis, location: { href: 'file:///ffmpeg-core.js' } })
const require = createRequire(import.meta.url)
const wasmBinary = readFileSync(require.resolve('@ffmpeg/core/wasm'))
const load: CoreLoader = () => require('@ffmpeg/core')({ wasmBinary })

const bytes = (b: Uint8Array) => new Uint8Array(b)
const mk = async (args: string[]) => {
  const t0 = Date.now()
  const r = bytes((await runFf(load, [], args))[0].data)
  console.log(`  fixture ${((Date.now() - t0) / 1000).toFixed(1)}s ${args.slice(-1)[0]}`)
  return r
}
const probe = (data: Uint8Array, ext: string) => probeFf(load, [{ name: `in0.${ext}`, data }], `/in/in0.${ext}`)
const inp = (data: Uint8Array, ext: string, i = 0): FfInput => ({ name: `in${i}.${ext}`, data })
const path = (ext: string, i = 0) => `/in/in${i}.${ext}`
async function run(c: { args: string[] }, inputs: FfInput[]) {
  const t0 = Date.now()
  try {
    return await run0(c, inputs)
  } finally {
    console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)}s ${c.args.filter((a) => !a.startsWith('/')).slice(0, 8).join(' ')}`)
  }
}
async function run0(c: { args: string[] }, inputs: FfInput[]) {
  const files = await runFf(load, inputs, c.args)
  return files.map((f) => ({ ...f, data: bytes(f.data) }))
}
const near = (actual: number, want: number, tol: number, msg: string) => assert.ok(Math.abs(actual - want) <= tol, `${msg}: ${actual} vs ${want} ±${tol}`)

// fixtures
const clip = await mk(['-f', 'lavfi', '-i', 'testsrc=duration=3:size=640x360:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '/out/clip.mp4'])
const muted = await mk(['-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=25', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '/out/m.mp4'])
// 10-bit like a phone clip (libx265 hangs in this single-threaded build, so FFV1 stands in for the pixel format)
const hevc10 = await mk(['-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=25', '-f', 'lavfi', '-i', 'sine=duration=2', '-c:v', 'ffv1', '-pix_fmt', 'yuv420p10le', '-c:a', 'pcm_s16le', '-shortest', '/out/p.mkv'])
const hd = await mk(['-f', 'lavfi', '-i', 'testsrc=duration=1:size=1280x720:rate=25', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '/out/hd.mp4'])
// Phone-style portrait clip: stored landscape + rotation flag (ffmpeg auto-rotates, ffprobe reports stored size)
const portrait = (await runFf(load, [inp(hd, 'mp4')], ['-i', '/in/in0.mp4', '-c', 'copy', '-metadata:s:v:0', 'rotate=90', '/out/r.mp4']))[0].data
const aacRaw = await mk(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=3', '-c:a', 'aac', '/out/s.aac'])
const song = await mk(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=3', '-c:a', 'libmp3lame', '/out/s.mp3'])

const pc = await probe(clip, 'mp4')
assert.deepEqual([pc.hasVideo, pc.hasAudio, pc.width, pc.height, pc.videoCodec], [true, true, 640, 360, 'h264'])
near(pc.duration, 3, 0.2, 'probe duration')
const pm = await probe(muted, 'mp4'); assert.equal(pm.hasAudio, false)
const ps = await probe(song, 'mp3'); assert.deepEqual([ps.hasVideo, ps.hasAudio], [false, true])
const ph = await probe(hevc10, 'mkv'); assert.match(ph.pixFmt ?? '', /10/)

// compress: 10-bit phone-style clip → 8-bit yuv420p H.264; height cap
let o = await run(C.compressVideo(path('mkv'), ph, 'balanced'), [inp(hevc10, 'mkv')])
let p = await probe(o[0].data, 'mp4'); assert.deepEqual([p.videoCodec, p.pixFmt, p.audioCodec], ['h264', 'yuv420p', 'aac'])
const phd = await probe(hd, 'mp4')
o = await run(C.compressVideo(path('mp4'), phd, 'strong'), [inp(hd, 'mp4')])
p = await probe(o[0].data, 'mp4'); assert.equal(p.height, 480); assert.equal(p.width % 2, 0)

// rotation metadata: probe reports the upright size and every tool treats it as portrait
const pr = await probe(portrait, 'mp4')
assert.deepEqual([pr.width, pr.height], [720, 1280], 'probe swaps dimensions for rotate=90')
o = await run(C.compressVideo(path('mp4'), pr, 'strong'), [inp(portrait, 'mp4')])
p = await probe(o[0].data, 'mp4'); assert.equal(p.width, 480, 'portrait compress caps the short side'); assert.ok(p.height > p.width, 'output stays upright')
o = await run(C.resizeVideo(path('mp4'), pr, 360), [inp(portrait, 'mp4')])
p = await probe(o[0].data, 'mp4'); assert.deepEqual([p.width, p.height > p.width], [360, true])
o = await run(C.mergeVideos([path('mp4', 0), path('mp4', 1)], [pr, pc]), [inp(portrait, 'mp4', 0), inp(clip, 'mp4', 1)])
p = await probe(o[0].data, 'mp4'); assert.deepEqual([p.width, p.height], [720, 1280], 'merge box follows the upright first clip')

// raw .aac can only be trimmed into m4a
o = await run(C.trim(path('aac'), 'aac', await probe(aacRaw, 'aac'), 0.5, 2, false), [inp(aacRaw, 'aac')])
assert.equal(o[0].name, 'out.m4a'); p = await probe(o[0].data, 'm4a'); assert.equal(p.audioCodec, 'aac')

// convert
for (const [fmt, codec] of [['webm', 'vp8'], ['mkv', 'h264'], ['mov', 'h264'], ['avi', 'mpeg4'], ['mp4', 'h264']] as const) {
  o = await run(C.convertVideo(path('mp4'), pc, fmt), [inp(clip, 'mp4')])
  p = await probe(o[0].data, fmt); assert.equal(p.videoCodec, codec, fmt); assert.ok(p.hasAudio, `${fmt} keeps audio`); near(p.duration, 3, 0.3, `${fmt} duration`)
}

// trim: exact is accurate, fast copy only needs to land near
o = await run(C.trim(path('mp4'), 'mp4', pc, 1, 2.5, true), [inp(clip, 'mp4')])
near((await probe(o[0].data, 'mp4')).duration, 1.5, 0.15, 'exact trim')
o = await run(C.trim(path('mp4'), 'mp4', pc, 1, 2.5, false), [inp(clip, 'mp4')])
near((await probe(o[0].data, 'mp4')).duration, 1.5, 1.6, 'copy trim (keyframe snapped)')
o = await run(C.trim(path('mp3'), 'mp3', ps, 0.5, 2, true), [inp(song, 'mp3')])
p = await probe(o[0].data, 'mp3'); assert.equal(p.hasVideo, false); near(p.duration, 1.5, 0.15, 'audio trim')

// audio extract / convert
for (const fmt of C.AUDIO_EXT) {
  o = await run(C.toAudio(path('mp4'), fmt, 128), [inp(clip, 'mp4')])
  p = await probe(o[0].data, fmt)
  assert.equal(p.hasVideo, false, `${fmt} has no video`)
  assert.equal(p.audioCodec, { mp3: 'mp3', m4a: 'aac', wav: 'pcm_s16le', ogg: 'vorbis', opus: 'opus', flac: 'flac' }[fmt], fmt)
  near(p.duration, 3, 0.25, `${fmt} duration`)
}

// merge: different sizes, one clip without audio
o = await run(C.mergeVideos([path('mp4', 0), path('mp4', 1)], [pc, pm]), [inp(clip, 'mp4', 0), inp(muted, 'mp4', 1)])
p = await probe(o[0].data, 'mp4'); assert.deepEqual([p.width, p.height, p.hasAudio], [640, 360, true]); near(p.duration, 5, 0.4, 'merged duration')
o = await run(C.mergeAudio([path('mp3', 0), path('mp3', 1)], 'mp3', 128), [inp(song, 'mp3', 0), inp(song, 'mp3', 1)])
near((await probe(o[0].data, 'mp3')).duration, 6, 0.3, 'audio merge')

// speed (incl. >2× which needs chained atempo), resize, rotate, mute
for (const [f, d] of [[2, 1.5], [0.5, 6], [4, 0.75]] as const) {
  o = await run(C.changeSpeed(path('mp4'), pc, f), [inp(clip, 'mp4')])
  p = await probe(o[0].data, 'mp4'); near(p.duration, d, 0.25, `speed ${f}`); assert.ok(p.hasAudio)
}
o = await run(C.resizeVideo(path('mp4'), pc, 180), [inp(clip, 'mp4')])
p = await probe(o[0].data, 'mp4'); assert.deepEqual([p.width, p.height], [320, 180])
o = await run(C.rotateVideo(path('mp4'), pc, 'cw'), [inp(clip, 'mp4')])
p = await probe(o[0].data, 'mp4'); assert.deepEqual([p.width, p.height], [360, 640])
o = await run(C.rotateVideo(path('mp4'), pc, 'hflip'), [inp(clip, 'mp4')])
p = await probe(o[0].data, 'mp4'); assert.deepEqual([p.width, p.height], [640, 360])
o = await run(C.muteVideo(path('mp4'), 'mp4'), [inp(clip, 'mp4')])
p = await probe(o[0].data, 'mp4'); assert.deepEqual([p.hasAudio, p.hasVideo, p.videoCodec], [false, true, 'h264'])

// gif + frames
o = await run(C.videoToGif(path('mp4'), 0.5, 1, 10, 240), [inp(clip, 'mp4')])
assert.equal(Buffer.from(o[0].data.subarray(0, 6)).toString(), 'GIF89a')
p = await probe(o[0].data, 'gif'); assert.equal(p.width, 240)
o = await run(C.extractFrames(path('mp4'), { time: 1 }), [inp(clip, 'mp4')])
assert.deepEqual([...o[0].data.subarray(1, 4)], [0x50, 0x4e, 0x47])
o = await run(C.extractFrames(path('mp4'), { everySeconds: 1 }), [inp(clip, 'mp4')])
assert.equal(o.length, 3); assert.ok(o[0].name.startsWith('frame_001'))

// failures surface ffmpeg's message
await assert.rejects(runFf(load, [inp(new Uint8Array([1, 2, 3, 4]), 'mp4')], ['-i', path('mp4'), '/out/x.mp4']), /Invalid data|moov|error/i)

console.log('selfcheck-media ok')
