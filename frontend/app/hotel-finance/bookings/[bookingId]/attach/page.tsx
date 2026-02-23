import type { Metadata } from 'next'
import AttachBillsClient from '../../AttachBillsClient'

export const metadata: Metadata = {
  title: 'Attach Documents - Hotel Finance'
}

export default function AttachPage({ params }: { params: { bookingId: string } }) {
  return <AttachBillsClient bookingId={params.bookingId} />
}
