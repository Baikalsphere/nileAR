import type { Metadata } from 'next'
import InvoicePreviewClient from './InvoicePreviewClient'

export const metadata: Metadata = {
  title: 'Sent Invoice Preview - Hotel Finance'
}

export default function InvoicePreviewPage({ params }: { params: { bookingId: string } }) {
  return <InvoicePreviewClient bookingId={params.bookingId} />
}