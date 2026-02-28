import type { Metadata } from 'next'
import CorporateBookingRequestsClient from './CorporateBookingRequestsClient'

export const metadata: Metadata = {
  title: 'Book Rooms - Corporate Portal'
}

export default function CorporateBookingRequestsPage() {
  return <CorporateBookingRequestsClient />
}
