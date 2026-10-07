import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// AGPL: the About screen links to the exact source revision this build was made from.
const git = (cmd: string) => {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

export default defineConfig({
  plugins: [react()],
  base: './', // relative paths: works on web subpaths and inside the Capacitor WebView
  worker: { format: 'es' },
  build: { target: 'es2022' },
  define: {
    __COMMIT__: JSON.stringify(git('rev-parse HEAD')),
    __DIRTY__: JSON.stringify(git('status --porcelain') !== ''),
  },
})
