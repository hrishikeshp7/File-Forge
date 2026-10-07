export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB']
  let i = -1
  do {
    n /= 1024
    i++
  } while (n >= 1024 && i < u.length - 1)
  return `${n.toFixed(n < 10 ? 2 : 1)} ${u[i]}`
}

export const baseName = (name: string) => name.replace(/\.[^.]+$/, '')

export const savedPercent = (before: number, after: number) =>
  before > 0 ? Math.round((1 - after / before) * 100) : 0
