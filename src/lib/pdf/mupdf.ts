import { runInWorker, withBytes } from '../worker.ts'
import type { Allow } from './mupdfRun.ts'

export type { Allow }

const job = (bytes: Uint8Array, rest: Record<string, unknown>) => {
  const { bytes: copy, transfer } = withBytes(bytes)
  return runInWorker<Uint8Array>(() => new Worker(new URL('./mupdf.worker.ts', import.meta.url), { type: 'module' }), { bytes: copy, ...rest }, { transfer })
}

export const protectPdf = (bytes: Uint8Array, password: string, allow: Allow) => job(bytes, { op: 'protect', password, allow })
export const unlockPdf = (bytes: Uint8Array, password: string) => job(bytes, { op: 'unlock', password })
export const organizePdf = (bytes: Uint8Array, order: number[]) => job(bytes, { op: 'organize', order })
export const flattenPdf = (bytes: Uint8Array) => job(bytes, { op: 'flatten' })
export const eraseOutside = (bytes: Uint8Array, keep: { x: number; y: number; w: number; h: number }, pages?: number[]) => job(bytes, { op: 'erase', keep, pages })
