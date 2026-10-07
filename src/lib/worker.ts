export type WorkerProgress = (done: number, total: number) => void

/**
 * Run one job in a throwaway module worker. The worker first posts {type:'ready'} (modules with top-level await, like
 * mupdf, drop messages sent before they finish loading), then answers with
 * {type:'progress',done,total} any number of times, then {type:'done',result} or {type:'error',message}.
 * Terminating afterwards frees all wasm memory, which matters on phones.
 */
export function runInWorker<T>(make: () => Worker, msg: { bytes: Uint8Array } & Record<string, unknown>, onProgress?: WorkerProgress): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = make()
    const copy = msg.bytes.slice() // keep the caller's bytes usable
    worker.onmessage = (e) => {
      const m = e.data
      if (m.type === 'ready') return worker.postMessage({ ...msg, bytes: copy }, [copy.buffer])
      if (m.type === 'progress') return onProgress?.(m.done, m.total)
      worker.terminate()
      m.type === 'done' ? resolve(m.result) : reject(new Error(m.message))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'Worker crashed (file may be too large for memory)'))
    }
  })
}
