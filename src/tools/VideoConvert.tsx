import { useState } from 'react'
import { Segmented } from '../components/controls.tsx'
import MediaTool, { outBase, VIDEO_ACCEPT } from './MediaTool.tsx'
import { convertVideo, type VideoFormat } from '../lib/media/commands.ts'

export default function VideoConvert() {
  const [fmt, setFmt] = useState<VideoFormat>('mp4')
  return (
    <MediaTool
      accept={VIDEO_ACCEPT}
      multiple
      label="Add videos"
      runLabel="Convert videos"
      needVideo
      controls={() => (
        <>
          <Segmented
            value={fmt}
            onChange={setFmt}
            options={[
              { value: 'mp4', label: 'MP4' },
              { value: 'webm', label: 'WebM' },
              { value: 'mkv', label: 'MKV' },
              { value: 'mov', label: 'MOV' },
              { value: 'avi', label: 'AVI' },
            ]}
          />
          <p className="hint">{fmt === 'webm' ? 'WebM uses VP8 so it finishes in reasonable time on a phone.' : 'H.264 + AAC for the best compatibility.'} Video is re-encoded.</p>
        </>
      )}
      plan={(files, probes) =>
        files.map((f, i) => ({ files: [f], base: outBase(f, ''), preview: 'video', build: (p) => convertVideo(p[0], probes[i], fmt) }))
      }
    />
  )
}
