import type { Metadata } from 'next'
import CorporateHotelContractClient from './CorporateHotelContractClient'

export const metadata: Metadata = {
  title: 'Hotel Contract - Corporate Portal'
}

export default async function CorporateHotelContractPage({
  params
}: {
  params: Promise<{ hotelId: string }>
}) {
  const { hotelId } = await params
  return <CorporateHotelContractClient hotelId={hotelId} />
}
