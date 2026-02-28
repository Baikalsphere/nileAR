import type { Metadata } from 'next'
import BookingRequestsClient from './BookingRequestsClient'

export const metadata: Metadata = {
  title: 'Booking Requests - Hotel Finance'
}

export default function BookingRequestsPage() {
  return <BookingRequestsClient />
}
