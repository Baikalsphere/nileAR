export interface AttachmentMeta {
  name: string
  size: number
  type: string
}

export interface AttachedDocumentsMeta {
  roomCharges?: AttachmentMeta
  foodBeverage?: AttachmentMeta
  barLounge?: AttachmentMeta
  roomService?: AttachmentMeta
  laundry?: AttachmentMeta
  spaWellness?: AttachmentMeta
  minibar?: AttachmentMeta
  conferenceHall?: AttachmentMeta
  parking?: AttachmentMeta
  miscellaneous?: AttachmentMeta
}

export interface SkippedDocumentsMeta {
  roomCharges?: boolean
  foodBeverage?: boolean
  barLounge?: boolean
  roomService?: boolean
  laundry?: boolean
  spaWellness?: boolean
  minibar?: boolean
  conferenceHall?: boolean
  parking?: boolean
  miscellaneous?: boolean
}

export function saveAttachments(bookingId: string, docs: AttachedDocumentsMeta) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`booking_attachments_${bookingId}`, JSON.stringify(docs))
  }
}

export function loadAttachments(bookingId: string): AttachedDocumentsMeta | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`booking_attachments_${bookingId}`)
    if (stored) return JSON.parse(stored)
  }
  return null
}

export function clearAttachments(bookingId: string) {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(`booking_attachments_${bookingId}`)
  }
}

export function saveSkippedAttachments(bookingId: string, skipped: SkippedDocumentsMeta) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`booking_skipped_${bookingId}`, JSON.stringify(skipped))
  }
}

export function loadSkippedAttachments(bookingId: string): SkippedDocumentsMeta | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`booking_skipped_${bookingId}`)
    if (stored) return JSON.parse(stored)
  }
  return null
}
