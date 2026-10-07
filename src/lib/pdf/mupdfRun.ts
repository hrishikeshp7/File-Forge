// MuPDF operations (AES-256 encryption, decryption, lossless page rearranging). Pure bytes in/out: runs in a worker and in node.
import * as mupdf from 'mupdf'

const open = (bytes: Uint8Array) => mupdf.Document.openDocument(bytes, 'application/pdf') as mupdf.PDFDocument
const save = (doc: mupdf.PDFDocument, extra = '') => doc.saveToBuffer(`${extra}${extra ? ',' : ''}compress,garbage=2`).asUint8Array().slice() // copy out of wasm memory (not transferable)

export interface Allow {
  print: boolean
  copy: boolean
  edit: boolean
}

/** Options are a comma-separated string, so a comma in a password cannot be expressed. */
function checkPassword(pw: string) {
  if (pw.includes(',')) throw new Error('Passwords cannot contain a comma.')
}

const randomOwnerPassword = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')

// PDF spec table 22 permission bits (mupdf's Document.PERMISSION holds hasPermission() key codes, not masks).
const BIT = { print: 4, edit: 8, copy: 16, annotate: 32, form: 256, assemble: 1024, printHq: 2048 }

/** Value for `permissions=`: everything allowed except what is switched off. */
function permissions(allow: Allow): number {
  let off = 0
  if (!allow.print) off |= BIT.print | BIT.printHq
  if (!allow.copy) off |= BIT.copy
  if (!allow.edit) off |= BIT.edit | BIT.annotate | BIT.form | BIT.assemble
  return -1 & ~off
}

export function protectPdf(bytes: Uint8Array, userPassword: string, allow: Allow): Uint8Array {
  if (!userPassword) throw new Error('Enter a password.')
  checkPassword(userPassword)
  // Unknown random owner password: the restrictions cannot be lifted with the user password alone.
  const owner = randomOwnerPassword()
  return save(open(bytes), `encrypt=aes-256,user-password=${userPassword},owner-password=${owner},permissions=${permissions(allow)}`)
}

export function unlockPdf(bytes: Uint8Array, password: string): Uint8Array {
  const doc = open(bytes)
  if (doc.needsPassword()) {
    if (!password) throw new Error('Enter the password to unlock this PDF.')
    if (doc.authenticatePassword(password) === 0) throw new Error('Wrong password.')
  } else if (!/encrypt|standard|aes|rc4/i.test(doc.getMetaData(mupdf.Document.META_ENCRYPTION) ?? '')) {
    throw new Error('This PDF is not protected.')
  }
  return save(doc, 'encrypt=none')
}

/** New page list = `order` (0-based source page indexes; may drop or repeat pages). Keeps bookmarks and forms. */
export function organizePdf(bytes: Uint8Array, order: number[]): Uint8Array {
  if (!order.length) throw new Error('Keep at least one page.')
  const doc = open(bytes)
  doc.rearrangePages(order)
  return save(doc)
}

/** Burn form fields and annotations into the page content so they can no longer be edited. */
export function flattenPdf(bytes: Uint8Array): Uint8Array {
  const doc = open(bytes)
  doc.bake(true, true)
  return save(doc)
}

type Rect4 = [number, number, number, number]

/**
 * Permanently delete page content outside `keep` (fractions of the visible page, top-left origin) on the given pages.
 * Images lose their outside pixels, drawings fully outside go, and text is removed character by character: only characters
 * lying completely outside the box are deleted, so a line cut by the edge keeps what is visible. A drawing that crosses the
 * edge stays. Run before setting the crop box (the fractions refer to the uncropped visible page).
 */
export function eraseOutside(bytes: Uint8Array, keep: { x: number; y: number; w: number; h: number }, pages?: number[]): Uint8Array {
  const doc = open(bytes)
  const targets = pages ?? Array.from({ length: doc.countPages() }, (_, i) => i)
  for (const i of targets) {
    const page = doc.loadPage(i)
    const [x0, y0, x1, y1] = page.getBounds() // visible page, y down, /Rotate applied: the space the fractions live in
    const w = x1 - x0, h = y1 - y0
    const kx0 = x0 + keep.x * w, ky0 = y0 + keep.y * h, kx1 = kx0 + keep.w * w, ky1 = ky0 + keep.h * h
    const mark = (rects: Rect4[]) => {
      for (const r of rects) if (r[2] - r[0] > 0.01 && r[3] - r[1] > 0.01) page.createAnnotation('Redact').setRect(r)
    }

    // Runs of characters that lie wholly outside the box, found before anything is changed.
    const runs: Rect4[] = []
    let run: Rect4 | null = null
    const flush = () => {
      if (run) {
        const dx = Math.min((run[2] - run[0]) * 0.1, 1), dy = (run[3] - run[1]) * 0.15 // keep neighbours (and the next line) out of the rect
        runs.push([run[0] + dx, run[1] + dy, run[2] - dx, run[3] - dy])
      }
      run = null
    }
    page.toStructuredText('').walk({
      beginLine: flush,
      endLine: flush,
      onChar(_c, _o, _f, _s, q) {
        const bb: Rect4 = [Math.min(q[0], q[2], q[4], q[6]), Math.min(q[1], q[3], q[5], q[7]), Math.max(q[0], q[2], q[4], q[6]), Math.max(q[1], q[3], q[5], q[7])]
        if (bb[2] <= kx0 || bb[0] >= kx1 || bb[3] <= ky0 || bb[1] >= ky1) run = run ? [Math.min(run[0], bb[0]), Math.min(run[1], bb[1]), Math.max(run[2], bb[2]), Math.max(run[3], bb[3])] : bb
        else flush()
      },
    })

    // Pass 1: the four strips around the box. Blank image pixels, drop drawings fully inside a strip, leave text alone.
    mark([[x0, y0, x1, ky0], [x0, ky1, x1, y1], [x0, ky0, kx0, ky1], [kx1, ky0, x1, ky1]])
    page.applyRedactions(false, 2, 1, 1)
    // Pass 2: only the outside characters; images and drawings untouched.
    mark(runs)
    page.applyRedactions(false, 0, 0, 0)
  }
  return save(doc)
}
