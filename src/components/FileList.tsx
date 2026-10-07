import { ChevronDown, ChevronUp, FileText, Image as ImageIcon, X } from 'lucide-react'
import { formatBytes } from '../lib/format.ts'
import type { Item } from './useFiles.ts'

interface Props {
  items: Item[]
  onRemove: (id: string) => void
  onMove?: (id: string, dir: -1 | 1) => void
  meta?: Record<string, string>
}

export function FileList({ items, onRemove, onMove, meta }: Props) {
  return (
    <ul className="rows">
      {items.map(({ id, file }, i) => (
        <li key={id} className="row">
          <span className="row-icon">{file.type.startsWith('image/') ? <ImageIcon size={18} /> : <FileText size={18} />}</span>
          <span className="row-main">
            <span className="row-name">{file.name}</span>
            <span className="row-sub">
              {formatBytes(file.size)}
              {meta?.[id] ? ` · ${meta[id]}` : ''}
            </span>
          </span>
          {onMove && (
            <>
              <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => onMove(id, -1)}>
                <ChevronUp size={18} />
              </button>
              <button className="icon-btn" aria-label="Move down" disabled={i === items.length - 1} onClick={() => onMove(id, 1)}>
                <ChevronDown size={18} />
              </button>
            </>
          )}
          <button className="icon-btn" aria-label={`Remove ${file.name}`} onClick={() => onRemove(id)}>
            <X size={18} />
          </button>
        </li>
      ))}
    </ul>
  )
}
