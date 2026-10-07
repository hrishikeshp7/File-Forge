import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Code2, ExternalLink, FileText, Scale, ShieldCheck } from 'lucide-react'
import { version } from '../../package.json'
import license from '../../LICENSE?raw'

export const SOURCE_URL = 'https://github.com/hrishikeshp7/File-Forge'
const sourceForThisBuild = __COMMIT__ && !__DIRTY__ ? `${SOURCE_URL}/tree/${__COMMIT__}` : SOURCE_URL

interface Dep {
  name: string
  version: string
  license: string
  homepage: string
}

// Corresponding source for bundled copyleft components that are not in node_modules form.
const COPYLEFT = [
  { name: 'Ghostscript 10.x (GhostPDL)', license: 'AGPL-3.0-or-later', src: 'https://ghostscript.com/releases/', note: 'WebAssembly build scripts: https://github.com/okathira/ghostpdl-wasm' },
  { name: 'MuPDF', license: 'AGPL-3.0-or-later', src: 'https://github.com/ArtifexSoftware/mupdf.js', note: 'Artifex Software; engine source at https://mupdf.com/releases' },
  { name: 'libheif', license: 'LGPL-3.0', src: 'https://github.com/strukturag/libheif', note: 'via libheif-js; replaceable by rebuilding this app from source' },
]

export default function About() {
  const [deps, setDeps] = useState<Dep[]>([])
  useEffect(() => {
    fetch('./notices/third-party.json').then((r) => r.json()).then(setDeps).catch(() => {})
  }, [])

  return (
    <article className="about">
      <Link to="/" className="back"><ArrowLeft size={18} /> All tools</Link>
      <h1>About File Forge</h1>
      <p className="hint">Version {version}{__COMMIT__ ? ` · build ${__COMMIT__.slice(0, 7)}${__DIRTY__ ? ' (modified)' : ''}` : ''}</p>

      <section className="panel">
        <h2><ShieldCheck size={18} /> Your files stay on your device</h2>
        <p>All processing happens locally, offline. Nothing is uploaded and no analytics are collected.</p>
      </section>

      <section className="panel">
        <h2><Code2 size={18} /> Free software · Source code</h2>
        <p>
          File Forge is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public
          License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
          Copyright © 2026 File Forge contributors.
        </p>
        <p>
          The complete corresponding source code of the version you are using is available to you, free of charge:
        </p>
        <a className="btn secondary" href={sourceForThisBuild} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Source of this version</a>
        <p className="hint">{SOURCE_URL}</p>
        <p>If you modify File Forge and let others use it, including over a network, you must offer them your modified source under the same license.</p>
      </section>

      <section className="panel">
        <h2><Scale size={18} /> No warranty</h2>
        <p>
          This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
          of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details. Always keep a
          copy of your original files.
        </p>
        <details>
          <summary>Full license text (AGPL-3.0)</summary>
          <pre className="license">{license}</pre>
        </details>
      </section>

      <section className="panel">
        <h2><FileText size={18} /> Third-party components</h2>
        <p>File Forge includes these copyleft components; their source is available here:</p>
        <ul className="plain">
          {COPYLEFT.map((c) => (
            <li key={c.name}>
              <a href={c.src} target="_blank" rel="noreferrer">{c.name}</a> — {c.license}
              <span className="hint"> ({c.note})</span>
            </li>
          ))}
        </ul>
        <details>
          <summary>All bundled packages ({deps.length})</summary>
          <ul className="plain deps">
            {deps.map((d) => (
              <li key={d.name}>
                {d.homepage ? <a href={d.homepage} target="_blank" rel="noreferrer">{d.name}</a> : d.name} {d.version} — {d.license}
              </li>
            ))}
          </ul>
        </details>
        <a className="btn secondary" href="./notices/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">Full license notices</a>
      </section>
    </article>
  )
}
