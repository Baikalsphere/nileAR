import type { Metadata } from 'next'
import CorporateUsersClient from './CorporateUsersClient'

export const metadata: Metadata = {
  title: 'Users - Corporate Portal'
}

export default function CorporateUsersPage() {
  return <CorporateUsersClient />
}
