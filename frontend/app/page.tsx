import type { Metadata } from 'next'
import UnifiedLoginClient from './UnifiedLoginClient'

export const metadata: Metadata = {
  title: 'Login'
}

export default function Home() {
  return <UnifiedLoginClient />
}
