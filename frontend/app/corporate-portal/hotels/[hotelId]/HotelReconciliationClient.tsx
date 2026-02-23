"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  corporateTokenStorage,
  fetchCorporateHotels,
  fetchCorporateInvoices,
  type CorporateHotelSummary,
  type CorporateInvoice
} from '@/lib/corporateAuth'

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const formatCurrency = (value: number) => `₹${value.toLocaleString()}`

export default function HotelReconciliationClient({ hotelId }: { hotelId: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hotel, setHotel] = useState<CorporateHotelSummary | null>(null)
  const [invoices, setInvoices] = useState<CorporateInvoice[]>([])
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all')

  useEffect(() => {
    const token = corporateTokenStorage.get()
    if (!token) {
      router.replace('/corporate-portal/login')
      return
    }

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [hotelsResponse, invoicesResponse] = await Promise.all([
          fetchCorporateHotels(),
          fetchCorporateInvoices()
        ])

        const selectedHotel = hotelsResponse.hotels.find((entry) => entry.id === hotelId) ?? null

        if (!selectedHotel) {
          setHotel(null)
          setInvoices([])
          setError('Hotel not found for this organization.')
          return
        }

        setHotel(selectedHotel)
        setInvoices(invoicesResponse.invoices.filter((entry) => entry.hotelId === hotelId))
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load reconciliation data'
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

    void load()
  }, [hotelId, router])

  const filteredInvoices = useMemo(() => {
    if (filterStatus === 'all') {
      return invoices
    }

    return invoices.filter((invoice) => invoice.status === filterStatus)
  }, [filterStatus, invoices])

  const totals = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, invoice) => sum + invoice.amount, 0)
    const paidAmount = invoices
      .filter((invoice) => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + invoice.amount, 0)

    return {
      totalInvoiced,
      paidAmount,
      outstanding: Math.max(0, totalInvoiced - paidAmount),
      paidCount: invoices.filter((invoice) => invoice.status === 'paid').length,
      unpaidCount: invoices.filter((invoice) => invoice.status === 'unpaid').length,
      overdueCount: invoices.filter((invoice) => invoice.status === 'overdue').length
    }
  }, [invoices])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display selection:bg-primary/20">
        <Sidebar title="TravelCorp" logoIcon="travel_explore" />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <Header />
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">Loading reconciliation...</div>
        </main>
      </div>
    )
  }

  if (!hotel) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display selection:bg-primary/20">
        <Sidebar title="TravelCorp" logoIcon="travel_explore" />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <Header />
          <div className="flex-1 p-6">
            <Link href="/corporate-portal" className="text-sm text-primary hover:underline">Back to Hotels</Link>
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
              {error ?? 'Hotel not found.'}
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display selection:bg-primary/20">
      <Sidebar title="TravelCorp" logoIcon="travel_explore" />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="mx-auto max-w-7xl flex flex-col gap-6">
            <div className="flex flex-wrap gap-2">
              <Link href="/corporate-portal" className="text-slate-500 hover:text-primary text-sm font-medium leading-normal">Partner Hotels</Link>
              <span className="text-slate-400 text-sm font-medium leading-normal">/</span>
              <span className="text-slate-900 dark:text-slate-100 text-sm font-medium leading-normal">Reconciliation</span>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <h1 className="text-slate-900 dark:text-white text-3xl font-extrabold">{hotel.name}</h1>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${hotel.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                    {hotel.status === 'active' ? 'Active' : 'Settled'}
                  </span>
                </div>
                <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                    <span>{hotel.location || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">hotel</span>
                    <span>{hotel.totalStays} total stays · {hotel.activeStays} active stays</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">event</span>
                    <span>Last stay: {formatDate(hotel.lastStayDate)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#1e293b]">
                <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Total Invoiced</p>
                <p className="text-slate-900 dark:text-white text-2xl font-bold mt-1">{formatCurrency(totals.totalInvoiced)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#1e293b]">
                <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Paid Amount</p>
                <p className="text-emerald-600 dark:text-emerald-400 text-2xl font-bold mt-1">{formatCurrency(totals.paidAmount)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#1e293b]">
                <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Outstanding</p>
                <p className="text-orange-600 dark:text-orange-400 text-2xl font-bold mt-1">{formatCurrency(totals.outstanding)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#1e293b]">
                <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Unpaid</p>
                <p className="text-slate-900 dark:text-white text-2xl font-bold mt-1">{totals.unpaidCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#1e293b]">
                <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Overdue</p>
                <p className="text-slate-900 dark:text-white text-2xl font-bold mt-1">{totals.overdueCount}</p>
              </div>
            </div>

            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
              {(['all', 'paid', 'unpaid', 'overdue'] as const).map((status) => {
                const count = status === 'all' ? invoices.length : invoices.filter((invoice) => invoice.status === status).length
                return (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      filterStatus === status
                        ? 'border-primary text-primary'
                        : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {status === 'all' ? 'All Invoices' : status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                  </button>
                )
              })}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#1e293b]">
              <div className="grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                <div className="col-span-2">Invoice</div>
                <div className="col-span-2">Employee</div>
                <div className="col-span-2">Property</div>
                <div className="col-span-2">Invoice Date</div>
                <div className="col-span-2">Due Date</div>
                <div className="col-span-1 text-right">Amount</div>
                <div className="col-span-1 text-right">Status</div>
              </div>

              {filteredInvoices.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No invoices found for this hotel.</div>
              ) : (
                filteredInvoices.map((invoice) => (
                  <div key={invoice.id} className="grid grid-cols-12 gap-2 border-b border-slate-100 px-4 py-3 text-sm text-slate-700 last:border-b-0 dark:border-slate-800 dark:text-slate-200">
                    <div className="col-span-2 font-semibold">{invoice.invoiceNumber}</div>
                    <div className="col-span-2">{invoice.employeeName}</div>
                    <div className="col-span-2">{invoice.propertyName || '-'}</div>
                    <div className="col-span-2">{formatDate(invoice.invoiceDate)}</div>
                    <div className="col-span-2">{formatDate(invoice.dueDate)}</div>
                    <div className="col-span-1 text-right font-semibold">{formatCurrency(invoice.amount)}</div>
                    <div className="col-span-1 text-right">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : invoice.status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
