import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Field, Segmented } from '../components/controls.tsx'
import { clock } from '../components/useProbes.ts'
import MediaTool, { AUDIO_ACCEPT, outBase, VIDEO_ACCEPT } from './MediaTool.tsx'
import { trim } from '../lib/media/commands.ts'

/** Shared by Trim Video (video-trim) and Trim Audio (audio-trim). */
function Range({ file, duration, isVideo, start, end, setStart, setEnd }: { file: File; duration: number; isVideo: boolean; start: number; end: number; setStart: (n: number) => void; setEnd: (n: number) => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const player = useRef<HTMLVideoElement & HTMLAudioElement>(null)
  const step = Math.max(0.1, duration / 1000)
  useEffect(() => (setStart(0), setEnd(duration)), [file, duration]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {isVideo ? <video ref={player} className="player" src={url} controls playsInline preload="metadata" /> : <audio ref={player} className="player" src={url} controls preload="metadata" />}
      <Field label="Start" value={clock(start)}>
        <input type="range" min={0} max={duration} step={step} value={start} onChange={(e) => setStart(Math.min(Number(e.target.value), end - step))} />
      </Field>
      <Field label="End" value={clock(end)}>
        <input type="range" min={0} max={duration} step={step} value={end} onChange={(e) => setEnd(Math.max(Number(e.target.value), start + step))} />
      </Field>
      <div className="chip-row">
        <button className="chip" onClick={() => player.current && setStart(Math.min(player.current.currentTime, end - step))}>Start = playhead</button>
        <button className="chip" onClick={() => player.current && setEnd(Math.max(player.current.currentTime, start + step))}>End = playhead</button>
      </div>
    </>
  )
}

export default function TrimMedia() {
  const { id } = useParams()
  const isVideo = id !== 'audio-trim'
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [exact, setExact] = useState(true)

  return (
    <MediaTool
      accept={isVideo ? VIDEO_ACCEPT : AUDIO_ACCEPT}
      label={isVideo ? 'Choose a video' : 'Choose an audio file'}
      runLabel={isVideo ? 'Trim video' : 'Trim audio'}
      needVideo={isVideo}
      controls={(files, probes) => {
        const d = probes[0].duration
        return (
          <>
            <Range file={files[0]} duration={d} isVideo={isVideo} start={start} end={end || d} setStart={setStart} setEnd={setEnd} />
            <Segmented
              value={exact ? 'exact' : 'fast'}
              onChange={(v) => setExact(v === 'exact')}
              options={[
                { value: 'exact', label: 'Exact', hint: 're-encodes' },
                { value: 'fast', label: 'Fast', hint: 'no re-encode' },
              ]}
            />
            <p className="hint">{exact ? `Keeps ${clock((end || d) - start)} seconds, cut precisely.` : 'Fast mode copies the data untouched but the cut can be off by a few seconds (it snaps to the nearest keyframe).'}</p>
          </>
        )
      }}
      plan={(files, probes) => [
        { files, base: outBase(files[0], '-trimmed'), preview: isVideo ? 'video' : 'audio', build: (p) => trim(p[0], files[0].name.split('.').pop() ?? 'mp4', probes[0], start, end || probes[0].duration, exact) },
      ]}
      canRun={(_, probes) => (end || probes[0].duration) - start > 0.05}
    />
  )
}
