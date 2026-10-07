import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Segmented } from '../components/controls.tsx'
import MediaTool, { AUDIO_ACCEPT, VIDEO_ACCEPT } from './MediaTool.tsx'
import { mergeAudio, mergeVideos, type AudioFormat } from '../lib/media/commands.ts'

/** Merge Videos (video-merge) and Merge Audio (audio-merge). */
export default function MergeMedia() {
  const { id } = useParams()
  const video = id !== 'audio-merge'
  const [fmt, setFmt] = useState<AudioFormat>('mp3')
  return (
    <MediaTool
      accept={video ? VIDEO_ACCEPT : AUDIO_ACCEPT}
      multiple
      ordered
      min={2}
      label={video ? 'Add videos' : 'Add audio files'}
      runLabel={video ? 'Merge videos' : 'Merge audio'}
      needVideo={video}
      controls={() =>
        video ? (
          <p className="hint">Clips play in the order shown. Everything is fitted to the first clip's size; clips without sound get silence.</p>
        ) : (
          <Segmented
            value={fmt}
            onChange={setFmt}
            options={[{ value: 'mp3', label: 'MP3' }, { value: 'm4a', label: 'M4A' }, { value: 'wav', label: 'WAV' }, { value: 'flac', label: 'FLAC' }]}
          />
        )
      }
      plan={(files, probes) => [
        { files, base: video ? 'merged' : 'merged-audio', preview: video ? 'video' : 'audio', build: (p) => (video ? mergeVideos(p, probes) : mergeAudio(p, fmt, 192)) },
      ]}
    />
  )
}
