"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  corporateTokenStorage,
  fetchCorporateHotels,
  type CorporateHotelSummary
} from '@/lib/corporateAuth'

export default function CorporateBookingRequestsClient() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hotelNameSearchTerm, setHotelNameSearchTerm] = useState('')
  const [locationSearchTerm, setLocationSearchTerm] = useState('')
  const [hotels, setHotels] = useState<CorporateHotelSummary[]>([])
  const [failedHotelLogoIds, setFailedHotelLogoIds] = useState<Set<string>>(new Set())

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
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load hotels'
        setError(message)

        if (message.toLowerCase().includes('unauthorized')) {
          corporateTokenStorage.clear()
          router.replace('/corporate-portal/login')
          return
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadHotels()
  }, [router])

  const filteredHotels = useMemo(() => {
    const normalizedHotelNameSearch = hotelNameSearchTerm.trim().toLowerCase()
    const normalizedLocationSearch = locationSearchTerm.trim().toLowerCase()

    if (!normalizedHotelNameSearch && !normalizedLocationSearch) {
      return hotels
    }

    return hotels.filter((hotel) => {
      const matchesHotelName = !normalizedHotelNameSearch || hotel.name.toLowerCase().includes(normalizedHotelNameSearch)
      const matchesLocation = !normalizedLocationSearch || (hotel.location ?? '').toLowerCase().includes(normalizedLocationSearch)
      return matchesHotelName && matchesLocation
    })
  }, [hotels, hotelNameSearchTerm, locationSearchTerm])

  const handleHotelLogoError = (hotelId: string) => {
    setFailedHotelLogoIds((previous) => {
      if (previous.has(hotelId)) {
        return previous
      }

      const next = new Set(previous)
      next.add(hotelId)
      return next
    })
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display selection:bg-primary/20">
      <Sidebar title="TravelCorp" logoIcon="travel_explore" />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-5 lg:p-6">
          <div className="mx-auto max-w-7xl flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-blue-50/70 to-slate-50 p-4 md:p-5 shadow-[0_18px_38px_-28px_rgba(6,81,237,0.55)] dark:border-slate-800 dark:from-[#1e293b] dark:via-[#1b2a44] dark:to-slate-900">
              <div className="pointer-events-none absolute -right-20 -top-16 h-44 w-44 rounded-full bg-primary/15 blur-3xl" />
              <div className="pointer-events-none absolute -left-16 -bottom-20 h-40 w-40 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-500/10" />

              <div className="relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Corporate Booking Console</p>
                  <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Book Rooms</h1>
                  <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Choose a partner hotel first, then proceed to a dedicated booking workflow page.</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-bold text-primary shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">apartment</span>
                      <span>Hotels Available: {hotels.length}</span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      <span>Signed Contract Partners</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_36px_-24px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-[#1e293b]">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Partner Hotels</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Search by hotel or location to start a booking request.</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <span className="material-symbols-outlined text-[14px]">hotel</span>
                  <span>{filteredHotels.length} result{filteredHotels.length === 1 ? '' : 's'}</span>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="relative w-full rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                  <input
                    type="text"
                    value={hotelNameSearchTerm}
                    onChange={(event) => setHotelNameSearchTerm(event.target.value)}
                    placeholder="Search by hotel name"
                    className="w-full rounded-lg border-0 bg-white py-2.5 pl-10 pr-4 text-sm transition-colors focus:outline-none dark:bg-slate-800"
                  />
                </div>
                <div className="relative w-full rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                  <input
                    type="text"
                    value={locationSearchTerm}
                    onChange={(event) => setLocationSearchTerm(event.target.value)}
                    placeholder="Search by location"
                    className="w-full rounded-lg border-0 bg-white py-2.5 pl-10 pr-4 text-sm transition-colors focus:outline-none dark:bg-slate-800"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading hotels...</div>
              ) : filteredHotels.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">No hotels found.</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredHotels.map((hotel) => {
                    const shouldShowLogo = Boolean(hotel.logoUrl) && !failedHotelLogoIds.has(hotel.id)
                    return (
                      <Link
                        key={hotel.id}
                        href={`/corporate-portal/booking-requests/${hotel.id}`}
                        className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.4)] transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-[0_24px_36px_-22px_rgba(6,81,237,0.5)] dark:border-slate-700 dark:bg-slate-800/50"
                      >
                        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary/80 to-blue-400/90 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="flex items-center gap-3">
                          {shouldShowLogo ? (
                            <img
                              src={hotel.logoUrl as string}
                              alt={hotel.name}
                              onError={() => handleHotelLogoError(hotel.id)}
                              className="size-12 rounded-xl border border-slate-200 object-cover shadow-sm dark:border-slate-700"
                            />
                          ) : (
                            <div className="flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-base font-bold text-primary shadow-sm">
                              {hotel.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-lg font-extrabold text-slate-900 dark:text-slate-100">{hotel.name}</p>
                            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{hotel.location || '-'}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                            <p className="uppercase tracking-wide">Active Stays</p>
                            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{hotel.activeStays}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                            <p className="uppercase tracking-wide">Outstanding</p>
                            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">₹{hotel.outstanding.toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                        <div className="mt-4 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-sm font-semibold text-primary transition-transform duration-300 group-hover:translate-x-0.5 dark:bg-primary/15">
                          <span>View Details</span>
                          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
