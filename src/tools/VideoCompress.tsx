import { useState } from 'react'
import { Segmented } from '../components/controls.tsx'
import MediaTool, { outBase, VIDEO_ACCEPT } from './MediaTool.tsx'
import { compressVideo, VIDEO_LEVELS, type VideoLevel } from '../lib/media/commands.ts'
import type { Probe } from '../lib/media/ff.ts'

/** ~3× realtime for 720p measured in desktop Chromium (heavy noisy 720p30 clip: 93 s for 30 s). Scales with output pixels. */
function estimate(p: Probe, level: VideoLevel): string {
  const h = Math.min(p.height, VIDEO_LEVELS[level].maxHeight)
  const px = (h * (p.width / p.height) * h) / (1280 * 720)
  const min = (p.duration * 3 * Math.max(px, 0.2)) / 60
  return min < 1 ? 'under a minute' : `about ${Math.round(min)} min`
}

export default function VideoCompress() {
  const [level, setLevel] = useState<VideoLevel>('balanced')
  return (
    <MediaTool
      accept={VIDEO_ACCEPT}
      multiple
      label="Add videos"
      runLabel="Compress videos"
      needVideo
      controls={(_, probes) => (
        <>
          <Segmented
            value={level}
            onChange={setLevel}
            options={[
              { value: 'light', label: 'Light', hint: 'up to 1080p' },
              { value: 'balanced', label: 'Balanced', hint: 'up to 720p' },
              { value: 'strong', label: 'Strong', hint: 'up to 480p' },
            ]}
          />
          <p className="hint">
            Re-encodes as H.264 (plays everywhere, including 10-bit HEVC phone clips) and limits the height to {VIDEO_LEVELS[level].maxHeight}p.
            Runs on your device: estimated {probes.map((p) => estimate(p, level)).join(' + ')} on a computer, slower on a phone. You can cancel any time.
          </p>
        </>
      )}
      plan={(files, probes) =>
        files.map((f, i) => ({ files: [f], base: outBase(f, '-compressed'), preview: 'video', build: (p) => compressVideo(p[0], probes[i], level) }))
      }
    />
  )
}
