"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  corporateTokenStorage,
  createCorporateBookingRequest,
  fetchCorporateBookingRequestMeta,
  fetchCorporateBookingRequests,
  fetchCorporateHotels,
  type CorporateBookingRequestEmployee,
  type CorporateBookingRequestRecord,
  type CorporateBookingRequestRoomType,
  type CorporateHotelSummary
} from '@/lib/corporateAuth'

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatCurrency = (amount: number) => `₹${amount.toLocaleString()}`

export default function CorporateHotelBookingDetailClient({ hotelId }: { hotelId: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')

  const [hotel, setHotel] = useState<CorporateHotelSummary | null>(null)
  const [requests, setRequests] = useState<CorporateBookingRequestRecord[]>([])
  const [employees, setEmployees] = useState<CorporateBookingRequestEmployee[]>([])
  const [roomTypes, setRoomTypes] = useState<CorporateBookingRequestRoomType[]>([])
  const [logoFailed, setLogoFailed] = useState(false)

  const [formData, setFormData] = useState({
    bookingNumber: `BK-${Math.floor(1000 + Math.random() * 9000)}`,
    employeeId: '',
    checkInDate: '',
    checkOutDate: '',
    roomType: '',
    gstApplicable: false
  })

  const loadRequests = async (filter: 'all' | 'pending' | 'accepted' | 'rejected') => {
    const response = await fetchCorporateBookingRequests({ status: filter })
    setRequests(response.requests.filter((request) => request.hotelId === hotelId))
  }

  useEffect(() => {
    const token = corporateTokenStorage.get()
    if (!token) {
      router.replace('/corporate-portal/login')
      return
    }

    const loadData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [hotelsResponse, metaResponse] = await Promise.all([
          fetchCorporateHotels(),
          fetchCorporateBookingRequestMeta(hotelId)
        ])
        const selectedHotel = hotelsResponse.hotels.find((item) => item.id === hotelId) ?? null
        if (!selectedHotel) {
          setError('Hotel not found')
          setHotel(null)
          setEmployees([])
          setRoomTypes([])
          return
        }

        setHotel(selectedHotel)
        setEmployees(metaResponse.employees)
        setRoomTypes(metaResponse.roomTypes)
        setLogoFailed(false)
        await loadRequests('all')
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load hotel booking details'
        setError(message)
        if (message.toLowerCase().includes('unauthorized')) {
          corporateTokenStorage.clear()
          router.replace('/corporate-portal/login')
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [hotelId, router])

  useEffect(() => {
    void loadRequests(statusFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const selectedRoomType = useMemo(() => roomTypes.find((roomType) => roomType.roomType === formData.roomType) ?? null, [roomTypes, formData.roomType])

  const computedNights = useMemo(() => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0
    const checkIn = new Date(formData.checkInDate)
    const checkOut = new Date(formData.checkOutDate)
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return 0
    return Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)))
  }, [formData.checkInDate, formData.checkOutDate])

  const estimatedTotal = useMemo(() => (selectedRoomType ? Number((computedNights * selectedRoomType.nightlyRate).toFixed(2)) : 0), [computedNights, selectedRoomType])
  const totalRequests = requests.length
  const pendingRequests = requests.filter((request) => request.status === 'pending').length
  const acceptedRequests = requests.filter((request) => request.status === 'accepted').length
  const rejectedRequests = requests.filter((request) => request.status === 'rejected').length

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await createCorporateBookingRequest({
        hotelId,
        bookingNumber: formData.bookingNumber,
        employeeId: formData.employeeId,
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        roomType: formData.roomType,
        gstApplicable: formData.gstApplicable
      })

      setFormData({
        bookingNumber: `BK-${Math.floor(1000 + Math.random() * 9000)}`,
        employeeId: '',
        checkInDate: '',
        checkOutDate: '',
        roomType: '',
        gstApplicable: false
      })
      setSuccessMessage('Booking request sent successfully.')
      await loadRequests(statusFilter)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit booking request')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display selection:bg-primary/20">
      <Sidebar title="TravelCorp" logoIcon="travel_explore" />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl flex flex-col gap-6">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50 p-5 shadow-sm dark:border-slate-800 dark:from-[#1e293b] dark:via-[#1e293b] dark:to-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                {hotel?.logoUrl && !logoFailed ? (
                  <img src={hotel.logoUrl} alt={hotel.name} onError={() => setLogoFailed(true)} className="size-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                ) : (
                  <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">{hotel?.name?.slice(0, 1).toUpperCase() || 'H'}</div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Request Booking Workspace</p>
                  <h1 className="text-2xl font-extrabold tracking-tight">{hotel?.name || 'Hotel Booking Details'}</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{hotel?.location || '-'}</p>
                </div>
              </div>
              <Link href="/corporate-portal/booking-requests" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Back to Hotels</span>
              </Link>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                  <p className="mt-1 text-lg font-bold">{totalRequests}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/20">
                  <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Pending</p>
                  <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">{pendingRequests}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                  <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Accepted</p>
                  <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{acceptedRequests}</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-900/20">
                  <p className="text-xs uppercase tracking-wide text-red-700 dark:text-red-300">Rejected</p>
                  <p className="mt-1 text-lg font-bold text-red-700 dark:text-red-300">{rejectedRequests}</p>
                </div>
              </div>
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">{error}</div>}
            {successMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-300">{successMessage}</div>}

            <section className="grid gap-6 xl:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1e293b] xl:col-span-3">
                <h2 className="text-lg font-bold">Create Booking Request</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">All pricing and room options are contract-driven for compliance and billing accuracy.</p>
                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Booking Number *</label>
                      <input required value={formData.bookingNumber} onChange={(event) => setFormData((previous) => ({ ...previous, bookingNumber: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold">User *</label>
                      <select required value={formData.employeeId} onChange={(event) => setFormData((previous) => ({ ...previous, employeeId: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800">
                        <option value="">Select user</option>
                        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} ({employee.email})</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Room Type *</label>
                      <select required value={formData.roomType} onChange={(event) => setFormData((previous) => ({ ...previous, roomType: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800">
                        <option value="">Select room type</option>
                        {roomTypes.map((roomType) => <option key={roomType.roomType} value={roomType.roomType}>{roomType.roomType} · {formatCurrency(roomType.nightlyRate)}/night</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Check-in *</label>
                      <input type="date" required value={formData.checkInDate} onChange={(event) => setFormData((previous) => ({ ...previous, checkInDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800" />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Check-out *</label>
                      <input type="date" required value={formData.checkOutDate} onChange={(event) => setFormData((previous) => ({ ...previous, checkOutDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800" />
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 mt-8">
                      <input type="checkbox" checked={formData.gstApplicable} onChange={(event) => setFormData((previous) => ({ ...previous, gstApplicable: event.target.checked }))} className="size-4 rounded border-slate-300 text-primary focus:ring-primary" />
                      GST applicable
                    </label>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      <p>Nights: <span className="font-semibold text-slate-900 dark:text-slate-100">{computedNights || '-'}</span></p>
                      <p>Rate: <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedRoomType ? formatCurrency(selectedRoomType.nightlyRate) : '-'}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium uppercase text-slate-500">Estimated Total</p>
                      <p className="text-xl font-extrabold text-primary">{formatCurrency(estimatedTotal)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px] text-primary">verified_user</span>Contract-verified request</span>
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px] text-primary">mail</span>Hotel notified by email</span>
                  </div>

                  <button type="submit" disabled={isSubmitting || isLoading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    <span>{isSubmitting ? 'Submitting...' : 'Submit Request'}</span>
                  </button>
                </form>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1e293b] xl:col-span-2">
                <h3 className="text-base font-bold">Request Timeline</h3>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {(['all', 'pending', 'accepted', 'rejected'] as const).map((status) => (
                    <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${statusFilter === status ? 'bg-primary text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="mt-4 max-h-[520px] overflow-y-auto space-y-3 pr-1">
                  {isLoading ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Loading requests...</p>
                  ) : requests.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No requests yet.</p>
                  ) : (
                    requests.map((request) => (
                      <div key={request.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {hotel?.logoUrl && !logoFailed ? (
                              <img src={hotel.logoUrl} alt={hotel.name || 'Hotel'} className="size-6 rounded-md object-cover border border-slate-200 dark:border-slate-700" />
                            ) : (
                              <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{hotel?.name?.slice(0, 1).toUpperCase() || 'H'}</div>
                            )}
                            <p className="font-semibold">{request.bookingNumber}</p>
                          </div>
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${request.status === 'accepted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : request.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>{request.status}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(request.checkInDate)} → {formatDate(request.checkOutDate)} · {request.roomType}</p>
                        <p className="mt-1 text-sm font-semibold">{formatCurrency(request.totalPrice)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Requested {formatDate(request.requestedAt)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
