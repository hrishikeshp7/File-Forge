export interface Result {
  id: string
  name: string
  blob: Blob
  note?: string
  /** Show an image preview (image tools). */
  preview?: boolean
  /** Set when this file failed; row shows the message instead of a Save button. */
  error?: string
}
