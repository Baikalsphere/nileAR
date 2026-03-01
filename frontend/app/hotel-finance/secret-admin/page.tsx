import type { Metadata } from 'next'
import SecretAdminClient from './SecretAdminClient'

export const metadata: Metadata = {
  title: 'Admin Hotel Account Provisioning - Hotel Finance'
}

export default function SecretAdminPage() {
  return <SecretAdminClient />
}
