export type WorkerProgress = (done: number, total: number) => void

export interface WorkerOptions {
  onProgress?: WorkerProgress
  /** Aborting terminates the worker immediately (frees all wasm memory) and rejects with "Cancelled". */
  signal?: AbortSignal
  /** Objects moved (not copied) to the worker with the job. */
  transfer?: Transferable[]
}

/**
 * Run one job in a throwaway module worker. The worker first posts {type:'ready'} (modules with top-level await, like
 * mupdf, drop messages sent before they finish loading), then answers with
 * {type:'progress',done,total} any number of times, then {type:'done',result} or {type:'error',message}.
 */
export function runInWorker<T>(make: () => Worker, msg: Record<string, unknown>, { onProgress, signal, transfer = [] }: WorkerOptions = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Cancelled'))
    const worker = make()
    const finish = () => {
      worker.terminate()
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      finish()
      reject(new Error('Cancelled'))
    }
    signal?.addEventListener('abort', onAbort)
    worker.onmessage = (e) => {
      const m = e.data
      if (m.type === 'ready') return worker.postMessage(msg, transfer)
      if (m.type === 'progress') return onProgress?.(m.done, m.total)
      finish()
      m.type === 'done' ? resolve(m.result) : reject(new Error(m.message))
    }
    worker.onerror = (e) => {
      finish()
      reject(new Error(e.message || 'Worker crashed (file may be too large for memory)'))
    }
  })
}

/** Copy bytes into a fresh buffer and hand it to the worker (the caller keeps using its own copy). */
export function withBytes(bytes: Uint8Array): { bytes: Uint8Array; transfer: Transferable[] } {
  const copy = bytes.slice()
  return { bytes: copy, transfer: [copy.buffer] }
}
