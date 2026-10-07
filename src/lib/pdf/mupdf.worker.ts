import { eraseOutside, flattenPdf, organizePdf, protectPdf, unlockPdf, type Allow } from './mupdfRun.ts'

type Job =
  | { op: 'protect'; bytes: Uint8Array; password: string; allow: Allow }
  | { op: 'unlock'; bytes: Uint8Array; password: string }
  | { op: 'organize'; bytes: Uint8Array; order: number[] }
  | { op: 'flatten'; bytes: Uint8Array }
  | { op: 'erase'; bytes: Uint8Array; keep: { x: number; y: number; w: number; h: number }; pages?: number[] }

self.onmessage = (e: MessageEvent<Job>) => {
  try {
    const j = e.data
    const out = j.op === 'protect' ? protectPdf(j.bytes, j.password, j.allow) : j.op === 'unlock' ? unlockPdf(j.bytes, j.password) : j.op === 'flatten' ? flattenPdf(j.bytes) : j.op === 'erase' ? eraseOutside(j.bytes, j.keep, j.pages) : organizePdf(j.bytes, j.order)
    self.postMessage({ type: 'done', result: out }, { transfer: [out.buffer] })
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
self.postMessage({ type: 'ready' })
