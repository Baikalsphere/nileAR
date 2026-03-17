"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import InvoiceAutomationWorkflow from './InvoiceAutomationWorkflow'
import { fetchHotelProfile, tokenStorage } from '@/lib/auth'
import {
  BookingEmployee,
  BookingOrganization,
  BookingRecord,
  ContractRoomType,
  createBooking,
  fetchBookingEmployees,
  fetchBookingOrganizations,
  fetchBookingRequests,
  fetchBookingRoomTypes,
  fetchBookings
} from '@/lib/bookingsApi'

export default function BookingsClient() {
  const router = useRouter()
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [organizations, setOrganizations] = useState<BookingOrganization[]>([])
  const [employees, setEmployees] = useState<BookingEmployee[]>([])
  const [contractRoomTypes, setContractRoomTypes] = useState<ContractRoomType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'sent' | 'pending'>('all')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [showWorkflow, setShowWorkflow] = useState(false)
  const [selectedBookingForCheckout, setSelectedBookingForCheckout] = useState<BookingRecord | null>(null)
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set())
  const [showAddBookingModal, setShowAddBookingModal] = useState(false)
  const [isSavingBooking, setIsSavingBooking] = useState(false)
  const [hotelName, setHotelName] = useState<string>('Hotel Finance')
  const [hotelLogoUrl, setHotelLogoUrl] = useState<string | null>(null)
  const [isHotelLogoFailed, setIsHotelLogoFailed] = useState(false)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const [formData, setFormData] = useState({
    bookingNumber: `BK-${Math.floor(100 + Math.random() * 900)}`,
    organizationId: '',
    employeeId: '',
    checkInDate: '',
    checkOutDate: '',
    roomType: '',
    gstApplicable: false,
  })

  const loadBookings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const bookingResponse = await fetchBookings({
        status: selectedFilter,
        fromDate,
        toDate
      })
      setBookings(bookingResponse.bookings)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load bookings'
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

    const loadMeta = async () => {
      try {
        const [orgResponse, profileResponse] = await Promise.all([
          fetchBookingOrganizations(),
          fetchHotelProfile()
        ])
        setOrganizations(orgResponse.organizations)
        setHotelName(profileResponse.profile.hotelName || 'Hotel Finance')
        setHotelLogoUrl(profileResponse.profile.logoUrl)
        setIsHotelLogoFailed(false)
      } catch (metaError) {
        setError(metaError instanceof Error ? metaError.message : 'Failed to load organizations')
      }
    }

    void loadMeta()
  }, [router])

  useEffect(() => {
    const loadPendingRequests = async () => {
      try {
        const response = await fetchBookingRequests({ status: 'pending' })
        setPendingRequestsCount(response.requests.length)
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'Failed to load booking requests'
        if (message.toLowerCase().includes('unauthorized')) {
          tokenStorage.clear()
          router.replace('/hotel-finance/login')
        }
      }
    }

    void loadPendingRequests()
    const intervalId = window.setInterval(() => {
      void loadPendingRequests()
    }, 45000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [router])

  useEffect(() => {
    void loadBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter, fromDate, toDate])

  useEffect(() => {
    if (!formData.organizationId) {
      setEmployees([])
      setContractRoomTypes([])
      return
    }

    const loadOrganizationBookingMeta = async () => {
      try {
        const [employeeResponse, roomTypeResponse] = await Promise.all([
          fetchBookingEmployees(formData.organizationId),
          fetchBookingRoomTypes(formData.organizationId)
        ])

        setEmployees(employeeResponse.employees)
        setContractRoomTypes(roomTypeResponse.roomTypes)
      } catch (metaError) {
        setEmployees([])
        setContractRoomTypes([])
        setError(metaError instanceof Error ? metaError.message : 'Failed to load organization booking terms')
      }
    }

    void loadOrganizationBookingMeta()
  }, [formData.organizationId])

  const selectedRoomTypeDetails = contractRoomTypes.find((roomType) => roomType.roomType === formData.roomType) ?? null

  const handleCheckout = (booking: BookingRecord) => {
    setSelectedBookingForCheckout(booking)
    setShowWorkflow(true)
  }

  const toggleBookingSelection = (bookingId: string) => {
    const newSelected = new Set(selectedBookings)
    if (newSelected.has(bookingId)) {
      newSelected.delete(bookingId)
    } else {
      newSelected.add(bookingId)
    }
    setSelectedBookings(newSelected)
  }

  const toggleSelectAll = (bookingsToSelect: BookingRecord[]) => {
    if (selectedBookings.size === bookingsToSelect.length && bookingsToSelect.length > 0) {
      setSelectedBookings(new Set())
    } else {
      setSelectedBookings(new Set(bookingsToSelect.map(b => b.id)))
    }
  }

  const handleAddBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingBooking(true)
    setError(null)
    try {
      await createBooking({
        bookingNumber: formData.bookingNumber,
        organizationId: formData.organizationId,
        employeeId: formData.employeeId,
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        roomType: formData.roomType,
        gstApplicable: formData.gstApplicable,
        status: 'pending'
      })

      setShowAddBookingModal(false)
      setFormData({
        bookingNumber: `BK-${Math.floor(100 + Math.random() * 900)}`,
        organizationId: '',
        employeeId: '',
        checkInDate: '',
        checkOutDate: '',
        roomType: '',
        gstApplicable: false,
      })
      await loadBookings()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to add booking')
    } finally {
      setIsSavingBooking(false)
    }
  }

  const parseCreditPeriodDays = (creditPeriod?: string | null) => {
    if (!creditPeriod) {
      return 15
    }

    const match = creditPeriod.match(/\d+/)
    if (!match) {
      return 15
    }

    const days = Number(match[0])
    return Number.isFinite(days) && days >= 0 ? days : 15
  }

  const formatDate = (dateValue?: string | null) => {
    if (!dateValue) {
      return '--'
    }

    const parsed = new Date(dateValue)
    if (Number.isNaN(parsed.getTime())) {
      return '--'
    }

    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getDueDateDisplay = (booking: BookingRecord) => {
    if (!booking.invoiceId) {
      return '--'
    }

    if (booking.invoiceDueDate) {
      return formatDate(booking.invoiceDueDate)
    }

    const sentDate = booking.sentAt ? new Date(booking.sentAt) : null
    if (!sentDate || Number.isNaN(sentDate.getTime())) {
      return '--'
    }

    const dueDate = new Date(sentDate)
    dueDate.setDate(dueDate.getDate() + parseCreditPeriodDays(booking.organizationCreditPeriod))
    return formatDate(dueDate.toISOString())
  }

  const filteredBookings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return bookings.filter((booking) => {
      const matchesInvoiceFilter =
        invoiceFilter === 'all' ||
        (invoiceFilter === 'sent' ? Boolean(booking.invoiceId) : !booking.invoiceId)

      const matchesSearch =
        normalizedSearch.length === 0 ||
        booking.bookingNumber.toLowerCase().includes(normalizedSearch) ||
        booking.employeeName.toLowerCase().includes(normalizedSearch) ||
        booking.organizationName.toLowerCase().includes(normalizedSearch)

      return matchesInvoiceFilter && matchesSearch
    })
  }, [bookings, invoiceFilter, searchTerm])

  const totalRevenue = bookings.reduce((sum, booking) => sum + booking.totalPrice, 0)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark transition-colors duration-200">
      <Sidebar title="Hotel Finance" logoIcon="domain" />
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark relative">
        <Header />
        
        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-5 scroll-smooth">
          <div className="mx-auto w-full max-w-[96rem] flex flex-col gap-4">
            {/* Page Heading */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex items-start gap-3">
                {hotelLogoUrl && !isHotelLogoFailed ? (
                  <img
                    src={hotelLogoUrl}
                    alt={hotelName}
                    onError={() => setIsHotelLogoFailed(true)}
                    className="size-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold border border-primary/20">
                    {hotelName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Hotel</p>
                  <p className="text-sm font-bold text-text-main-light dark:text-text-main-dark">{hotelName}</p>
                </div>
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-main-light dark:text-text-main-dark">Bookings Management</h2>
                <p className="text-text-sub-light dark:text-text-sub-dark mt-1">View and manage corporate hotel bookings</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/hotel-finance/bookings/requests"
                  className="relative flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-text-main-light dark:text-text-main-dark shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {pendingRequestsCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                      {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                    </span>
                  )}
                  <span className="material-symbols-outlined text-[20px]">pending_actions</span>
                  <span>Requests</span>
                </Link>
                <button
                  onClick={() => setShowAddBookingModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm hover:shadow-md hover:shadow-primary/30 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  <span>Add Booking</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-text-main-light dark:text-text-main-dark shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <span className="material-symbols-outlined text-[20px]">download</span>
                  <span>Export</span>
                </button>
              </div>
            </div>

            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
              <div className="px-4 py-3 border-b-2 border-primary text-sm font-semibold text-primary">
                Bookings ({bookings.length})
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-surface-light p-4 shadow-[0_10px_24px_-18px_rgba(6,81,237,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-20px_rgba(6,81,237,0.55)] dark:border-slate-800 dark:bg-surface-dark">
                <div className="absolute inset-x-0 top-0 h-1 bg-primary/70" />
                <div className="flex justify-between items-start mb-3 pt-1">
                  <div className="p-2 rounded-lg bg-blue-50 text-primary ring-1 ring-blue-100 dark:bg-blue-900/25 dark:ring-blue-900/40">
                    <span className="material-symbols-outlined">booking</span>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Overview</span>
                </div>
                <p className="text-sm font-semibold text-text-sub-light dark:text-text-sub-dark">Total Bookings</p>
                <h3 className="mt-1 text-2xl font-bold text-text-main-light dark:text-text-main-dark">{bookings.length}</h3>
              </div>
              <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-surface-light p-4 shadow-[0_10px_24px_-18px_rgba(245,158,11,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-20px_rgba(245,158,11,0.6)] dark:border-slate-800 dark:bg-surface-dark">
                <div className="absolute inset-x-0 top-0 h-1 bg-amber-500/80" />
                <div className="flex justify-between items-start mb-3 pt-1">
                  <div className="p-2 rounded-lg bg-amber-50 text-warning ring-1 ring-amber-100 dark:bg-amber-900/25 dark:ring-amber-900/40">
                    <span className="material-symbols-outlined">schedule</span>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Attention</span>
                </div>
                <p className="text-sm font-semibold text-text-sub-light dark:text-text-sub-dark">Pending</p>
                <h3 className="mt-1 text-2xl font-bold text-text-main-light dark:text-text-main-dark">{bookings.filter(b => b.status === 'pending').length}</h3>
              </div>
              <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-surface-light p-4 shadow-[0_10px_24px_-18px_rgba(22,163,74,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-20px_rgba(22,163,74,0.6)] dark:border-slate-800 dark:bg-surface-dark">
                <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500/80" />
                <div className="flex justify-between items-start mb-3 pt-1">
                  <div className="p-2 rounded-lg bg-green-50 text-success ring-1 ring-green-100 dark:bg-green-900/25 dark:ring-green-900/40">
                    <span className="material-symbols-outlined">check_circle</span>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Status</span>
                </div>
                <p className="text-sm font-semibold text-text-sub-light dark:text-text-sub-dark">Checked-in</p>
                <h3 className="mt-1 text-2xl font-bold text-text-main-light dark:text-text-main-dark">{bookings.filter(b => b.status === 'checked-in').length}</h3>
              </div>
              <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-surface-light p-4 shadow-[0_10px_24px_-18px_rgba(147,51,234,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-20px_rgba(147,51,234,0.6)] dark:border-slate-800 dark:bg-surface-dark">
                <div className="absolute inset-x-0 top-0 h-1 bg-purple-500/80" />
                <div className="flex justify-between items-start mb-3 pt-1">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600 ring-1 ring-purple-100 dark:bg-purple-900/25 dark:text-purple-400 dark:ring-purple-900/40">
                    <span className="material-symbols-outlined">attach_money</span>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Revenue</span>
                </div>
                <p className="text-sm font-semibold text-text-sub-light dark:text-text-sub-dark">Total Revenue</p>
                <h3 className="mt-1 text-2xl font-bold text-text-main-light dark:text-text-main-dark">
                  ₹{totalRevenue.toLocaleString()}
                </h3>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-col gap-4">
              {/* Search and Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-end bg-surface-light dark:bg-surface-dark rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                <div className="xl:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Booking #, customer, corporation"
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    Invoice
                  </label>
                  <select
                    value={invoiceFilter}
                    onChange={(e) => setInvoiceFilter(e.target.value as 'all' | 'sent' | 'pending')}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="all">All</option>
                    <option value="sent">Invoice Sent</option>
                    <option value="pending">Not Sent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                {(fromDate || toDate || searchTerm || invoiceFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setFromDate('')
                      setToDate('')
                      setSearchTerm('')
                      setInvoiceFilter('all')
                    }}
                    className="md:col-span-2 xl:col-span-5 justify-self-start flex items-center gap-1 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">clear</span>
                    Reset filters
                  </button>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">
                {['all', 'pending', 'confirmed', 'checked-in', 'checked-out'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-4 py-3 border-b-2 font-semibold text-sm transition-colors ${
                      selectedFilter === filter
                        ? 'border-primary text-primary'
                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-text-main-light dark:hover:text-text-main-dark'
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1).replace('-', ' ')}
                    <span className="ml-2 text-xs font-normal opacity-75">
                      ({bookings.filter(b => filter === 'all' ? true : b.status === filter).length})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bookings Table */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <>
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={selectedBookings.size === filteredBookings.length && filteredBookings.length > 0}
                              onChange={() => toggleSelectAll(filteredBookings)}
                              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary cursor-pointer"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Booking #</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Customer</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Corporation</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Check-in</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Invoice Sent Date</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Due Date</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-text-sub-light dark:text-text-sub-dark">
                              Loading bookings...
                            </td>
                          </tr>
                        ) : filteredBookings.length > 0 ? (
                          filteredBookings.map((booking) => (
                            <tr key={booking.id} className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${selectedBookings.has(booking.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedBookings.has(booking.id)}
                                  onChange={() => toggleBookingSelection(booking.id)}
                                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-text-main-light dark:text-text-main-dark whitespace-nowrap">
                                {booking.bookingNumber}
                              </td>
                              <td className="px-4 py-3 text-sm text-text-main-light dark:text-text-main-dark whitespace-nowrap">
                                {booking.employeeName}
                              </td>
                              <td className="px-4 py-3 text-sm text-text-sub-light dark:text-text-sub-dark whitespace-nowrap">
                                {booking.organizationName}
                              </td>
                              <td className="px-4 py-3 text-sm text-text-main-light dark:text-text-main-dark whitespace-nowrap">
                                {formatDate(booking.checkInDate)}
                              </td>
                              <td className="px-4 py-3 text-sm text-text-main-light dark:text-text-main-dark whitespace-nowrap">
                                {booking.invoiceId ? formatDate(booking.sentAt) : '--'}
                              </td>
                              <td className="px-4 py-3 text-sm text-text-main-light dark:text-text-main-dark whitespace-nowrap">
                                {getDueDateDisplay(booking)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2 flex-wrap">
                                  {booking.invoiceId ? (
                                    <Link
                                      href={`/hotel-finance/bookings/${booking.id}/invoice`}
                                      className="flex items-center gap-2 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-semibold transition-all duration-200"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                                      <span>Invoice Sent</span>
                                    </Link>
                                  ) : (
                                    <>
                                      <Link
                                        href={`/hotel-finance/bookings/${booking.id}/bills`}
                                        className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-semibold transition-all duration-200"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">attach_file</span>
                                        <span className="hidden sm:inline">Attach</span>
                                      </Link>
                                      <Link 
                                        href={`/hotel-finance/bookings/${booking.id}/send`}
                                        className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-primary/30"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">send</span>
                                        <span className="hidden sm:inline">Send</span>
                                      </Link>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-text-sub-light dark:text-text-sub-dark">
                              <div className="flex flex-col items-center gap-2">
                                <span className="material-symbols-outlined text-[48px] opacity-40">inbox</span>
                                <p className="text-sm font-medium">No bookings found</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                  </>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Invoice Automation Workflow Modal */}
      {showWorkflow && selectedBookingForCheckout && (
        <InvoiceAutomationWorkflow
          bookingId={selectedBookingForCheckout.bookingNumber}
          customerName={selectedBookingForCheckout.employeeName}
          corporationName={selectedBookingForCheckout.organizationName}
          totalAmount={selectedBookingForCheckout.totalPrice}
          onClose={() => {
            setShowWorkflow(false)
            setSelectedBookingForCheckout(null)
          }}
        />
      )}

      {/* Add Booking Modal */}
      {showAddBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-surface-light shadow-[0_24px_60px_-24px_rgba(15,23,42,0.55)] dark:border-slate-700 dark:bg-surface-dark">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-surface-light/95 px-6 py-4 backdrop-blur dark:border-slate-700 dark:bg-surface-dark/95">
              <div>
                <h3 className="text-xl font-bold text-text-main-light dark:text-text-main-dark">Add New Booking</h3>
                <p className="mt-1 text-sm text-text-sub-light dark:text-text-sub-dark">Capture booking details and derive pricing from contract terms.</p>
              </div>
              <button
                onClick={() => setShowAddBookingModal(false)}
                className="rounded-lg p-1 text-text-sub-light transition-colors hover:bg-slate-100 hover:text-text-main-light dark:text-text-sub-dark dark:hover:bg-slate-800 dark:hover:text-text-main-dark"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddBooking} className="space-y-5 p-6">
              <section className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/35">
                <div className="mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">badge</span>
                  <p className="text-sm font-bold text-text-main-light dark:text-text-main-dark">Booking Identity</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">
                      Booking Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.bookingNumber}
                      onChange={(e) => setFormData({ ...formData, bookingNumber: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-text-main-light transition-all focus:border-transparent focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-text-main-dark"
                      placeholder="e.g. BK-007"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">
                      Organization *
                    </label>
                    <select
                      required
                      value={formData.organizationId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          organizationId: e.target.value,
                          employeeId: '',
                          roomType: ''
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-text-main-light transition-all focus:border-transparent focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-text-main-dark"
                    >
                      <option value="">Select organization</option>
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>{organization.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/35">
                <div className="mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">person</span>
                  <p className="text-sm font-bold text-text-main-light dark:text-text-main-dark">Guest Details</p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">
                    Employee *
                  </label>
                  <select
                    required
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-text-main-light transition-all focus:border-transparent focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-text-main-dark"
                    disabled={!formData.organizationId}
                  >
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.fullName} ({employee.employeeCode})</option>
                    ))}
                  </select>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/35">
                <div className="mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
                  <p className="text-sm font-bold text-text-main-light dark:text-text-main-dark">Stay Window</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">
                      Check-in Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.checkInDate}
                      onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-text-main-light transition-all focus:border-transparent focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-text-main-dark"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">
                      Check-out Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.checkOutDate}
                      onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-text-main-light transition-all focus:border-transparent focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-text-main-dark"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/35">
                <div className="mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">hotel</span>
                  <p className="text-sm font-bold text-text-main-light dark:text-text-main-dark">Room & Pricing</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">
                      Room Type *
                    </label>
                    <select
                      required
                      value={formData.roomType}
                      onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-text-main-light transition-all focus:border-transparent focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-text-main-dark"
                      disabled={!formData.organizationId || contractRoomTypes.length === 0}
                    >
                      <option value="">Select Room Type</option>
                      {contractRoomTypes.map((roomType) => (
                        <option key={roomType.roomType} value={roomType.roomType}>
                          {roomType.roomType}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">
                      Price Per Night (Derived from Contract)
                    </label>
                    <div className="flex min-h-[42px] items-center rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-text-main-light dark:border-slate-700 dark:bg-slate-800/70 dark:text-text-main-dark">
                      {selectedRoomTypeDetails ? `₹${selectedRoomTypeDetails.nightlyRate.toLocaleString()}` : 'Select a room type'}
                    </div>
                  </div>
                </div>

                {selectedRoomTypeDetails?.inclusions && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300">
                    <span className="font-semibold">Contract Inclusions:</span> {selectedRoomTypeDetails.inclusions}
                  </div>
                )}

                <label className="mt-4 inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
                  <input
                    type="checkbox"
                    id="gstApplicable"
                    checked={formData.gstApplicable}
                    onChange={(e) => setFormData({ ...formData, gstApplicable: e.target.checked })}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
                  />
                  <span className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">GST Applicable</span>
                </label>
              </section>

              <div className="flex gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddBookingModal(false)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-text-main-light transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-text-main-dark dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBooking}
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingBooking ? 'Saving...' : 'Add Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
