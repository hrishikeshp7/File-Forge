import { Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toolById } from '../tools/registry.ts'

export default function ToolPage() {
  const { id = '' } = useParams()
  const tool = toolById(id)
  if (!tool) return <p className="hint">Tool not found. <Link to="/">Back to all tools</Link></p>

  return (
    <>
      <Link to="/" className="back"><ArrowLeft size={18} /> All tools</Link>
      <header className={`tool-head ${tool.category}`}>
        <span className="card-icon"><tool.icon size={24} /></span>
        <div>
          <h1>{tool.name}</h1>
          <p>{tool.desc}</p>
        </div>
      </header>
      <Suspense fallback={<Loader2 className="spin center" />}>
        <tool.Component key={tool.id} />
      </Suspense>
    </>
  )
}
