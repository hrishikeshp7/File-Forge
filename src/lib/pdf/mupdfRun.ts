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
