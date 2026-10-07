export interface Result {
  id: string
  name: string
  blob: Blob
  note?: string
  /** Inline preview of the result. */
  preview?: 'image' | 'video' | 'audio'
  /** Set when this file failed; row shows the message instead of a Save button. */
  error?: string
}
