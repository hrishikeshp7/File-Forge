import { runInWorker, type WorkerOptions } from '../worker.ts'
import { inputName, inputPath, type FfFile, type Probe } from './ffRun.ts'

export type { FfFile, Probe }
export { inputPath }

const make = () => new Worker(new URL('./ff.worker.ts', import.meta.url), { type: 'module' })

/**
 * Run ffmpeg on the given files. `args` is built from the input paths, e.g. (p) => ['-i', p[0], ..., '/out/out.mp4'].
 * Inputs are mounted, not copied. Files written to /out come back as Blobs.
 */
export async function ffmpeg(files: File[], args: (inputs: string[]) => string[], opts: WorkerOptions = {}): Promise<{ name: string; blob: Blob }[]> {
  const inputs = files.map((f, i) => ({ name: inputName(i, f.name), data: f as Blob }))
  const out = await runInWorker<FfFile[]>(make, { op: 'run', inputs, args: args(files.map((f, i) => inputPath(i, f.name))) }, opts)
  return out.map((f) => ({ name: f.name, blob: new Blob([f.data as BlobPart]) }))
}

export function probe(file: File): Promise<Probe> {
  return runInWorker<Probe>(make, { op: 'probe', inputs: [{ name: inputName(0, file.name), data: file }], path: inputPath(0, file.name) })
}
