import createCore from '@ffmpeg/core'
import wasmUrl from '@ffmpeg/core/wasm?url'
import { probeFf, runFf, type CoreLoader, type FfInput } from './ffRun.ts'

type Job =
  | { op: 'run'; inputs: FfInput[]; args: string[] }
  | { op: 'probe'; inputs: FfInput[]; path: string }

// Hand the core its wasm bytes: its own locateFile path resolved to a non-hashed URL under Vite.
const load: CoreLoader = async () => createCore({ wasmBinary: await (await fetch(wasmUrl)).arrayBuffer() })

self.onmessage = async (e: MessageEvent<Job>) => {
  try {
    const j = e.data
    if (j.op === 'probe') return void self.postMessage({ type: 'done', result: await probeFf(load, j.inputs, j.path) })
    const files = await runFf(load, j.inputs, j.args, (p) => self.postMessage({ type: 'progress', done: Math.round(p * 1000), total: 1000 }))
    self.postMessage({ type: 'done', result: files }, { transfer: files.map((f) => f.data.buffer) })
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
self.postMessage({ type: 'ready' })
