// Small single-purpose video tools that differ only in controls and ffmpeg arguments.
import { useState } from 'react'
import { Field, Segmented, Slider } from '../components/controls.tsx'
import MediaTool, { outBase, VIDEO_ACCEPT } from './MediaTool.tsx'
import { changeSpeed, extractFrames, muteVideo, resizeVideo, rotateVideo, videoToGif, type Turn } from '../lib/media/commands.ts'
import { processImage } from '../lib/image/process.ts'
import { clock } from '../components/useProbes.ts'

const video = { accept: VIDEO_ACCEPT, needVideo: true, multiple: true, label: 'Add videos' }

export function ResizeVideo() {
  const [h, setH] = useState(720)
  return (
    <MediaTool
      {...video}
      runLabel="Resize videos"
      controls={() => (
        <Segmented
          value={String(h)}
          onChange={(v) => setH(Number(v))}
          options={[240, 360, 480, 720, 1080].map((n) => ({ value: String(n), label: `${n}p` }))}
        />
      )}
      plan={(files, probes) => files.map((f, i) => ({ files: [f], base: outBase(f, `-${h}p`), preview: 'video', build: (p) => resizeVideo(p[0], probes[i], h) }))}
    />
  )
}

export function RotateVideo() {
  const [turn, setTurn] = useState<Turn>('cw')
  return (
    <MediaTool
      {...video}
      runLabel="Rotate videos"
      controls={() => (
        <Segmented
          value={turn}
          onChange={setTurn}
          options={[
            { value: 'cw', label: '90° right' },
            { value: 'ccw', label: '90° left' },
            { value: '180', label: '180°' },
            { value: 'hflip', label: 'Mirror' },
            { value: 'vflip', label: 'Flip' },
          ]}
        />
      )}
      plan={(files, probes) => files.map((f, i) => ({ files: [f], base: outBase(f, '-rotated'), preview: 'video', build: (p) => rotateVideo(p[0], probes[i], turn) }))}
    />
  )
}

export function SpeedVideo() {
  const [speed, setSpeed] = useState(2)
  return (
    <MediaTool
      {...video}
      runLabel="Change speed"
      controls={() => (
        <>
          <Segmented
            value={String(speed)}
            onChange={(v) => setSpeed(Number(v))}
            options={[0.25, 0.5, 1.5, 2, 4].map((n) => ({ value: String(n), label: `${n}×` }))}
          />
          <p className="hint">Sound keeps its pitch. Below 1× is slow motion, above 1× is fast forward.</p>
        </>
      )}
      plan={(files, probes) => files.map((f, i) => ({ files: [f], base: outBase(f, `-${speed}x`), preview: 'video', build: (p) => changeSpeed(p[0], probes[i], speed) }))}
    />
  )
}

export function MuteVideo() {
  return (
    <MediaTool
      {...video}
      runLabel="Remove sound"
      controls={() => <p className="hint">Removes the audio track. The picture is copied untouched, so this is instant and lossless.</p>}
      plan={(files) => files.map((f) => ({ files: [f], base: outBase(f, '-muted'), preview: 'video', build: (p) => muteVideo(p[0], f.name.split('.').pop()!.toLowerCase()) }))}
    />
  )
}

export function VideoGif() {
  const [start, setStart] = useState(0)
  const [len, setLen] = useState(4)
  const [fps, setFps] = useState(12)
  const [width, setWidth] = useState(480)
  return (
    <MediaTool
      accept={VIDEO_ACCEPT}
      needVideo
      label="Choose a video"
      runLabel="Make GIF"
      controls={(_, probes) => (
        <>
          <Slider label={`Start (of ${clock(probes[0].duration)})`} value={start} min={0} max={Math.max(0, Math.floor(probes[0].duration) - 1)} onChange={setStart} unit=" s" />
          <Slider label="Length" value={len} min={1} max={15} onChange={setLen} unit=" s" />
          <Slider label="Frames per second" value={fps} min={5} max={25} onChange={setFps} />
          <Segmented value={String(width)} onChange={(v) => setWidth(Number(v))} options={[240, 360, 480, 720].map((n) => ({ value: String(n), label: `${n}px` }))} />
          <p className="hint">Long, large GIFs get big fast: keep it short.</p>
        </>
      )}
      plan={(files) => [{ files, base: outBase(files[0], ''), preview: 'image', build: (p) => videoToGif(p[0], start, len, fps, width) }]}
    />
  )
}

export function VideoFrames() {
  const [mode, setMode] = useState<'time' | 'every'>('time')
  const [time, setTime] = useState(0)
  const [every, setEvery] = useState(5)
  const [fmt, setFmt] = useState<'jpg' | 'png'>('jpg')
  return (
    <MediaTool
      accept={VIDEO_ACCEPT}
      needVideo
      label="Choose a video"
      runLabel="Extract frames"
      controls={(_, probes) => (
        <>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'time', label: 'One frame' }, { value: 'every', label: 'Every N seconds' }]} />
          {mode === 'time' ? (
            <Slider label={`Time (of ${clock(probes[0].duration)})`} value={time} min={0} max={Math.max(0, Math.floor(probes[0].duration))} onChange={setTime} unit=" s" />
          ) : (
            <Field label="Seconds between frames">
              <input type="number" min={1} value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
          )}
          <Segmented value={fmt} onChange={setFmt} options={[{ value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }]} />
        </>
      )}
      plan={(files) => [{ files, base: outBase(files[0], ''), preview: 'image', build: (p) => extractFrames(p[0], mode === 'time' ? { time } : { everySeconds: every }),
        post: fmt === 'png' ? undefined : async (o) => ({ name: o.name.replace(/\.png$/, '.jpg'), blob: (await processImage(new Blob([o.blob], { type: 'image/png' }), { format: 'image/jpeg', quality: 0.92 })).blob }) }]}
    />
  )
}
