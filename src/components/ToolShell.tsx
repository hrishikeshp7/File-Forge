import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import type { Progress } from './useRunner.ts'
import { ResultList } from './ResultList.tsx'
import type { Result } from './types.ts'

interface Props {
  children: ReactNode
  runLabel: string
  canRun: boolean
  busy: boolean
  progress: Progress | null
  error: string | null
  results: Result[]
  onRun: () => void
}

/** Common bottom half of every tool: run button, progress, error, results. */
export function ToolShell({ children, runLabel, canRun, busy, progress, error, results, onRun }: Props) {
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : null
  return (
    <div className="tool">
      {children}
      {canRun && (
        <div className="actions">
          <button className="btn primary big" disabled={busy} onClick={onRun}>
            {busy && <Loader2 size={18} className="spin" />} {busy ? 'Working…' : runLabel}
          </button>
        </div>
      )}
      {busy && (
        <div className="progress" role="progressbar" aria-valuenow={pct ?? undefined}>
          <div className="bar" style={{ width: pct === null ? '35%' : `${pct}%` }} data-indeterminate={pct === null} />
          {progress?.label && <span>{progress.label}</span>}
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error.split('Unlock PDF tool').flatMap((part, i) => (i ? [<Link key={i} to="/tool/pdf-unlock">Unlock PDF tool</Link>, part] : [part]))}
        </div>
      )}
      <ResultList results={results} />
    </div>
  )
}
