import { runInWorker } from '../worker.ts'
import type { Allow } from './mupdfRun.ts'

export type { Allow }

const job = (bytes: Uint8Array, rest: Record<string, unknown>) =>
  runInWorker<Uint8Array>(() => new Worker(new URL('./mupdf.worker.ts', import.meta.url), { type: 'module' }), { bytes, ...rest })

export const protectPdf = (bytes: Uint8Array, password: string, allow: Allow) => job(bytes, { op: 'protect', password, allow })
export const unlockPdf = (bytes: Uint8Array, password: string) => job(bytes, { op: 'unlock', password })
export const organizePdf = (bytes: Uint8Array, order: number[]) => job(bytes, { op: 'organize', order })
