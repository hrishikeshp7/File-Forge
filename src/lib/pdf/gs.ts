import type { Level } from './gsRun.ts'

export type { Level }

/** Compress in a throwaway worker: keeps the UI responsive and frees all wasm memory when done. */
export function compressPdf(bytes: Uint8Array, level: Level, onPage?: (done: number, total: number) => void): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./gs.worker.ts', import.meta.url), { type: 'module' })
    const finish = () => worker.terminate()
    worker.onmessage = (e) => {
      const m = e.data
      if (m.type === 'progress') return onPage?.(m.done, m.total)
      finish()
      m.type === 'done' ? resolve(m.bytes) : reject(new Error(m.message))
    }
    worker.onerror = (e) => {
      finish()
      reject(new Error(e.message || 'Compression worker crashed (file may be too large for memory)'))
    }
    worker.postMessage({ bytes: bytes.slice(), level })
  })
}
