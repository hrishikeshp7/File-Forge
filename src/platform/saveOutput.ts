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

// ponytail: base64 round-trip holds ~2.3x the file in memory; fine to a few hundred MB.
// Upgrade path: chunked appendFile writes when video output lands.
export async function saveOutput(blob: Blob, filename: string): Promise<void> {
  if (isNative) {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: await toBase64(blob),
      directory: Directory.Cache,
    })
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
