"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { loadAttachments, clearAttachments, type AttachedDocumentsMeta } from '../../data'
import { BookingRecord, fetchBookingBills, fetchBookingById, sendBookingInvoice } from '@/lib/bookingsApi'
import { fetchHotelProfile, HotelProfile, tokenStorage } from '@/lib/auth'

const billLabels: Record<string, { label: string; icon: string }> = {
  roomCharges: { label: 'Room Charges', icon: 'hotel' },
  foodBeverage: { label: 'Food & Restaurant', icon: 'restaurant' },
  barLounge: { label: 'Bar & Lounge', icon: 'local_bar' },
  roomService: { label: 'Room Charges', icon: 'hotel' },
  laundry: { label: 'Laundry & Dry Cleaning', icon: 'local_laundry_service' },
  spaWellness: { label: 'Spa & Wellness', icon: 'spa' },
  minibar: { label: 'Minibar', icon: 'kitchen' },
  conferenceHall: { label: 'Conference & Banquet', icon: 'groups' },
  parking: { label: 'Parking & Valet', icon: 'local_parking' },
  miscellaneous: { label: 'Miscellaneous', icon: 'more_horiz' },
}

export default function SendClient({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [booking, setBooking] = useState<BookingRecord | null>(null)
  const [hotelProfile, setHotelProfile] = useState<HotelProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<AttachedDocumentsMeta | null>(null)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [ccEmails, setCcEmails] = useState<string[]>([])
  const [ccInput, setCcInput] = useState('')
  const [ccInputError, setCcInputError] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [sentInvoiceNumber, setSentInvoiceNumber] = useState<string | null>(null)
  const [invoicesPortalLink, setInvoicesPortalLink] = useState<string>('')
  const [extraBillsTotal, setExtraBillsTotal] = useState(0)
  const [uploadedBillCount, setUploadedBillCount] = useState(0)

  useEffect(() => {
    const token = tokenStorage.get()
    if (!token) {
      router.replace('/hotel-finance/login')
      return
    }

    const loadBooking = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const [bookingResponse, profileResponse, billsResponse] = await Promise.all([
          fetchBookingById(bookingId),
          fetchHotelProfile(),
          fetchBookingBills(bookingId),
        ])
        setBooking(bookingResponse.booking)
        setHotelProfile(profileResponse.profile)
        setRecipientEmail(bookingResponse.booking.organizationEmail ?? '')

        const extras = billsResponse.bills.reduce((sum, bill) => sum + Number(bill.billAmount ?? 0), 0)
        setExtraBillsTotal(extras)
        setUploadedBillCount(billsResponse.bills.length)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load booking'
        setLoadError(message)
      } finally {
        setIsLoading(false)
      }
    }

    void loadBooking()

    const saved = loadAttachments(bookingId)
    setAttachments(saved)
  }, [bookingId, router])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark">
        <Sidebar title="Hotel Finance" logoIcon="domain" />
        <main className="flex-1 flex items-center justify-center">Loading booking...</main>
      </div>
    )
  }

  if (loadError || !booking) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark">
        <Sidebar title="Hotel Finance" logoIcon="domain" />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <Header />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="material-symbols-outlined text-[64px] text-slate-300 dark:text-slate-600">error</span>
              <h2 className="text-xl font-bold mt-4">Booking Not Found</h2>
              {loadError && <p className="text-sm text-red-600 mt-2">{loadError}</p>}
              <Link href="/hotel-finance/bookings" className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back to Bookings
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const attachmentKeys = attachments ? Object.keys(attachments) as (keyof AttachedDocumentsMeta)[] : []
  const attachmentCount = attachmentKeys.length
  const effectiveBillCount = Math.max(attachmentCount, uploadedBillCount)
  const totalDue = booking.totalPrice + extraBillsTotal

  const todayDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const invoiceNumber = sentInvoiceNumber ?? `INV-${booking.bookingNumber.replace('BK-', '')}-${new Date().getFullYear()}`
  const invoiceDate = new Date(booking.checkOutDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const checkInFormatted = new Date(booking.checkInDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const checkOutFormatted = new Date(booking.checkOutDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const checkIn = new Date(booking.checkInDate)
  const today = new Date()
  const pendingDays = Math.max(0, Math.floor((today.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)))

  const paymentLink = invoicesPortalLink || `${typeof window !== 'undefined' ? window.location.origin : ''}/corporate-portal/invoices`

  const handleSend = async () => {
    if (!recipientEmail) {
      alert('Please enter the recipient email address')
      return
    }
    setIsSending(true)
    try {
      // Commit any unconfirmed CC input before sending
      const finalCcEmails = [...ccEmails]
      if (ccInput.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ccInput.trim())) {
        finalCcEmails.push(ccInput.trim().toLowerCase())
      }

      const response = await sendBookingInvoice(bookingId, {
        recipientEmail,
        ccEmails: finalCcEmails.length > 0 ? finalCcEmails : undefined,
        portalBaseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      })

      setSentInvoiceNumber(response.invoice.invoiceNumber)
      setInvoicesPortalLink(response.invoicesPortalLink)
      setIsSent(true)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to send invoice email')
    } finally {
      setIsSending(false)
    }
  }

  const handleDone = () => {
    clearAttachments(bookingId)
    router.push('/hotel-finance/bookings')
  }

  // Sent success screen
  if (isSent) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark transition-colors duration-200">
        <Sidebar title="Hotel Finance" logoIcon="domain" />
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark relative">
          <Header />
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="mx-auto w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 animate-bounce">
                <span className="material-symbols-outlined text-[40px] text-emerald-500">check_circle</span>
              </div>
              <h2 className="text-2xl font-extrabold text-text-main-light dark:text-text-main-dark">Cover Letter Sent!</h2>
              <p className="text-text-sub-light dark:text-text-sub-dark mt-3 leading-relaxed">
                Invoice cover letter for <span className="font-semibold">{booking.bookingNumber}</span> has been sent to <span className="font-semibold text-primary">{recipientEmail}</span>
              </p>
              <div className="mt-4 p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between text-sm">
                  <span className="text-text-sub-light dark:text-text-sub-dark">Organization</span>
                    <span className="font-semibold">{booking.organizationName}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-text-sub-light dark:text-text-sub-dark">Amount</span>
                  <span className="font-semibold">&#8377;{totalDue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-text-sub-light dark:text-text-sub-dark">Service Bills</span>
                  <span className="font-semibold">{effectiveBillCount} attached</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-text-sub-light dark:text-text-sub-dark">Payment Portal</span>
                  <span className="font-semibold text-primary">Link included</span>
                </div>
              </div>
              <button
                onClick={handleDone}
                className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-primary/25"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back to Bookings
              </button>
              <button
                onClick={() => router.push(`/hotel-finance/bookings/${bookingId}/invoice`)}
                className="mt-3 inline-flex items-center gap-2 px-6 py-3 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold text-text-main-light dark:text-text-main-dark hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">visibility</span>
                Preview Sent Invoice
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark transition-colors duration-200">
      <Sidebar title="Hotel Finance" logoIcon="domain" />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark relative">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="mx-auto max-w-5xl flex flex-col gap-6">

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <Link href="/hotel-finance/bookings" className="text-text-sub-light dark:text-text-sub-dark hover:text-primary transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Bookings
              </Link>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <Link href={`/hotel-finance/bookings/${bookingId}/attach`} className="text-text-sub-light dark:text-text-sub-dark hover:text-primary transition-colors">
                {booking.bookingNumber}
              </Link>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="text-primary font-semibold">Send Cover Letter</span>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-emerald-500">check</span>
                </div>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Bills Attached</span>
              </div>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-white">mail</span>
                </div>
                <span className="text-sm font-semibold text-primary">Review &amp; Send</span>
              </div>
            </div>

            {/* Main Content - Two Column */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left Column - Email Settings */}
              <div className="lg:col-span-1 flex flex-col gap-4">

                {/* Recipient */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <h3 className="text-sm font-bold text-text-sub-light dark:text-text-sub-dark uppercase tracking-wider mb-3">Recipient</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-text-main-light dark:text-text-main-dark mb-1.5">To *</label>
                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="accounts@organization.com"
                        className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-text-main-light dark:text-text-main-dark placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-main-light dark:text-text-main-dark mb-1.5">
                        CC
                        {ccEmails.length > 0 && (
                          <span className="ml-1.5 text-[10px] font-bold text-primary bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full">
                            {ccEmails.length}
                          </span>
                        )}
                      </label>
                      {/* Chip container */}
                      <div
                        className={`flex flex-wrap gap-1.5 min-h-[42px] px-2.5 py-2 border rounded-lg bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-colors ${ccInputError ? 'border-red-400 dark:border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
                        onClick={(e) => {
                          const input = (e.currentTarget as HTMLElement).querySelector('input')
                          input?.focus()
                        }}
                      >
                        {ccEmails.map((email) => (
                          <span
                            key={email}
                            className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 text-xs font-medium px-2 py-0.5 rounded-full"
                          >
                            {email}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setCcEmails(ccEmails.filter((em) => em !== email)) }}
                              className="hover:text-red-500 transition-colors ml-0.5"
                              aria-label={`Remove ${email}`}
                            >
                              <span className="material-symbols-outlined text-[13px]">close</span>
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={ccInput}
                          onChange={(e) => { setCcInput(e.target.value); setCcInputError(false) }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') {
                              e.preventDefault()
                              const val = ccInput.trim().replace(/,$/, '')
                              if (!val) return
                              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setCcInputError(true); return }
                              if (!ccEmails.includes(val.toLowerCase())) {
                                setCcEmails([...ccEmails, val.toLowerCase()])
                              }
                              setCcInput('')
                              setCcInputError(false)
                            }
                            if (e.key === 'Backspace' && !ccInput && ccEmails.length > 0) {
                              setCcEmails(ccEmails.slice(0, -1))
                            }
                          }}
                          onBlur={() => {
                            const val = ccInput.trim().replace(/,$/, '')
                            if (!val) return
                            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setCcInputError(true); return }
                            if (!ccEmails.includes(val.toLowerCase())) {
                              setCcEmails([...ccEmails, val.toLowerCase()])
                            }
                            setCcInput('')
                            setCcInputError(false)
                          }}
                          onPaste={(e) => {
                            const pasted = e.clipboardData.getData('text')
                            const parts = pasted.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
                            if (parts.length > 1) {
                              e.preventDefault()
                              const valid = parts.filter((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p))
                              const combined = [...new Set([...ccEmails, ...valid.map((v) => v.toLowerCase())])]
                              setCcEmails(combined)
                            }
                          }}
                          placeholder={ccEmails.length === 0 ? 'Add CC address, press Enter or comma' : ''}
                          className="flex-1 min-w-[140px] text-sm text-text-main-light dark:text-text-main-dark placeholder-slate-400 bg-transparent outline-none"
                        />
                      </div>
                      {ccInputError && (
                        <p className="mt-1 text-xs text-red-500">Please enter a valid email address</p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400">Press Enter, comma, or Tab to add. Paste multiple addresses at once.</p>
                    </div>
                  </div>
                </div>

                {/* Attached Service Bills */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-text-sub-light dark:text-text-sub-dark uppercase tracking-wider">
                      Service Bills
                    </h3>
                    <span className="text-xs font-bold text-primary bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
                      {effectiveBillCount}
                    </span>
                  </div>
                  {effectiveBillCount > 0 ? (
                    <div className="space-y-2">
                      {attachmentKeys.map((key) => {
                        const bill = billLabels[key] || { label: key, icon: 'description' }
                        const att = attachments![key]!
                        return (
                          <div key={key} className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <span className="material-symbols-outlined text-primary text-[18px]">{bill.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-text-main-light dark:text-text-main-dark truncate">{att.name}</p>
                              <p className="text-[11px] text-text-sub-light dark:text-text-sub-dark">{bill.label}</p>
                            </div>
                            <span className="material-symbols-outlined text-emerald-500 text-[16px]">check_circle</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600">folder_off</span>
                      <p className="text-sm text-text-sub-light dark:text-text-sub-dark mt-2">No bills attached</p>
                      <Link href={`/hotel-finance/bookings/${bookingId}/attach`} className="text-xs text-primary font-semibold mt-2 inline-block hover:underline">
                        Go back to attach
                      </Link>
                    </div>
                  )}
                </div>

                {/* Booking Quick Info */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <h3 className="text-sm font-bold text-text-sub-light dark:text-text-sub-dark uppercase tracking-wider mb-3">Booking</h3>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-sub-light dark:text-text-sub-dark">Booking #</span>
                      <span className="font-semibold">{booking.bookingNumber}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-sub-light dark:text-text-sub-dark">Organization</span>
                      <span className="font-semibold">{booking.organizationName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-sub-light dark:text-text-sub-dark">Guest</span>
                      <span className="font-semibold">{booking.employeeName}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-text-sub-light dark:text-text-sub-dark">Contract Amount</span>
                      <span className="font-semibold">&#8377;{booking.totalPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-sub-light dark:text-text-sub-dark">Extra Bills</span>
                      <span className="font-semibold">&#8377;{extraBillsTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-text-sub-light dark:text-text-sub-dark">Amount Due</span>
                      <span className="text-lg font-extrabold text-primary">&#8377;{totalDue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Cover Letter Preview */}
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

                  {/* Preview Header Bar */}
                  <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <span className="material-symbols-outlined text-[18px] text-primary">visibility</span>
                    <span className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Cover Letter Preview</span>
                  </div>

                  {/* Cover Letter Content */}
                  <div className="p-6 md:p-8">

                    {/* Hotel Letterhead */}
                    <div className="flex items-start justify-between mb-6 pb-6 border-b-2 border-blue-600">
                      <div className="flex items-center gap-3">
                        {hotelProfile?.logoUrl ? (
                          <img src={hotelProfile.logoUrl} alt="Hotel logo" className="w-12 h-12 rounded-xl object-cover" />
                        ) : (
                          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-[28px] text-white">domain</span>
                          </div>
                        )}
                        <div>
                          <h2 className="text-lg font-extrabold text-blue-700 dark:text-blue-400">
                            {hotelProfile?.hotelName ?? '—'}
                          </h2>
                          {(hotelProfile?.address || hotelProfile?.location) && (
                            <p className="text-[11px] text-text-sub-light dark:text-text-sub-dark">
                              {hotelProfile.address ?? hotelProfile.location}
                            </p>
                          )}
                          <p className="text-[11px] text-text-sub-light dark:text-text-sub-dark">
                            {[
                              hotelProfile?.contactPhone ? `Tel: ${hotelProfile.contactPhone}` : null,
                              hotelProfile?.contactEmail ? `Email: ${hotelProfile.contactEmail}` : null,
                            ].filter(Boolean).join(' | ')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {hotelProfile?.gst && (
                          <p className="text-xs text-text-sub-light dark:text-text-sub-dark">GSTIN: {hotelProfile.gst}</p>
                        )}
                      </div>
                    </div>

                    {/* Date & Reference */}
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-xs text-text-sub-light dark:text-text-sub-dark">Date</p>
                        <p className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">{todayDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-text-sub-light dark:text-text-sub-dark">Ref No.</p>
                        <p className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">{invoiceNumber}</p>
                      </div>
                    </div>

                    {/* To Address */}
                    <div className="mb-6">
                      <p className="text-sm text-text-main-light dark:text-text-main-dark font-semibold">To,</p>
                      <p className="text-sm text-text-main-light dark:text-text-main-dark font-bold">{booking.organizationName}</p>
                      <p className="text-sm text-text-sub-light dark:text-text-sub-dark">
                        {recipientEmail || <span className="italic text-slate-400">Enter recipient email &rarr;</span>}
                      </p>
                    </div>

                    {/* Subject */}
                    <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/15 border-l-4 border-blue-600 rounded-r-lg">
                      <p className="text-xs text-text-sub-light dark:text-text-sub-dark font-semibold uppercase tracking-wider mb-1">Subject</p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                        Submission of Invoices with Statement of Accounts — {booking.bookingNumber}
                      </p>
                    </div>

                    {/* Letter Body */}
                    <div className="space-y-4 text-sm text-text-main-light dark:text-text-main-dark leading-relaxed">
                      <p>Dear Sir / Madam,</p>

                      <p>Greetings from {hotelProfile?.hotelName ?? 'our hotel'}.</p>

                      <p>
                        Please find enclosed herewith the Statement of Accounts along with supporting service bills for your reference,
                        reflecting the transactions recorded in our books as on date. As per our records, an outstanding balance of{' '}
                        <span className="font-bold text-primary">Rs. {totalDue.toLocaleString()}/-</span>{' '}
                        is currently due for payment. Kindly review the statement and arrange for payment at the earliest convenience.
                      </p>

                      {/* Invoice Table */}
                      <div className="my-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-800 dark:bg-slate-800 text-white text-xs uppercase tracking-wider">
                              <th className="px-3 py-2.5 text-left font-semibold">Sr.</th>
                              <th className="px-3 py-2.5 text-left font-semibold">Invoice No</th>
                              <th className="px-3 py-2.5 text-left font-semibold">Inv Date</th>
                              <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                              <th className="px-3 py-2.5 text-left font-semibold">Guest Name</th>
                              <th className="px-3 py-2.5 text-left font-semibold">Check In</th>
                              <th className="px-3 py-2.5 text-left font-semibold">C/O Date</th>
                              <th className="px-3 py-2.5 text-right font-semibold">Pending</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                              <td className="px-3 py-2.5 text-text-sub-light dark:text-text-sub-dark">1</td>
                              <td className="px-3 py-2.5 font-medium">{invoiceNumber}</td>
                              <td className="px-3 py-2.5 text-text-sub-light dark:text-text-sub-dark">{invoiceDate}</td>
                              <td className="px-3 py-2.5 text-right font-semibold">&#8377;{totalDue.toLocaleString()}</td>
                              <td className="px-3 py-2.5">{booking.employeeName}</td>
                              <td className="px-3 py-2.5 text-text-sub-light dark:text-text-sub-dark">{checkInFormatted}</td>
                              <td className="px-3 py-2.5 text-text-sub-light dark:text-text-sub-dark">{checkOutFormatted}</td>
                              <td className="px-3 py-2.5 text-right font-medium text-amber-600 dark:text-amber-400">{pendingDays} days</td>
                            </tr>
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold">
                              <td colSpan={3} className="px-3 py-2.5 text-right uppercase text-xs tracking-wider text-text-sub-light dark:text-text-sub-dark">Total Outstanding</td>
                              <td className="px-3 py-2.5 text-right text-primary text-base">&#8377;{totalDue.toLocaleString()}</td>
                              <td colSpan={4}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Attached Service Bills List */}
                      {effectiveBillCount > 0 && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
                            Enclosed Service Bills ({effectiveBillCount})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {attachmentKeys.map((key) => {
                              const bill = billLabels[key] || { label: key, icon: 'description' }
                              return (
                                <span key={key} className="inline-flex items-center gap-1 text-xs bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 px-2.5 py-1 rounded-full text-emerald-700 dark:text-emerald-300 font-medium">
                                  <span className="material-symbols-outlined text-[13px]">{bill.icon}</span>
                                  {bill.label}
                                </span>
                              )
                            })}
                            {attachmentKeys.length === 0 ? (
                              <span className="text-xs text-emerald-700 dark:text-emerald-300">Uploaded bills are attached in the invoice package.</span>
                            ) : null}
                          </div>
                        </div>
                      )}

                      <p>
                        In case of any discrepancy, kindly inform us within 48 hours, so that we can reconcile the same promptly. Your timely support in clearing the dues will be highly appreciated and will help us maintain smooth business operations.
                      </p>

                      {/* Payment Portal Link */}
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">
                          Online Payment Portal
                        </p>
                        <p className="text-sm text-text-main-light dark:text-text-main-dark mb-2">
                          You can view and pay your invoices online by signing in to the corporate portal:
                        </p>
                        <a href={paymentLink} className="text-sm font-semibold text-primary hover:underline break-all flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                          {paymentLink}
                        </a>
                      </div>

                      {/* Bank Details */}
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <p className="text-xs font-bold text-text-sub-light dark:text-text-sub-dark uppercase tracking-wider mb-3">
                          Bank Details for Wire Transfer
                        </p>
                        <p className="text-xs text-text-sub-light dark:text-text-sub-dark italic">
                          Please contact {hotelProfile?.contactEmail ?? 'the hotel finance team'} to obtain bank account details for payment.
                        </p>
                      </div>

                      {/* Signature & Stamp Area */}
                      <div className="pt-4">
                        <p>Thanking you,</p>
                        <p className="mt-1">Yours faithfully,</p>
                        <div className="mt-6 flex items-end justify-between">
                          <div>
                            <div className="w-40 h-16 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Authorized Signatory</span>
                            </div>
                            <p className="text-sm font-bold mt-2">For {hotelProfile?.entityName ?? hotelProfile?.hotelName ?? 'Hotel'}</p>
                            <p className="text-xs text-text-sub-light dark:text-text-sub-dark">Finance Department</p>
                          </div>
                          <div className="text-right">
                            <div className="w-24 h-24 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider text-center leading-tight">Company<br/>Stamp</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between py-4 border-t border-slate-200 dark:border-slate-700">
              <Link
                href={`/hotel-finance/bookings/${bookingId}/attach`}
                className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-text-main-light dark:text-text-main-dark hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back to Attach
              </Link>
              <button
                onClick={handleSend}
                disabled={!recipientEmail || isSending || effectiveBillCount === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-blue-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-primary/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                {isSending ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    <span>Send Cover Letter</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
