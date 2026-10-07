import { useEffect, useState } from 'react'
import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { Info, Moon, Sun } from 'lucide-react'
import Home from './pages/Home.tsx'
import ToolPage from './pages/ToolPage.tsx'
import About, { SOURCE_URL } from './pages/About.tsx'

type Theme = 'light' | 'dark'

const initialTheme = (): Theme => {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {}
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#0b0d12' : '#f6f7fb')
    try {
      localStorage.setItem('theme', theme)
    } catch {}
  }, [theme])

  // HashRouter: works in the Capacitor WebView and on static hosting with no server rewrites.
  return (
    <HashRouter>
      <header className="top">
        <Link to="/" className="brand">
          <img src="./favicon.svg" alt="" width={30} height={30} /> File Forge
        </Link>
        <div className="top-actions">
          <Link to="/about" className="icon-btn" aria-label="About and license"><Info size={20} /></Link>
          <button className="icon-btn" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tool/:id" element={<ToolPage />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
      <footer className="foot">
        File Forge is free software (AGPL-3.0, no warranty) · <a href={SOURCE_URL} target="_blank" rel="noreferrer">Source</a> · <Link to="/about">About &amp; licenses</Link>
      </footer>
    </HashRouter>
  )
}
