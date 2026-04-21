"use client"

import { useEffect, useRef } from 'react'

const resolveApiBase = () => {
  if (typeof window === 'undefined') return ''
  const { hostname, origin } = window.location
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `${origin.replace(/:(\d+)$/, '')}:4000`
  return origin
}

const getToken = () => {
  if (typeof window === 'undefined') return null
  return (
    window.sessionStorage.getItem('hf_access_token') ||
    window.sessionStorage.getItem('corp_access_token') ||
    null
  )
}

const PING_INTERVAL_MS = 30_000

export default function SessionTracker() {
  const sessionIdRef = useRef<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let active = true

    const startSession = async () => {
      const token = getToken()
      if (!token) return
      try {
        const res = await fetch(`${resolveApiBase()}/api/auth/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json() as { sessionId: string }
        if (!active) {
          // component unmounted before response came back — end immediately
          endSession(data.sessionId)
          return
        }
        sessionIdRef.current = data.sessionId
        scheduleHeartbeat()
      } catch { /* silent — never break the app */ }
    }

    const ping = async () => {
      if (!sessionIdRef.current) return
      try {
        await fetch(`${resolveApiBase()}/api/auth/session/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionIdRef.current }),
        })
      } catch { /* silent */ }
    }

    const endSession = async (id: string) => {
      try {
        await fetch(`${resolveApiBase()}/api/auth/session/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: id }),
          keepalive: true,
        })
      } catch { /* silent */ }
    }

    const scheduleHeartbeat = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(ping, PING_INTERVAL_MS)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        ping()
      }
    }

    const handleBeforeUnload = () => {
      if (sessionIdRef.current) endSession(sessionIdRef.current)
    }

    startSession()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      active = false
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (sessionIdRef.current) endSession(sessionIdRef.current)
    }
  }, [])

  return null
}
