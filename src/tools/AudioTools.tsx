import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Field, Segmented } from '../components/controls.tsx'
import MediaTool, { AUDIO_ACCEPT, MEDIA_ACCEPT, outBase, VIDEO_ACCEPT } from './MediaTool.tsx'
import { toAudio, type AudioFormat } from '../lib/media/commands.ts'

const FORMATS: { value: AudioFormat; label: string }[] = [
  { value: 'mp3', label: 'MP3' },
  { value: 'm4a', label: 'M4A' },
  { value: 'wav', label: 'WAV' },
  { value: 'ogg', label: 'OGG' },
  { value: 'opus', label: 'Opus' },
  { value: 'flac', label: 'FLAC' },
]
const LOSSLESS = new Set<AudioFormat>(['wav', 'flac'])

function Bitrate({ fmt, kbps, setKbps }: { fmt: AudioFormat; kbps: number; setKbps: (n: number) => void }) {
  if (LOSSLESS.has(fmt)) return <p className="hint">{fmt.toUpperCase()} is lossless: files are large.</p>
  return (
    <Field label="Quality">
      <Segmented value={String(kbps)} onChange={(v) => setKbps(Number(v))} options={[64, 128, 192, 256, 320].map((n) => ({ value: String(n), label: `${n}k` }))} />
    </Field>
  )
}

/** Extract Audio (extract-audio): video → audio file. */
export function ExtractAudio() {
  const [fmt, setFmt] = useState<AudioFormat>('mp3')
  const [kbps, setKbps] = useState(192)
  return (
    <MediaTool
      accept={VIDEO_ACCEPT}
      multiple
      needVideo
      label="Add videos"
      runLabel="Extract audio"
      controls={() => (
        <>
          <Segmented value={fmt} onChange={setFmt} options={FORMATS} />
          <Bitrate fmt={fmt} kbps={kbps} setKbps={setKbps} />
        </>
      )}
      plan={(files) => files.map((f) => ({ files: [f], base: outBase(f, ''), preview: 'audio', build: (p) => toAudio(p[0], fmt, kbps) }))}
    />
  )
}

/** Audio Converter (audio-convert) and Compress Audio (audio-compress). Video files work too: their sound is used. */
export function AudioConvert() {
  const { id } = useParams()
  const compress = id === 'audio-compress'
  const [fmt, setFmt] = useState<AudioFormat>(compress ? 'mp3' : 'mp3')
  const [kbps, setKbps] = useState(compress ? 96 : 192)
  return (
    <MediaTool
      accept={compress ? AUDIO_ACCEPT : MEDIA_ACCEPT}
      multiple
      label="Add audio files"
      runLabel={compress ? 'Compress audio' : 'Convert audio'}
      controls={() => (
        <>
          <Segmented value={fmt} onChange={setFmt} options={compress ? FORMATS.filter((f) => !LOSSLESS.has(f.value)) : FORMATS} />
          <Bitrate fmt={fmt} kbps={kbps} setKbps={setKbps} />
        </>
      )}
      plan={(files) => files.map((f) => ({ files: [f], base: outBase(f, compress ? '-small' : ''), preview: 'audio', build: (p) => toAudio(p[0], fmt, kbps) }))}
    />
  )
}
