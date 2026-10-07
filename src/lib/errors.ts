export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/encrypted|password/i.test(msg)) return 'This PDF is password-protected. Unlock it first.'
  if (/no pdf header|invalid pdf|failed to parse/i.test(msg)) return 'Not a valid PDF file.'
  if (/out of memory|allocation/i.test(msg)) return 'File too large for this device’s memory.'
  return msg
}
