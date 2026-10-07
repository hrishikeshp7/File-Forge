import { useCallback, useRef, useState } from 'react'
import { friendlyError } from '../lib/errors.ts'
import type { Result } from './types.ts'

export interface Progress {
  done: number
  total: number
  label?: string
}
export type Report = (done: number, total: number, label?: string) => void

/** Wraps an async job with busy/progress/error/results state. */
export function useRunner() {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Result[]>([])

  const abort = useRef<AbortController | null>(null)

  const run = useCallback(async (job: (report: Report, signal: AbortSignal) => Promise<Result[]>) => {
    const ctl = (abort.current = new AbortController())
    setBusy(true)
    setError(null)
    setResults([])
    setProgress(null)
    try {
      const out = await job((done, total, label) => setProgress({ done, total, label }), ctl.signal)
      if (!ctl.signal.aborted) setResults(out)
    } catch (e) {
      if (!ctl.signal.aborted) setError(friendlyError(e)) // a user cancel is not an error
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }, [])

  const cancel = useCallback(() => abort.current?.abort(), [])

  const reset = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  return { busy, progress, error, results, run, reset, cancel }
}
