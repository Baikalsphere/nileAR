import type { Metadata } from 'next'
import HotelProfileClient from './HotelProfileClient'

export const metadata: Metadata = {
  title: 'Hotel Profile'
}

export default function HotelProfilePage() {
  return <HotelProfileClient />
}
