import type { Metadata } from 'next'
import CorporateHotelBookingDetailClient from './CorporateHotelBookingDetailClient'

export const metadata: Metadata = {
  title: 'Hotel Booking Details - Corporate Portal'
}

export default async function CorporateHotelBookingDetailPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params
  return <CorporateHotelBookingDetailClient hotelId={hotelId} />
}
