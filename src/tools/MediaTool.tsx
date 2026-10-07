import { useMemo, type ReactNode } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { useFiles } from '../components/useFiles.ts'
import { clock, useProbes } from '../components/useProbes.ts'
import { ffmpeg, type Probe } from '../lib/media/ff.ts'
import { baseName, formatBytes } from '../lib/format.ts'
import type { Result } from '../components/types.ts'

/** One ffmpeg run. `build` receives the mounted input paths and returns args + the output file name pattern. */
export interface Plan {
  files: File[]
  build: (paths: string[]) => { args: string[]; name: string }
  /** Output base name (no extension). */
  base: string
  preview?: Result['preview']
  /** Convert each output after ffmpeg (e.g. PNG → JPG with the canvas). */
  post?: (o: { name: string; blob: Blob }) => Promise<{ name: string; blob: Blob }>
}

interface Props {
  accept: string
  multiple?: boolean
  /** Reorderable list (merge). */
  ordered?: boolean
  runLabel: string
  label?: string
  /** Minimum number of files before Run shows. */
  min?: number
  /** Controls rendered under the file list once every file is probed. */
  controls?: (files: File[], probes: Probe[]) => ReactNode
  /** Plans to execute, one ffmpeg run each. Called when Run is pressed. */
  plan: (files: File[], probes: Probe[]) => Plan[]
  canRun?: (files: File[], probes: Probe[]) => boolean
  /** Require a video track (rejects audio-only files). */
  needVideo?: boolean
}

// ponytail: warn-only. Measured in desktop Chromium: a 1.5 GB stream copy still succeeds (input is mounted, not copied);
// transcodes are limited by time, not memory. Phones have far less memory, hence a conservative warning line.
export const BIG_FILE_MB = 1000

export default function MediaTool({ accept, multiple, ordered, runLabel, label, min = 1, controls, plan, canRun, needVideo }: Props) {
  const files = useFiles(!!multiple)
  const r = useRunner()
  const list = useMemo(() => files.items.map((i) => i.file), [files.items])
  const probes = useProbes(list)
  const ready = probes.length > 0 && probes.every((p): p is Probe => !!p && !(p instanceof Error))
  const bad = probes.find((p): p is Error => p instanceof Error)
  const ok = probes as Probe[]
  const noVideo = needVideo && ready && ok.some((p) => !p.hasVideo)
  const big = list.some((f) => f.size > BIG_FILE_MB * 1024 * 1024)
  const meta = Object.fromEntries(
    files.items.map((it, i) => {
      const p = probes[i]
      return [it.id, p instanceof Error ? 'unreadable' : p ? `${clock(p.duration)}${p.hasVideo ? ` · ${p.width}×${p.height}` : ''}` : 'reading…']
    }),
  )

  return (
    <ToolShell
      runLabel={runLabel}
      canRun={ready && list.length >= min && !noVideo && (canRun?.(list, ok) ?? true)}
      {...r}
      cancellable
      error={bad ? bad.message : noVideo ? 'This tool needs a video file.' : r.error}
      onRun={() =>
        r.run(async (report, signal) => {
          const plans = plan(list, ok)
          const results: Result[] = []
          for (const [i, pl] of plans.entries()) {
            const outs = await ffmpeg(pl.files, (paths) => pl.build(paths).args, {
              signal,
              onProgress: (d, t) => report((i + d / t) * 1000, plans.length * 1000, plans.length > 1 ? `${pl.base} (${i + 1}/${plans.length})` : undefined),
            })
            const { name } = pl.build([])
            for (const raw of outs) {
              const o = pl.post ? await pl.post(raw) : raw
              const ext = o.name.split('.').pop()
              results.push({
                id: `${i}-${raw.name}`,
                name: name.includes('%') ? `${pl.base}-${o.name}` : `${pl.base}.${ext}`,
                blob: new Blob([o.blob], { type: mime(ext!) }),
                preview: pl.preview,
                note: pl.files.length === 1 ? `was ${formatBytes(pl.files[0].size)}` : undefined,
              })
            }
          }
          return results
        })
      }
    >
      <FileDrop accept={accept} multiple={multiple} compact={list.length > 0} label={label} onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} onMove={ordered ? files.move : undefined} meta={meta} />
      {big && <p className="hint">Very large file: output is held in memory, so this can fail on phones.</p>}
      {ready && controls && <section className="panel">{controls(list, ok)}</section>}
    </ToolShell>
  )
}

const MIME: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', mov: 'video/quicktime', avi: 'video/x-msvideo', gif: 'image/gif',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', jpg: 'image/jpeg', png: 'image/png',
}
const mime = (ext: string) => MIME[ext] ?? 'application/octet-stream'

export const outBase = (f: File, suffix: string) => `${baseName(f.name)}${suffix}`
export const VIDEO_ACCEPT = 'video/*,.mp4,.mov,.m4v,.mkv,.webm,.avi,.3gp,.ts,.mts,.m2ts'
export const AUDIO_ACCEPT = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac'
export const MEDIA_ACCEPT = `${VIDEO_ACCEPT},${AUDIO_ACCEPT}`
