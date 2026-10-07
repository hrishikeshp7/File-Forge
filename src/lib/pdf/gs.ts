import type { Level } from './gsRun.ts'
import { runInWorker, withBytes, type WorkerOptions } from '../worker.ts'

export type { Level }

export const compressPdf = (bytes: Uint8Array, level: Level, onPage?: WorkerOptions['onProgress'], signal?: AbortSignal) => {
  const { bytes: copy, transfer } = withBytes(bytes)
  return runInWorker<Uint8Array>(() => new Worker(new URL('./gs.worker.ts', import.meta.url), { type: 'module' }), { bytes: copy, level }, { onProgress: onPage, signal, transfer })
}
