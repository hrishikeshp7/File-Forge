import { useEffect, useMemo, useState } from 'react'
import { Archive, Check, Download } from 'lucide-react'
import { saveOutput } from '../platform/saveOutput.ts'
import { zipFiles } from '../lib/zip.ts'
import { formatBytes } from '../lib/format.ts'
import type { Result } from './types.ts'

/** Cancelling the native share sheet rejects; that is not an error worth showing. */
const isCancel = (e: unknown) => /cancel|dismiss/i.test(e instanceof Error ? e.message : String(e))

function Row({ r }: { r: Result }) {
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const url = useMemo(() => (r.preview ? URL.createObjectURL(r.blob) : null), [r])
  const media = r.preview === 'video' || r.preview === 'audio'
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  return (
    <li className={`row${media ? ' media' : ''}`}>
      {url && r.preview === 'image' && <img className="thumb" src={url} alt="" />}
      <span className="row-main">
        <span className="row-name">{r.name}</span>
        <span className="row-sub">
          {r.error ? <span className="err-text">{r.error}</span> : `${formatBytes(r.blob.size)}${r.note ? ` · ${r.note}` : ''}`}
          {err && <span className="err-text"> · {err}</span>}
        </span>
      </span>
      {!r.error && (
        <button
          className="btn small"
          onClick={async () => {
            setErr(null)
            try {
              await saveOutput(r.blob, r.name)
              setSaved(true)
            } catch (e) {
              if (!isCancel(e)) setErr(e instanceof Error ? e.message : 'Save failed')
            }
          }}
        >
          {saved ? <Check size={16} /> : <Download size={16} />} {saved ? 'Saved' : 'Save'}
        </button>
      )}
      {url && r.preview === 'video' && <video className="player" src={url} controls preload="metadata" playsInline />}
      {url && r.preview === 'audio' && <audio className="player" src={url} controls preload="metadata" />}
    </li>
  )
}

export function ResultList({ results }: { results: Result[] }) {
  const [zipErr, setZipErr] = useState<string | null>(null)
  if (!results.length) return null
  const good = results.filter((r) => !r.error)
  return (
    <section className="panel results">
      <h3>Done</h3>
      <ul className="rows">
        {results.map((r) => (
          <Row key={r.id} r={r} />
        ))}
      </ul>
      {good.length > 1 && (
        <button
          className="btn secondary"
          onClick={async () => {
            setZipErr(null)
            try {
              await saveOutput(await zipFiles(good), 'file-forge.zip')
            } catch (e) {
              if (!isCancel(e)) setZipErr(e instanceof Error ? e.message : 'Save failed')
            }
          }}
        >
          <Archive size={16} /> Save all as ZIP
        </button>
      )}
      {zipErr && <div className="error" role="alert">{zipErr}</div>}
    </section>
  )
}
