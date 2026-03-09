"use client"

import { useEffect } from "react"

const BAIKALSPHERE_URL = process.env.NEXT_PUBLIC_BAIKALSPHERE_URL || "http://localhost:3000"

export default function UnifiedLoginClient() {
  useEffect(() => {
    window.location.href = `${BAIKALSPHERE_URL}/dashboard`
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-500 text-sm">Redirecting to Baikalsphere...</p>
      </div>
    </div>
  )
}

