"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { tokenStorage } from '@/lib/auth'
import { BookingBill, BookingRecord, fetchBookingBills, fetchBookingById } from '@/lib/bookingsApi'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)

const formatDisplayDate = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!value) {
    return '--'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '--'
  }

  return parsed.toLocaleDateString('en-IN', options ?? { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function InvoicePreviewClient({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [booking, setBooking] = useState<BookingRecord | null>(null)
  const [bills, setBills] = useState<BookingBill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = tokenStorage.get()
    if (!token) {
      router.replace('/hotel-finance/login')
      return
    }

    const loadInvoicePreview = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [bookingResponse, billsResponse] = await Promise.all([
          fetchBookingById(bookingId),
          fetchBookingBills(bookingId),
        ])

        if (!bookingResponse.booking.invoiceId) {
          throw new Error('Invoice has not been sent for this booking yet')
        }

        setBooking(bookingResponse.booking)
        setBills(billsResponse.bills)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load invoice preview'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    void loadInvoicePreview()
  }, [bookingId, router])

  const extraBills = useMemo(() => bills.filter((bill) => Number(bill.billAmount ?? 0) > 0), [bills])
  const extraBillsTotal = useMemo(
    () => extraBills.reduce((sum, bill) => sum + Number(bill.billAmount ?? 0), 0),
    [extraBills]
  )

  if (isLoading) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark">
        <Sidebar title="Hotel Finance" logoIcon="domain" />
        <main className="flex-1 flex items-center justify-center">Loading sent invoice...</main>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark">
        <Sidebar title="Hotel Finance" logoIcon="domain" />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <Header />
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <span className="material-symbols-outlined text-[64px] text-slate-300 dark:text-slate-600">receipt_long</span>
              <h2 className="text-xl font-bold mt-4">Sent Invoice Preview Unavailable</h2>
              {error ? <p className="text-sm text-red-600 mt-2">{error}</p> : null}
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

  const roomCharges = Number(booking.totalPrice ?? 0)
  const totalAmount = roomCharges + extraBillsTotal
  const invoiceNumber = booking.invoiceNumber ?? `INV-${booking.bookingNumber.replace('BK-', '')}`

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark transition-colors duration-200">
      <Sidebar title="Hotel Finance" logoIcon="domain" />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark relative">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="mx-auto max-w-6xl flex flex-col gap-6">
            <div className="flex items-center gap-2 text-sm">
              <Link href="/hotel-finance/bookings" className="text-text-sub-light dark:text-text-sub-dark hover:text-primary transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Bookings
              </Link>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="text-text-main-light dark:text-text-main-dark font-medium">{booking.bookingNumber}</span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="text-primary font-semibold">Sent Invoice Preview</span>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-emerald-900 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-200">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">Invoice Sent</p>
                  <h1 className="mt-1 text-2xl font-black">{invoiceNumber}</h1>
                  <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                    Sent on {formatDisplayDate(booking.sentAt)} for {booking.organizationName}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/70 px-4 py-3 dark:bg-slate-900/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Room Charges</p>
                    <p className="mt-1 text-lg font-bold">{formatCurrency(roomCharges)}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 px-4 py-3 dark:bg-slate-900/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Additional Charges</p>
                    <p className="mt-1 text-lg font-bold">{formatCurrency(extraBillsTotal)}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 px-4 py-3 dark:bg-slate-900/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Amount</p>
                    <p className="mt-1 text-lg font-bold text-primary">{formatCurrency(totalAmount)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-surface-dark">
                <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">preview</span>
                    <h2 className="text-lg font-bold">Invoice Breakdown</h2>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/40">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Details</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr>
                        <td className="px-6 py-4 font-semibold">Room Charges</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          {booking.roomType} • {booking.nights} night{booking.nights === 1 ? '' : 's'} • {formatCurrency(booking.pricePerNight)}/night
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">{formatCurrency(roomCharges)}</td>
                      </tr>
                      {extraBills.length > 0 ? (
                        extraBills.map((bill) => (
                          <tr key={bill.id}>
                            <td className="px-6 py-4 font-medium">{bill.billCategory}</td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                              <div>{bill.fileName}</div>
                              <div className="text-xs text-slate-400">{bill.notes?.trim() ? bill.notes : 'Additional service charge'}</div>
                            </td>
                            <td className="px-6 py-4 text-right font-semibold">{formatCurrency(Number(bill.billAmount ?? 0))}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-6 py-4 font-medium">Additional Charges</td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400">No extra charges were added to this invoice.</td>
                          <td className="px-6 py-4 text-right font-semibold">{formatCurrency(0)}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-900/40">
                      <tr>
                        <td colSpan={2} className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total Invoice Amount</td>
                        <td className="px-6 py-4 text-right text-lg font-bold text-primary">{formatCurrency(totalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-surface-dark">
                <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">receipt_long</span>
                    <h2 className="text-lg font-bold">Invoice Details</h2>
                  </div>
                </div>

                <div className="space-y-4 px-6 py-5 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Invoice Number</span>
                    <span className="font-semibold">{invoiceNumber}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Invoice Date</span>
                    <span className="font-semibold">{formatDisplayDate(booking.invoiceDate)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Due Date</span>
                    <span className="font-semibold">{formatDisplayDate(booking.invoiceDueDate)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Organization</span>
                    <span className="font-semibold text-right">{booking.organizationName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Guest</span>
                    <span className="font-semibold text-right">{booking.employeeName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">Stay</span>
                    <span className="font-semibold text-right">
                      {formatDisplayDate(booking.checkInDate)} - {formatDisplayDate(booking.checkOutDate)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-200 px-6 py-5 dark:border-slate-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supporting Files</p>
                  <div className="mt-3 space-y-2">
                    {bills.length > 0 ? (
                      bills.map((bill) => (
                        <div key={bill.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
                          <div>
                            <p className="font-medium">{bill.billCategory}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{bill.fileName}</p>
                          </div>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {formatCurrency(Number(bill.billAmount ?? 0))}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No supporting files were attached to this invoice.</p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}