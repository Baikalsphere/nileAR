import type { Metadata } from 'next'
import SecretActivityClient from './SecretActivityClient'

export const metadata: Metadata = {
  title: 'Hotel Account Activity - Admin'
}

export default function SecretActivityPage() {
  return <SecretActivityClient />
}
