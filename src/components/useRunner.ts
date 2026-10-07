import { useCallback, useState } from 'react'
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

  const run = useCallback(async (job: (report: Report) => Promise<Result[]>) => {
    setBusy(true)
    setError(null)
    setResults([])
    setProgress(null)
    try {
      setResults(await job((done, total, label) => setProgress({ done, total, label })))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }, [])

  const reset = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  return { busy, progress, error, results, run, reset }
}
