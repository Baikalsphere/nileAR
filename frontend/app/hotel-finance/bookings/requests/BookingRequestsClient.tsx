"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tokenStorage } from '@/lib/auth'
import { decideBookingRequest, fetchBookingRequests, type BookingRequestRecord } from '@/lib/bookingsApi'

const formatDate = (value?: string | null) => {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export default function BookingRequestsClient() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<BookingRequestRecord[]>([])
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(new Set())

  const loadRequests = async (status: 'all' | 'pending' | 'accepted' | 'rejected') => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetchBookingRequests({ status })
      setRequests(response.requests)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load booking requests'
      setError(message)
      if (message.toLowerCase().includes('unauthorized')) {
        tokenStorage.clear()
        router.replace('/hotel-finance/login')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const token = tokenStorage.get()
    if (!token) {
      router.replace('/hotel-finance/login')
      return
    }

    void loadRequests(requestStatusFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    void loadRequests(requestStatusFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestStatusFilter])

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) {
      return requests
    }

    return requests.filter((request) => (
      request.bookingNumber.toLowerCase().includes(normalizedSearch) ||
      request.employeeName.toLowerCase().includes(normalizedSearch) ||
      request.organizationName.toLowerCase().includes(normalizedSearch)
    ))
  }, [requests, searchTerm])

  const stats = useMemo(() => ({
    pending: requests.filter((request) => request.status === 'pending').length,
    accepted: requests.filter((request) => request.status === 'accepted').length,
    rejected: requests.filter((request) => request.status === 'rejected').length,
    totalValue: requests.reduce((sum, request) => sum + request.totalPrice, 0)
  }), [requests])

  const handleBookingRequestAction = async (requestId: string, action: 'accept' | 'reject') => {
    setError(null)
    setProcessingRequestIds((previous) => {
      const next = new Set(previous)
      next.add(requestId)
      return next
    })

    try {
      await decideBookingRequest(requestId, {
        action,
        rejectionReason: action === 'reject' ? 'Rejected by hotel' : undefined
      })

      await loadRequests(requestStatusFilter)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Failed to ${action} request`)
    } finally {
      setProcessingRequestIds((previous) => {
        const next = new Set(previous)
        next.delete(requestId)
        return next
      })
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark">
      <Sidebar title="Hotel Finance" logoIcon="domain" />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-5">
          <div className="mx-auto w-full max-w-[96rem] flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Booking Requests</h2>
                <p className="text-text-sub-light dark:text-text-sub-dark mt-1">Approve corporate booking requests. Accepted requests automatically appear in Bookings.</p>
              </div>
              <Link
                href="/hotel-finance/bookings"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-text-main-light shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-text-main-dark"
              >
                <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                <span>Go to Bookings</span>
              </Link>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-xs font-semibold uppercase text-slate-500">Pending</p>
                <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-xs font-semibold uppercase text-slate-500">Accepted</p>
                <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.accepted}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-xs font-semibold uppercase text-slate-500">Rejected</p>
                <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-xs font-semibold uppercase text-slate-500">Request Value</p>
                <p className="mt-2 text-2xl font-bold">₹{stats.totalValue.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-sm">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search request, employee, organization"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'pending', 'accepted', 'rejected'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setRequestStatusFilter(status)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      requestStatusFilter === status
                        ? 'bg-primary text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-surface-dark">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="px-4 py-3 text-left text-sm font-semibold">Request #</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Employee</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Organization</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Stay</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-text-sub-light dark:text-text-sub-dark">
                          Loading booking requests...
                        </td>
                      </tr>
                    ) : filteredRequests.length > 0 ? (
                      filteredRequests.map((request) => {
                        const isProcessing = processingRequestIds.has(request.id)
                        return (
                          <tr key={request.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap">
                              {request.bookingNumber}
                            </td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              <p>{request.employeeName}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{request.employeeCode}</p>
                            </td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">{request.organizationName}</td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              <p>{formatDate(request.checkInDate)} → {formatDate(request.checkOutDate)}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{request.roomType}</p>
                            </td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap font-semibold">₹{request.totalPrice.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                request.status === 'accepted'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : request.status === 'rejected'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              }`}>
                                {request.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {request.status === 'pending' ? (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => void handleBookingRequestAction(request.id, 'accept')}
                                    disabled={isProcessing}
                                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">check</span>
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => void handleBookingRequestAction(request.id, 'reject')}
                                    disabled={isProcessing}
                                    className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-text-sub-light dark:text-text-sub-dark">No action</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-text-sub-light dark:text-text-sub-dark">
                          <div className="flex flex-col items-center gap-2">
                            <span className="material-symbols-outlined text-[48px] opacity-40">inbox</span>
                            <p className="text-sm font-medium">No booking requests found</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
