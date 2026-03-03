"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import Header from '@/app/components/Header'
import { corporateTokenStorage, CorporateHotelSummary, fetchCorporateHotels } from '@/lib/corporateAuth'

const getStatusBadge = (status: CorporateHotelSummary['status']) => {
  if (status === 'active') {
    return { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', label: 'Active' }
  }

  return { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500', label: 'Settled' }
}

const formatLastStay = (date: string | null) => {
  if (!date) {
    return '-'
  }

  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export default function CorporatePortalClient() {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hotels, setHotels] = useState<CorporateHotelSummary[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'settled'>('all')
  const [failedLogoHotelIds, setFailedLogoHotelIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const token = corporateTokenStorage.get()
    if (!token) {
      router.replace('/corporate-portal/login')
      return
    }

    const loadHotels = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetchCorporateHotels()
        setHotels(response.hotels)
        setFailedLogoHotelIds(new Set())
        setIsAuthorized(true)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load hotels'
        setError(message)

        if (message.toLowerCase().includes('unauthorized')) {
          corporateTokenStorage.clear()
          router.replace('/corporate-portal/login')
          return
        }

        setIsAuthorized(true)
      } finally {
        setIsLoading(false)
      }
    }

    void loadHotels()
  }, [router])

  const handleHotelLogoError = (hotelId: string) => {
    setFailedLogoHotelIds((previous) => {
      if (previous.has(hotelId)) {
        return previous
      }

      const next = new Set(previous)
      next.add(hotelId)
      return next
    })
  }

  const filteredHotels = useMemo(() => hotels.filter((hotel) => {
    const matchesSearch = hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hotel.location.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterStatus === 'all' || hotel.status === filterStatus
    return matchesSearch && matchesFilter
  }), [hotels, searchQuery, filterStatus])

  const totals = useMemo(() => {
    const totalSpent = hotels.reduce((sum, hotel) => sum + hotel.totalSpent, 0)
    const totalPendingAmount = hotels.reduce((sum, hotel) => sum + hotel.outstanding, 0)
    const totalActiveStays = hotels.reduce((sum, hotel) => sum + hotel.activeStays, 0)
    const totalBookings = hotels.reduce((sum, hotel) => sum + hotel.totalStays, 0)

    return {
      totalSpent,
      totalPendingAmount,
      totalActiveStays,
      totalBookings
    }
  }, [hotels])

  if (!isAuthorized) {
    return null
  }

  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display overflow-hidden selection:bg-primary/20">
      <Sidebar title="TravelCorp" logoIcon="travel_explore" />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
          <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Partner Hotels</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-base">Hotels that have onboarded your organization for corporate bookings.</p>
              </div>
              <button className="flex items-center justify-center gap-2 bg-primary hover:bg-blue-700 text-white px-5 py-3 rounded-lg shadow-sm transition-all hover:shadow-md shrink-0">
                <span className="material-symbols-outlined text-[20px]">download</span>
                <span className="text-sm font-bold">Export Summary</span>
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            )}

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex flex-col p-6 rounded-xl bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-primary">
                  <span className="material-symbols-outlined text-6xl">payments</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Total Spent</p>
                <div className="flex items-end gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">₹{totals.totalSpent.toLocaleString()}</h3>
                </div>
                <div className="flex items-center gap-1 text-primary dark:text-blue-400 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 w-fit px-2 py-1 rounded-full">
                  <span className="material-symbols-outlined text-sm">hotel</span>
                  <span>Across {hotels.length} hotels</span>
                </div>
              </div>

              <div className="flex flex-col p-6 rounded-xl bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 shadow-sm group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Pending Amount</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">₹{totals.totalPendingAmount.toLocaleString()}</h3>
                  </div>
                  <div className="size-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center">
                    <span className="material-symbols-outlined">pending_actions</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-4">Active bookings in progress</p>
              </div>

              <div className="flex flex-col p-6 rounded-xl bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 shadow-sm group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Active Stays</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{totals.totalActiveStays}</h3>
                  </div>
                  <div className="size-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                    <span className="material-symbols-outlined">hotel</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-4">Currently checked in</p>
              </div>

              <div className="flex flex-col p-6 rounded-xl bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Hotels Connected</p>
                  <span className="text-sm font-bold text-primary">{hotels.length}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-3">{totals.totalBookings} total bookings</h3>
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(100, hotels.length * 10)}%` }}></div>
                </div>
                <p className="text-xs text-slate-400 mt-3">Based on booking activity</p>
              </div>
            </section>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative w-full sm:w-80">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                <input
                  type="text"
                  placeholder="Search hotels by name or location..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'active', 'settled'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filterStatus === status
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white dark:bg-[#1e293b] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {!isLoading && filteredHotels.map((hotel) => {
                const badge = getStatusBadge(hotel.status)
                const shouldShowLogo = Boolean(hotel.logoUrl) && !failedLogoHotelIds.has(hotel.id)
                return (
                  <Link
                    key={hotel.id}
                    href={`/corporate-portal/hotels/${hotel.id}`}
                    className="flex flex-col bg-white dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden group hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer"
                  >
                    <div className="p-5 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {shouldShowLogo ? (
                            <img
                              src={hotel.logoUrl as string}
                              alt={hotel.name}
                              onError={() => handleHotelLogoError(hotel.id)}
                              className="size-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                              {hotel.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="text-slate-900 dark:text-white text-lg font-bold truncate">{hotel.name}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-1 truncate">
                              <span className="material-symbols-outlined text-[14px]">location_on</span>
                              {hotel.location}
                            </p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 ${badge.bg} ${badge.text} text-xs font-semibold px-2.5 py-1 rounded-full` }>
                          <span className={`size-1.5 rounded-full ${badge.dot}`}></span>
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 flex flex-col gap-4 flex-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Total Stays</span>
                          <span className="text-lg font-bold text-slate-900 dark:text-white">{hotel.totalStays}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Active Now</span>
                          <span className="text-lg font-bold text-slate-900 dark:text-white">{hotel.activeStays}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Total Spent</span>
                          <span className="text-lg font-bold text-slate-900 dark:text-white">₹{hotel.totalSpent.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Pending</span>
                          <span className={`text-lg font-bold ${hotel.outstanding > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            ₹{hotel.outstanding.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">pending_actions</span>
                          {hotel.pendingInvoices} pending booking{hotel.pendingInvoices !== 1 ? 's' : ''}
                        </span>
                        <span>Last stay: {formatLastStay(hotel.lastStayDate)}</span>
                      </div>

                      <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white font-semibold text-sm transition-all duration-300">
                        <span>View Details</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-lg font-semibold text-slate-600 dark:text-slate-400">Loading hotels...</p>
              </div>
            )}

            {!isLoading && filteredHotels.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">search_off</span>
                <p className="text-lg font-semibold text-slate-600 dark:text-slate-400">No hotels found</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
