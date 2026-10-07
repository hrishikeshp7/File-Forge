import type { Level } from './gsRun.ts'
import { runInWorker, type WorkerProgress } from '../worker.ts'

export type { Level }

export const compressPdf = (bytes: Uint8Array, level: Level, onPage?: WorkerProgress) =>
  runInWorker<Uint8Array>(() => new Worker(new URL('./gs.worker.ts', import.meta.url), { type: 'module' }), { bytes, level }, onPage)
