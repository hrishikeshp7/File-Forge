import type { ReactNode } from 'react'
import { FileDrop } from '../components/FileDrop.tsx'
import { FileList } from '../components/FileList.tsx'
import { ToolShell } from '../components/ToolShell.tsx'
import { useRunner } from '../components/useRunner.ts'
import { useFiles } from '../components/useFiles.ts'
import { IMAGE_ACCEPT } from '../lib/image/decode.ts'
import { EXT, processImage, type ImageOptions } from '../lib/image/process.ts'
import { baseName, formatBytes, savedPercent } from '../lib/format.ts'

interface Props {
  /** File-picker filter; defaults to every image type we can decode. */
  accept?: string
  runLabel: string
  opts: ImageOptions
  /** Appended to the output base name, e.g. "-compressed". */
  suffix?: string
  /** Hand back the original when re-encoding made it bigger (compress). */
  keepIfLarger?: boolean
  /** Show the % size change (compress/resize). Off for format conversion, where it is just noise. */
  showSavings?: boolean
  /** Rendered once files are chosen: the tool's option controls. */
  children: (files: File[]) => ReactNode
}

/** Shared flow for image compress / resize / convert: many files in, many images out. */
export function ImageBatch({ accept = IMAGE_ACCEPT, runLabel, opts, suffix = '', keepIfLarger, showSavings, children }: Props) {
  const files = useFiles(true)
  const r = useRunner()

  return (
    <ToolShell
      runLabel={runLabel}
      canRun={files.items.length > 0}
      {...r}
      onRun={() =>
        r.run(async (report) => {
          const out = []
          for (const [i, { id, file }] of files.items.entries()) {
            report(i, files.items.length, file.name)
            let res
            try {
              res = await processImage(file, opts)
            } catch {
              out.push({ id, name: file.name, blob: file, error: 'Could not read this image (corrupt or unsupported)' })
              continue
            }
            const keep = keepIfLarger && res.blob.size >= file.size
            const blob = keep ? file : res.blob
            const ext = keep ? (file.name.split('.').pop() ?? 'img') : (EXT[res.blob.type] ?? 'png')
            out.push({
              id,
              name: `${baseName(file.name)}${suffix}.${ext}`,
              blob,
              preview: 'image' as const,
              note: keep
                ? 'Already optimal, kept original'
                : `${res.width}×${res.height} · ${
                    showSavings ? `${blob.size <= file.size ? '−' : '+'}${Math.abs(savedPercent(file.size, blob.size))}% · ` : ''
                  }was ${formatBytes(file.size)}`,
            })
          }
          return out
        })
      }
    >
      <FileDrop accept={accept} multiple compact={files.items.length > 0} label="Add images" onFiles={(f) => { files.add(f); r.reset() }} />
      <FileList items={files.items} onRemove={files.remove} />
      {files.items.length > 0 && <section className="panel">{children(files.items.map((i) => i.file))}</section>}
    </ToolShell>
  )
}
