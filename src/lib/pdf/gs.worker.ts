import loadWASM from '@okathira/ghostpdl-wasm'
import wasmUrl from '@okathira/ghostpdl-wasm/gs.wasm?url'
import { gsCompress, type Level } from './gsRun.ts'

self.onmessage = async (e: MessageEvent<{ bytes: Uint8Array; level: Level }>) => {
  try {
    const out = await gsCompress(
      (hooks) => loadWASM({ ...hooks, locateFile: () => wasmUrl }),
      e.data.bytes,
      e.data.level,
      (done, total) => self.postMessage({ type: 'progress', done, total }),
    )
    self.postMessage({ type: 'done', bytes: out }, { transfer: [out.buffer] })
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
