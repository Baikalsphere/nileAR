import type { Metadata } from 'next'
import HotelUsersClient from './HotelUsersClient'

export const metadata: Metadata = {
  title: 'Users - Hotel Finance'
}

export default function HotelUsersPage() {
  return <HotelUsersClient />
}
