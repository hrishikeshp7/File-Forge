import { useEffect, useState } from 'react'
import { probe, type Probe } from '../lib/media/ff.ts'

const cache = new WeakMap<File, Promise<Probe>>()

// One probe at a time: each probe starts a worker that compiles ~31 MB of wasm.
let queue: Promise<unknown> = Promise.resolve()
const enqueue = (f: File) => {
  const p = queue.then(() => probe(f))
  queue = p.catch(() => {})
  return p
}

/** ffprobe facts for each file (cached per File object). `null` while loading, `Error` if unreadable. */
export function useProbes(files: File[]): (Probe | Error | null)[] {
  const [done, setDone] = useState<Map<File, Probe | Error>>(new Map())
  useEffect(() => {
    let live = true
    for (const f of files) {
      if (!cache.has(f)) cache.set(f, enqueue(f))
      cache.get(f)!.then(
        (p) => live && setDone((m) => new Map(m).set(f, p)),
        (e) => live && setDone((m) => new Map(m).set(f, new Error(e instanceof Error && e.message ? e.message : 'Could not read this media file.'))),
      )
    }
    return () => void (live = false)
  }, [files])
  return files.map((f) => done.get(f) ?? null)
}

export const clock = (s: number) => {
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}
