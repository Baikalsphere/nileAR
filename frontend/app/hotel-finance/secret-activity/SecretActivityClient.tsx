"use client"

import { useEffect, useState } from 'react'
import { fetchHotelActivity, type HotelActivityAccount } from '@/lib/auth'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  }).format(new Date(iso))
}

function timeAgo(iso: string | null) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function StatusBadge({ account }: { account: HotelActivityAccount }) {
  const isLocked = account.locked_until && new Date(account.locked_until) > new Date()
  if (!account.is_active) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        Disabled
      </span>
    )
  }
  if (isLocked) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
        Locked
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
      Active
    </span>
  )
}

export default function SecretActivityClient() {
  const [accounts, setAccounts] = useState<HotelActivityAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchHotelActivity()
      .then((res) => setAccounts(res.accounts))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase()
    return (
      (a.hotel_name ?? '').toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.full_name ?? '').toLowerCase().includes(q) ||
      (a.location ?? '').toLowerCase().includes(q)
    )
  })

  const neverLoggedIn = filtered.filter((a) => !a.last_login_at).length
  const activeSessions = filtered.reduce((sum, a) => sum + a.active_sessions, 0)

  return (
    <main className="min-h-screen bg-background-light dark:bg-background-dark p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-main-light dark:text-text-main-dark">
            Hotel Account Activity
          </h1>
          <p className="mt-1 text-sm text-text-sub-light dark:text-text-sub-dark">
            Last login and session activity for all registered hotel accounts.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-text-sub-light dark:text-text-sub-dark">Total Accounts</p>
                <p className="mt-1 text-2xl font-bold text-text-main-light dark:text-text-main-dark">{accounts.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-text-sub-light dark:text-text-sub-dark">Never Logged In</p>
                <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{neverLoggedIn}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-text-sub-light dark:text-text-sub-dark">Active Sessions</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeSessions}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-text-sub-light dark:text-text-sub-dark">Showing</p>
                <p className="mt-1 text-2xl font-bold text-text-main-light dark:text-text-main-dark">{filtered.length}</p>
              </div>
            </div>

            <div>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by hotel, email, or location..."
                className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-sub-light dark:text-text-sub-dark">Hotel</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-sub-light dark:text-text-sub-dark">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-sub-light dark:text-text-sub-dark">Registered</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-sub-light dark:text-text-sub-dark">Last Login</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-sub-light dark:text-text-sub-dark">Sessions</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-sub-light dark:text-text-sub-dark">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-sub-light dark:text-text-sub-dark">
                        No accounts found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((account) => (
                      <tr key={account.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-text-main-light dark:text-text-main-dark">
                            {account.hotel_name ?? <span className="text-slate-400 italic">No profile</span>}
                          </p>
                          {account.location ? (
                            <p className="text-xs text-text-sub-light dark:text-text-sub-dark">{account.location}</p>
                          ) : null}
                          {account.full_name ? (
                            <p className="text-xs text-text-sub-light dark:text-text-sub-dark">{account.full_name}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-text-main-light dark:text-text-main-dark font-mono text-xs">
                          {account.email}
                        </td>
                        <td className="px-4 py-3 text-text-sub-light dark:text-text-sub-dark whitespace-nowrap">
                          {formatDate(account.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {account.last_login_at ? (
                            <>
                              <p className="text-text-main-light dark:text-text-main-dark">{formatDate(account.last_login_at)}</p>
                              <p className="text-xs text-text-sub-light dark:text-text-sub-dark">{timeAgo(account.last_login_at)}</p>
                            </>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">Never logged in</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {account.active_sessions > 0 ? (
                            <span className="inline-flex items-center justify-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                              {account.active_sessions}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge account={account} />
                          {account.failed_login_attempts > 0 ? (
                            <p className="mt-0.5 text-xs text-red-500">{account.failed_login_attempts} failed</p>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-sub-light dark:text-text-sub-dark">
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            Loading accounts...
          </div>
        ) : null}

      </div>
    </main>
  )
}
