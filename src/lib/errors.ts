export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  // Messages written for users by our own tools (Unlock, Protect) pass through untouched.
  if (/^(Wrong password|Enter |Passwords cannot|This PDF is not protected|Keep at least)/.test(msg)) return msg
  if (/encrypted|password/i.test(msg)) return 'This PDF is password-protected. Use the Unlock PDF tool first.'
  if (/no pdf header|invalid pdf|failed to parse|not a valid pdf/i.test(msg)) return 'Not a valid PDF file.'
  if (/out of memory|allocation/i.test(msg)) return 'File too large for this device’s memory.'
  return msg
}
