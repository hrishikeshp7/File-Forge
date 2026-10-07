// One place that knows web vs Android. Blob-URL downloads do nothing in the Capacitor WebView,
// so native writes to cache and opens the system share sheet (targets vary by device).
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export const isNative = Capacitor.isNativePlatform()

function toBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
}

// Written in 3 MB slices (a multiple of 3 so each slice's base64 concatenates cleanly): a 300 MB video as one
// base64 string would exhaust the WebView's memory. ponytail: unverified on a real device; still copies via the JS bridge.
const CHUNK = 3 * 1024 * 1024

export async function saveOutput(blob: Blob, filename: string): Promise<void> {
  if (isNative) {
    for (let off = 0; off < blob.size || off === 0; off += CHUNK) {
      const args = { path: filename, data: await toBase64(blob.slice(off, off + CHUNK)), directory: Directory.Cache }
      await (off === 0 ? Filesystem.writeFile(args) : Filesystem.appendFile(args))
    }
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
    await Share.share({ title: filename, url: uri, dialogTitle: 'Save or share' })
    return
  }
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
