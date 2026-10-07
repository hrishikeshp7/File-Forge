import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pager({ page, count, onChange }: { page: number; count: number; onChange: (p: number) => void }) {
  if (count < 2) return null
  return (
    <div className="pager">
      <button className="icon-btn" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={18} /></button>
      <span>Page {page} of {count}</span>
      <button className="icon-btn" aria-label="Next page" disabled={page >= count} onClick={() => onChange(page + 1)}><ChevronRight size={18} /></button>
    </div>
  )
}
