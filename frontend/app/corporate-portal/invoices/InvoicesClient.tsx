"use client"

import Link from 'next/link'
import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { corporateTokenStorage, fetchCorporateInvoices, CorporateInvoice } from '@/lib/corporateAuth'

export default function InvoicesClient() {
  const router = useRouter()
  const [invoicesData, setInvoicesData] = useState<CorporateInvoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])

  useEffect(() => {
    const token = corporateTokenStorage.get()
    if (!token) {
      router.replace('/corporate-portal/login')
      return
    }

    const loadInvoices = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetchCorporateInvoices()
        setInvoicesData(response.invoices)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load invoices'
        setError(message)
        if (message.toLowerCase().includes('unauthorized')) {
          corporateTokenStorage.clear()
          router.replace('/corporate-portal/login')
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadInvoices()
  }, [router])

  const filteredInvoices = invoicesData.filter(invoice => {
    const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         invoice.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (invoice.senderHotelName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || invoice.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const toggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id))
    }
  }

  const toggleSelectInvoice = (id: string) => {
    if (selectedInvoices.includes(id)) {
      setSelectedInvoices(selectedInvoices.filter(invId => invId !== id))
    } else {
      setSelectedInvoices([...selectedInvoices, id])
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'overdue') {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
    } else if (status === 'unpaid') {
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
    } else {
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
    }
  }

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar title="TravelCorp" logoIcon="apartment" />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="mx-auto max-w-7xl flex flex-col gap-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm">
              <a className="text-slate-500 hover:text-primary dark:text-gray-400" href="#">Dashboard</a>
              <span className="text-gray-300 dark:text-gray-600">/</span>
              <span className="font-semibold text-slate-900 dark:text-white">Invoice History</span>
            </nav>

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
                  Invoice History &amp; Tracking
                </h1>
                <p className="text-slate-500 dark:text-gray-400 max-w-2xl">
                  View and manage your hotel invoices, track payment status, and process outstanding balances securely.
                </p>
              </div>
              <div className="flex gap-3">
                <button className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-[20px]">download</span>
                  Export CSV
                </button>
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-blue-600 transition-colors shadow-md shadow-primary/20">
                  <span className="material-symbols-outlined text-[20px]">credit_card</span>
                  Pay Selected
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Filters & Search */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Search */}
                <div className="md:col-span-4 lg:col-span-5">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-1.5">Search</label>
                  <div className="relative">
                    <input
                      className="w-full h-11 pl-11 pr-4 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                      placeholder="Search by Guest Name or Invoice #"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      type="text"
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500">
                      <span className="material-symbols-outlined text-[20px]">search</span>
                    </div>
                  </div>
                </div>

                {/* Start Date */}
                <div className="md:col-span-3 lg:col-span-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-1.5">Start Date</label>
                  <input
                    className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                {/* End Date */}
                <div className="md:col-span-3 lg:col-span-2">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-1.5">End Date</label>
                  <input
                    className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                {/* Status Filter */}
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-1.5">Status</label>
                  <div className="relative">
                    <select
                      className="w-full h-11 pl-3 pr-10 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none text-sm cursor-pointer"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">All Statuses</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="overdue">Overdue</option>
                      <option value="paid">Paid</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <span className="material-symbols-outlined text-[20px]">arrow_drop_down</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-gray-700">
                      <th className="py-3 pl-5 pr-2 w-[36px]">
                        <input
                          className="rounded border-slate-300 text-primary focus:ring-primary/20 dark:bg-slate-700 dark:border-gray-600 size-4 cursor-pointer"
                          type="checkbox"
                          checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Invoice #</th>
                      <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Guest</th>
                      <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Hotel</th>
                      <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Issued</th>
                      <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Due Date</th>
                      <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 text-right">Amount</th>
                      <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 text-center">Status</th>
                      <th className="py-3 pl-3 pr-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                    {isLoading ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-sm text-slate-500 dark:text-gray-400">Loading invoices...</td>
                      </tr>
                    ) : filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-sm text-slate-500 dark:text-gray-400">
                          {invoicesData.length === 0 ? 'No invoices found.' : 'No invoices match your filters.'}
                        </td>
                      </tr>
                    ) : filteredInvoices.map((invoice) => (
                      <tr key={invoice.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => window.location.href = `/corporate-portal/invoices/${invoice.invoiceNumber}`}>
                        <td className="py-3 pl-5 pr-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            className="rounded border-slate-300 text-primary focus:ring-primary/20 dark:bg-slate-700 dark:border-gray-600 size-4 cursor-pointer"
                            type="checkbox"
                            checked={selectedInvoices.includes(invoice.id)}
                            onChange={() => toggleSelectInvoice(invoice.id)}
                          />
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-primary text-sm tabular-nums whitespace-nowrap">#{invoice.invoiceNumber}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">{invoice.employeeName}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-sm text-slate-600 dark:text-gray-300 whitespace-nowrap">{invoice.senderHotelName ?? invoice.propertyName ?? 'Hotel Stay'}</span>
                        </td>
                        <td className="py-3 px-3 text-sm text-slate-500 dark:text-gray-400 tabular-nums whitespace-nowrap">{new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                        <td className="py-3 px-3 text-sm tabular-nums whitespace-nowrap">
                          {invoice.status === 'overdue' ? <span className="font-medium text-red-600 dark:text-red-400">{new Date(invoice.dueDate).toLocaleDateString()}</span> : <span className="text-slate-600 dark:text-gray-300">{new Date(invoice.dueDate).toLocaleDateString()}</span>}
                        </td>
                        <td className="py-3 px-3 text-sm font-bold text-slate-900 dark:text-white text-right tabular-nums whitespace-nowrap">
                          ₹{invoice.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${getStatusBadge(invoice.status)}`}>
                            {getStatusLabel(invoice.status)}
                          </span>
                        </td>
                        <td className="py-3 pl-3 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                          {invoice.status !== 'paid' ? (
                            <Link href={`/corporate-portal/invoices/${invoice.invoiceNumber}`} className="px-3.5 py-1.5 bg-primary hover:bg-blue-600 text-white text-xs font-bold rounded-md shadow-sm shadow-primary/30 transition-colors inline-block">
                              Pay Now
                            </Link>
                          ) : (
                            <button className="p-1.5 text-slate-400 hover:text-primary dark:text-gray-500 dark:hover:text-primary rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Download">
                              <span className="material-symbols-outlined text-[18px]">download</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-gray-400">
                  Showing <span className="font-bold text-slate-900 dark:text-white">{filteredInvoices.length}</span> of <span className="font-bold text-slate-900 dark:text-white">{invoicesData.length}</span> invoices
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
