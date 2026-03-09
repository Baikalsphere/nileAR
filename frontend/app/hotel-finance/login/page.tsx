"use client"

import { useEffect } from "react"
import { tokenStorage } from "@/lib/auth"

const BAIKALSPHERE_URL = process.env.NEXT_PUBLIC_BAIKALSPHERE_URL || "http://localhost:3000"

export default function HotelFinanceLoginPage() {
  useEffect(() => {
    tokenStorage.clear()
    window.location.href = `${BAIKALSPHERE_URL}/dashboard`
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )
}
