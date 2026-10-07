import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

function matches(file: File, accept: string): boolean {
  return accept.split(',').some((a) => {
    a = a.trim().toLowerCase()
    if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a)
    if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1))
    return file.type === a
  })
}

interface Props {
  accept: string
  multiple?: boolean
  compact?: boolean
  label?: string
  onFiles: (files: File[]) => void
}

export function FileDrop({ accept, multiple, compact, label, onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => matches(f, accept))
    if (files.length) onFiles(files)
  }

  return (
    <div
      className={`drop${over ? ' over' : ''}${compact ? ' compact' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files)
      }}
    >
      <Upload size={compact ? 18 : 28} />
      <div>
        <strong>{label ?? (multiple ? 'Choose files' : 'Choose a file')}</strong>
        {!compact && <span> or drop here</span>}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          take(e.target.files)
          e.target.value = '' // allow re-picking the same file
        }}
      />
    </div>
  )
}
