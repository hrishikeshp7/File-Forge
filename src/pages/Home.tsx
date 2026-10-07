import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { CATEGORIES, TOOLS, type Category } from '../tools/registry.ts'

export default function Home() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'all'>('all')
  const query = q.trim().toLowerCase()
  const list = TOOLS.filter(
    (t) => (cat === 'all' || t.category === cat) && (!query || `${t.name} ${t.desc}`.toLowerCase().includes(query)),
  )

  return (
    <>
      <section className="hero">
        <h1>Every file tool.<br /><span className="grad">Right on your device.</span></h1>
        <p>Nothing is uploaded. Everything runs offline.</p>
        <label className="search">
          <Search size={18} />
          <input type="search" placeholder="Search tools" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="chips">
          {[{ id: 'all' as const, label: 'All' }, ...CATEGORIES].map((c) => (
            <button key={c.id} className={`chip${cat === c.id ? ' on' : ''}`} onClick={() => setCat(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </section>
      <section className="grid">
        {list.map((t) => (
          <Link key={t.id} to={`/tool/${t.id}`} className={`card ${t.category}`}>
            <span className="card-icon"><t.icon size={24} /></span>
            <strong>{t.name}</strong>
            <span>{t.desc}</span>
          </Link>
        ))}
        {!list.length && <p className="hint">No tools match “{q}”.</p>}
      </section>
    </>
  )
}
