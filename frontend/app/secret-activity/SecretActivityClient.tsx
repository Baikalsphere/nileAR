"use client"

import { useEffect, useState } from 'react'
import { fetchHotelActivity, type DailyActivityEntry, type HotelActivityAccount, type OrgActivityEntry } from '@/lib/auth'

function formatDate(iso: string | null) {
  if (!iso) return '-'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso))
}

function formatDay(isoDate: string) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(isoDate))
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
  return `${Math.floor(days / 30)}mo ago`
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${minutes} min`
  const hrs = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`
}

function HotelStatusBadge({ account }: { account: HotelActivityAccount }) {
  const isLocked = account.locked_until && new Date(account.locked_until) > new Date()
  if (!account.is_active)
    return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">Disabled</span>
  if (isLocked)
    return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">Locked</span>
  return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">Active</span>
}

function OrgStatusBadge({ org }: { org: OrgActivityEntry }) {
  if (!org.is_active || org.status === 'inactive')
    return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">Inactive</span>
  return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">Active</span>
}

type Tab = 'hotels' | 'organizations' | 'daily'
type DayRange = 7 | 14 | 30 | 90

const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  #ar-print-area, #ar-print-area * { visibility: visible !important; }
  #ar-print-area {
    position: fixed; inset: 0; padding: 24px;
    font-family: Arial, sans-serif; font-size: 11px;
    color: #000; background: #fff;
  }
  .no-print { display: none !important; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 700; font-size: 10px; text-transform: uppercase; }
  tr:nth-child(even) td { background: #f8fafc; }
  h2 { font-size: 13px; font-weight: 700; margin: 18px 0 6px; }
  .p-stat-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .p-stat { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; min-width: 110px; }
  .p-stat-label { font-size: 9px; text-transform: uppercase; color: #64748b; }
  .p-stat-value { font-size: 16px; font-weight: 700; }
}
`

export default function SecretActivityClient() {
  const [accounts, setAccounts] = useState<HotelActivityAccount[]>([])
  const [organizations, setOrganizations] = useState<OrgActivityEntry[]>([])
  const [daily, setDaily] = useState<DailyActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('hotels')
  const [dayRange, setDayRange] = useState<DayRange>(30)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    fetchHotelActivity()
      .then((res) => {
        setAccounts(res.accounts)
        setOrganizations(res.organizations ?? [])
        setDaily(res.daily ?? [])
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const filteredHotels = accounts.filter((a) => {
    const q = search.toLowerCase()
    return (
      (a.hotel_name ?? '').toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.full_name ?? '').toLowerCase().includes(q) ||
      (a.location ?? '').toLowerCase().includes(q)
    )
  })

  const filteredOrgs = organizations.filter((o) => {
    const q = search.toLowerCase()
    return (
      o.name.toLowerCase().includes(q) ||
      o.corporate_user_id.toLowerCase().includes(q) ||
      (o.contact_email ?? '').toLowerCase().includes(q)
    )
  })

  const cutoff = new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const filteredDaily = daily.filter((d) => {
    if (d.day < cutoff) return false
    if (tab !== 'daily') return true
    const q = search.toLowerCase()
    return (
      d.hotel_name.toLowerCase().includes(q) ||
      d.email.toLowerCase().includes(q) ||
      (d.location ?? '').toLowerCase().includes(q)
    )
  })

  const totalHotelMinutes = accounts.reduce((s, a) => s + (a.total_minutes ?? 0), 0)
  const activeSessions = accounts.reduce((s, a) => s + a.active_sessions, 0)
  const neverLoggedIn = accounts.filter((a) => !a.last_login_at).length
  const orgsNeverLoggedIn = organizations.filter((o) => !o.last_login_at).length
  const dailyTotalSessions = filteredDaily.reduce((s, d) => s + d.sessions, 0)
  const dailyTotalMinutes = filteredDaily.reduce((s, d) => s + d.minutes, 0)
  const uniqueDays = new Set(filteredDaily.map((d) => d.day)).size

  const byDate = filteredDaily.reduce<Record<string, DailyActivityEntry[]>>((acc, d) => {
    if (!acc[d.day]) acc[d.day] = []
    acc[d.day].push(d)
    return acc
  }, {})
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  const generatedAt = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date())

  const handleDownloadPDF = () => {
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 150)
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* Hidden print area */}
      <div id="ar-print-area" style={{ display: 'none' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>AR Module Activity Report</div>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>
          Generated {generatedAt} IST &nbsp;|&nbsp; Range: Last {dayRange} days
        </div>

        <div className="p-stat-row">
          {[
            ['Hotels', accounts.length],
            ['Organisations', organizations.length],
            ['Active Sessions', activeSessions],
            ['Total Hotel Usage', formatDuration(totalHotelMinutes)],
            ['Days w/ Activity', uniqueDays],
          ].map(([label, value]) => (
            <div key={String(label)} className="p-stat">
              <div className="p-stat-label">{label}</div>
              <div className="p-stat-value">{value}</div>
            </div>
          ))}
        </div>

        <h2>Daily Breakdown - Last {dayRange} Days</h2>
        {sortedDates.length === 0 ? (
          <p style={{ color: '#64748b' }}>No session activity in this period.</p>
        ) : sortedDates.map((day) => (
          <div key={day} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>{formatDay(day)}</div>
            <table>
              <thead>
                <tr><th>Hotel</th><th>Email</th><th>Location</th><th>Sessions</th><th>Time Used</th></tr>
              </thead>
              <tbody>
                {byDate[day].map((d) => (
                  <tr key={d.user_id + d.day}>
                    <td>{d.hotel_name}</td>
                    <td>{d.email}</td>
                    <td>{d.location ?? '-'}</td>
                    <td>{d.sessions}</td>
                    <td>{formatDuration(d.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <h2>Hotel Accounts - All Time</h2>
        <table>
          <thead>
            <tr><th>Hotel</th><th>Email</th><th>Location</th><th>Last Login</th><th>Sessions</th><th>Total Time</th><th>Status</th></tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.hotel_name ?? '-'}</td>
                <td>{a.email}</td>
                <td>{a.location ?? '-'}</td>
                <td>{a.last_login_at ? formatDate(a.last_login_at) : 'Never'}</td>
                <td>{a.total_sessions}</td>
                <td>{formatDuration(a.total_minutes ?? 0)}</td>
                <td>{a.is_active ? 'Active' : 'Disabled'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Organisations</h2>
        <table>
          <thead>
            <tr><th>Name</th><th>Contact</th><th>Registered</th><th>Last Login</th><th>Status</th></tr>
          </thead>
          <tbody>
            {organizations.map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>{o.contact_email ?? '-'}</td>
                <td>{formatDate(o.created_at)}</td>
                <td>{o.last_login_at ? formatDate(o.last_login_at) : 'Never'}</td>
                <td>{o.is_active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Main page */}
      <main className="min-h-screen bg-background-light dark:bg-background-dark p-4 md:p-6 lg:p-8 no-print">
        <div className="mx-auto max-w-7xl flex flex-col gap-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-text-main-light dark:text-text-main-dark">
                AR Module Activity
              </h1>
              <p className="mt-1 text-sm text-text-sub-light dark:text-text-sub-dark">
                Usage time and login activity for all hotels and organisations.
              </p>
            </div>
            {!loading && !error && (
              <button
                onClick={handleDownloadPDF}
                disabled={printing}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                {printing ? 'Preparing...' : 'Download PDF'}
              </button>
            )}
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-text-sub-light dark:text-text-sub-dark">
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              Loading activity data...
            </div>
          ) : null}

          {!loading && !error ? (
            <div className="flex flex-col gap-6">

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Hotels', value: String(accounts.length), color: '' },
                  { label: 'Organisations', value: String(organizations.length), color: '' },
                  { label: 'Active Sessions', value: String(activeSessions), color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Total Hotel Usage', value: formatDuration(totalHotelMinutes), color: 'text-blue-600 dark:text-blue-400' },
                  { label: `Activity (${dayRange}d)`, value: `${uniqueDays} days`, color: 'text-violet-600 dark:text-violet-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs text-text-sub-light dark:text-text-sub-dark">{label}</p>
                    <p className={`mt-1 text-2xl font-bold ${color || 'text-text-main-light dark:text-text-main-dark'}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Tabs + controls */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-900">
                  {(['hotels', 'organizations', 'daily'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        tab === t
                          ? 'bg-primary text-white'
                          : 'text-text-sub-light dark:text-text-sub-dark hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {t === 'hotels' ? `Hotels (${accounts.length})`
                        : t === 'organizations' ? `Orgs (${organizations.length})`
                        : `Daily (${uniqueDays}d)`}
                    </button>
                  ))}
                </div>

                {tab === 'daily' && (
                  <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-900">
                    {([7, 14, 30, 90] as DayRange[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setDayRange(r)}
                        className={`px-3 py-2 text-xs font-semibold transition-colors ${
                          dayRange === r
                            ? 'bg-primary text-white'
                            : 'text-text-sub-light dark:text-text-sub-dark hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {r}d
                      </button>
                    ))}
                  </div>
                )}

                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    tab === 'hotels' ? 'Search hotel, email, location...'
                      : tab === 'organizations' ? 'Search name, ID, email...'
                      : 'Search hotel, email...'
                  }
                  className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                {tab === 'hotels' && neverLoggedIn > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{neverLoggedIn} never logged in</span>
                )}
                {tab === 'organizations' && orgsNeverLoggedIn > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{orgsNeverLoggedIn} never logged in</span>
                )}
                {tab === 'daily' && (
                  <span className="text-xs text-text-sub-light dark:text-text-sub-dark">
                    {dailyTotalSessions} sessions &middot; {formatDuration(dailyTotalMinutes)} total
                  </span>
                )}
              </div>

              {/* Hotels tab */}
              {tab === 'hotels' && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60">
                        {['Hotel', 'Email', 'Last Login', 'Sessions', 'Total Time Used', 'Status'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-sub-light dark:text-text-sub-dark">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredHotels.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-text-sub-light dark:text-text-sub-dark">No hotels found.</td></tr>
                      ) : filteredHotels.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-text-main-light dark:text-text-main-dark">
                              {a.hotel_name ?? <span className="italic text-slate-400">No profile</span>}
                            </p>
                            {a.location && <p className="text-xs text-text-sub-light dark:text-text-sub-dark">{a.location}</p>}
                            {a.full_name && <p className="text-xs text-text-sub-light dark:text-text-sub-dark">{a.full_name}</p>}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-text-main-light dark:text-text-main-dark">{a.email}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {a.last_login_at ? (
                              <div>
                                <p className="text-xs text-text-main-light dark:text-text-main-dark">{formatDate(a.last_login_at)}</p>
                                <p className="text-xs text-text-sub-light dark:text-text-sub-dark">{timeAgo(a.last_login_at)}</p>
                              </div>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">Never</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              {a.active_sessions > 0 && (
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                  {a.active_sessions} active
                                </span>
                              )}
                              <span className="text-xs text-text-sub-light dark:text-text-sub-dark">{a.total_sessions ?? 0} total</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(a.total_minutes ?? 0) > 0 ? (
                              <span className="font-semibold text-text-main-light dark:text-text-main-dark">{formatDuration(a.total_minutes)}</span>
                            ) : <span className="text-xs text-slate-400">-</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <HotelStatusBadge account={a} />
                            {a.failed_login_attempts > 0 && (
                              <p className="mt-0.5 text-xs text-red-500">{a.failed_login_attempts} failed</p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Organisations tab */}
              {tab === 'organizations' && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60">
                        {['Organisation', 'User ID', 'Contact', 'Registered', 'Last Login', 'Status'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-sub-light dark:text-text-sub-dark">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredOrgs.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-text-sub-light dark:text-text-sub-dark">No organisations found.</td></tr>
                      ) : filteredOrgs.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-text-main-light dark:text-text-main-dark">{o.name}</p>
                            <p className="text-xs font-mono text-text-sub-light dark:text-text-sub-dark">{o.id}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-text-main-light dark:text-text-main-dark">{o.corporate_user_id}</td>
                          <td className="px-4 py-3 text-xs text-text-sub-light dark:text-text-sub-dark">{o.contact_email ?? '-'}</td>
                          <td className="px-4 py-3 text-xs text-text-sub-light dark:text-text-sub-dark whitespace-nowrap">{formatDate(o.created_at)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {o.last_login_at ? (
                              <div>
                                <p className="text-xs text-text-main-light dark:text-text-main-dark">{formatDate(o.last_login_at)}</p>
                                <p className="text-xs text-text-sub-light dark:text-text-sub-dark">{timeAgo(o.last_login_at)}</p>
                              </div>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">Never</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center"><OrgStatusBadge org={o} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Daily tab */}
              {tab === 'daily' && (
                <div className="flex flex-col gap-4">
                  {sortedDates.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600">event_busy</span>
                      <p className="mt-3 text-sm text-text-sub-light dark:text-text-sub-dark">No session activity in the last {dayRange} days.</p>
                    </div>
                  ) : sortedDates.map((day) => {
                    const rows = byDate[day]
                    const dayTotal = rows.reduce((s, r) => s + r.minutes, 0)
                    const daySessions = rows.reduce((s, r) => s + r.sessions, 0)
                    return (
                      <div key={day} className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[18px]">calendar_today</span>
                            <span className="font-bold text-text-main-light dark:text-text-main-dark">{formatDay(day)}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-text-sub-light dark:text-text-sub-dark">
                            <span><span className="font-semibold text-text-main-light dark:text-text-main-dark">{rows.length}</span> hotel{rows.length !== 1 ? 's' : ''}</span>
                            <span><span className="font-semibold text-text-main-light dark:text-text-main-dark">{daySessions}</span> session{daySessions !== 1 ? 's' : ''}</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">{formatDuration(dayTotal)}</span>
                          </div>
                        </div>
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-xs uppercase tracking-wide text-text-sub-light dark:text-text-sub-dark">
                              <th className="px-5 py-2 text-left font-semibold">Hotel</th>
                              <th className="px-5 py-2 text-left font-semibold">Email</th>
                              <th className="px-5 py-2 text-left font-semibold">Location</th>
                              <th className="px-5 py-2 text-center font-semibold">Sessions</th>
                              <th className="px-5 py-2 text-right font-semibold">Time Used</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {rows.map((r) => (
                              <tr key={r.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="px-5 py-3 font-medium text-text-main-light dark:text-text-main-dark">{r.hotel_name}</td>
                                <td className="px-5 py-3 font-mono text-xs text-text-sub-light dark:text-text-sub-dark">{r.email}</td>
                                <td className="px-5 py-3 text-xs text-text-sub-light dark:text-text-sub-dark">{r.location ?? '-'}</td>
                                <td className="px-5 py-3 text-center">
                                  <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                                    {r.sessions}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right font-semibold text-text-main-light dark:text-text-main-dark">
                                  {formatDuration(r.minutes)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 dark:bg-slate-800/40 text-xs font-bold">
                              <td colSpan={3} className="px-5 py-2 text-right text-text-sub-light dark:text-text-sub-dark uppercase tracking-wide">Day Total</td>
                              <td className="px-5 py-2 text-center text-text-main-light dark:text-text-main-dark">{daySessions}</td>
                              <td className="px-5 py-2 text-right text-blue-600 dark:text-blue-400">{formatDuration(dayTotal)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )
                  })}
                </div>
              )}

            </div>
          ) : null}

        </div>
      </main>
    </div>
  )
}
