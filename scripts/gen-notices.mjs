// Collect license metadata + license texts of every runtime dependency (AGPL/LGPL/MIT/Apache notice duty).
// Output: public/notices/third-party.json (About screen) and THIRD_PARTY_NOTICES.txt (full texts, de-duplicated).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const root = process.cwd()
const rootPkg = JSON.parse(readFileSync('package.json', 'utf8'))
const seen = new Map()

function locate(name, from) {
  for (let dir = from; ; dir = dirname(dir)) {
    const p = join(dir, 'node_modules', name)
    if (existsSync(join(p, 'package.json'))) return p
    if (dir === dirname(dir)) return null
  }
}

function visit(name, from) {
  const dir = locate(name, from)
  if (!dir) return
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const key = `${pkg.name}@${pkg.version}`
  if (seen.has(key)) return
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(f))
  seen.set(key, {
    name: pkg.name,
    version: pkg.version,
    license: typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'see package'),
    homepage: pkg.homepage ?? (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? '').replace(/^git\+|\.git$/g, ''),
    text: file ? readFileSync(join(dir, file), 'utf8').trim() : '',
  })
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) visit(dep, dir)
}

for (const dep of Object.keys(rootPkg.dependencies)) visit(dep, root)

const list = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
mkdirSync('public/notices', { recursive: true })
writeFileSync('public/notices/third-party.json', JSON.stringify(list.map(({ text, ...meta }) => meta)))

const byText = new Map()
for (const p of list) byText.set(p.text, [...(byText.get(p.text) ?? []), `${p.name}@${p.version} (${p.license})`])
const out = [
  'THIRD-PARTY NOTICES — File Forge',
  '',
  'File Forge itself is AGPL-3.0-or-later. Source: see the About screen.',
  'Bundled components and their licenses follow. Identical texts are listed once.',
  '',
  ...[...byText].flatMap(([text, names]) => ['='.repeat(72), names.join('\n'), '='.repeat(72), text || '(no license file shipped; see license field above)', '']),
]
writeFileSync('public/notices/THIRD_PARTY_NOTICES.txt', out.join('\n'))
console.log(`notices: ${list.length} packages`)
