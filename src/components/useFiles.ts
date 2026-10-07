import { useCallback, useState } from 'react'

export interface Item {
  id: string
  file: File
}

let n = 0
export const bytesOf = async (f: File) => new Uint8Array(await f.arrayBuffer())

export function useFiles(multiple: boolean) {
  const [items, setItems] = useState<Item[]>([])
  const add = useCallback(
    (files: File[]) => {
      const fresh = files.map((file) => ({ id: `f${n++}`, file }))
      setItems((cur) => (multiple ? [...cur, ...fresh] : fresh.slice(0, 1)))
    },
    [multiple],
  )
  const remove = useCallback((id: string) => setItems((c) => c.filter((i) => i.id !== id)), [])
  const move = useCallback(
    (id: string, dir: -1 | 1) =>
      setItems((c) => {
        const i = c.findIndex((x) => x.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= c.length) return c
        const next = [...c]
        ;[next[i], next[j]] = [next[j], next[i]]
        return next
      }),
    [],
  )
  const clear = useCallback(() => setItems([]), [])
  return { items, add, remove, move, clear }
}
