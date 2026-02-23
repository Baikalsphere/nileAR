"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ReconciliationItem {
  id: string
  type: 'invoice' | 'payment'
  date: string
  dueDate?: string
  description: string
  invoiceNumber?: string
  paymentReference?: string
  amount: number
  status: 'matched' | 'unmatched' | 'partial'
  icon: string
  matchedWith?: string
  daysOverdue?: number
}

interface Discrepancy {
  id: string
  invoiceId: string
  amount: number
  reason: string
  resolved: boolean
}

interface OrganizationData {
  id: string
  name: string
  gst: string | null
  creditPeriod: string | null
  paymentTerms: string | null
  status: string
  contactPerson: string | null
  email: string | null
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000'

// Mock reconciliation data with more details
const mockReconciliationData: Record<string, ReconciliationItem[]> = {
  'ORG-001': [
    { id: '1', type: 'invoice', date: '2024-02-01', dueDate: '2024-03-02', description: 'Hotel Accommodation Package A', invoiceNumber: 'INV-2024-001', amount: 15000, status: 'matched', icon: 'receipt', matchedWith: 'CHQ-5001', daysOverdue: 0 },
    { id: '2', type: 'payment', date: '2024-02-05', description: 'Payment received from Acme Corp', paymentReference: 'CHQ-5001', amount: 15000, status: 'matched', icon: 'check_circle', matchedWith: 'INV-2024-001' },
    { id: '3', type: 'invoice', date: '2024-02-08', dueDate: '2024-03-09', description: 'Conference Room Booking (3 days)', invoiceNumber: 'INV-2024-002', amount: 8500, status: 'unmatched', icon: 'receipt', daysOverdue: 5 },
    { id: '4', type: 'invoice', date: '2024-02-10', dueDate: '2024-03-11', description: 'Catering Services', invoiceNumber: 'INV-2024-003', amount: 5200, status: 'matched', icon: 'receipt', matchedWith: 'TXN-2024-112', daysOverdue: 0 },
    { id: '5', type: 'payment', date: '2024-02-12', description: 'Partial payment received', paymentReference: 'TXN-2024-112', amount: 5200, status: 'matched', icon: 'check_circle', matchedWith: 'INV-2024-003' },
    { id: '6', type: 'invoice', date: '2024-02-15', dueDate: '2024-03-16', description: 'Room upgrades and extras', invoiceNumber: 'INV-2024-004', amount: 3500, status: 'partial', icon: 'receipt', daysOverdue: 2 },
    { id: '7', type: 'payment', date: '2024-02-18', description: 'Payment for INV-2024-004 (partial)', paymentReference: 'TXN-2024-156', amount: 2500, status: 'partial', icon: 'check_circle', matchedWith: 'INV-2024-004' },
  ],
  'ORG-024': [
    { id: '1', type: 'invoice', date: '2024-02-02', dueDate: '2024-03-18', description: 'Event Management Services', invoiceNumber: 'INV-2024-101', amount: 28000, status: 'matched', icon: 'receipt', matchedWith: 'WIRE-2024-48' },
    { id: '2', type: 'payment', date: '2024-02-20', description: 'Payment received', paymentReference: 'WIRE-2024-48', amount: 28000, status: 'matched', icon: 'check_circle', matchedWith: 'INV-2024-101' },
    { id: '3', type: 'invoice', date: '2024-02-25', dueDate: '2024-04-10', description: 'Additional Services', invoiceNumber: 'INV-2024-102', amount: 12000, status: 'unmatched', icon: 'receipt', daysOverdue: 12 },
  ]
}

const mockDiscrepancies: Record<string, Discrepancy[]> = {
  'ORG-001': [
    { id: '1', invoiceId: 'INV-2024-003', amount: 500, reason: 'Tax calculation discrepancy', resolved: false }
  ],
  'ORG-024': []
}

export default function ReconciliationClient({ organizationId }: { organizationId: string }) {
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [organizationLoading, setOrganizationLoading] = useState(true)
  const [organizationError, setOrganizationError] = useState<string | null>(null)
  const items = mockReconciliationData[organizationId] || []
  const discrepancies = mockDiscrepancies[organizationId] || []
  
  const [filterStatus, setFilterStatus] = useState<'all' | 'matched' | 'unmatched' | 'partial'>('all')
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<Discrepancy | null>(null)

  useEffect(() => {
    const loadOrganization = async () => {
      setOrganizationLoading(true)
      setOrganizationError(null)

      try {
        const response = await fetch(`${apiBaseUrl}/api/organizations/${organizationId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch organization details')
        }

        const data = await response.json()
        setOrganization(data.organization as OrganizationData)
      } catch (error) {
        setOrganizationError(error instanceof Error ? error.message : 'Failed to fetch organization details')
      } finally {
        setOrganizationLoading(false)
      }
    }

    void loadOrganization()
  }, [organizationId])

  const invoices = items.filter(item => item.type === 'invoice')
  const payments = items.filter(item => item.type === 'payment')
  
  const totalInvoices = invoices.reduce((sum, item) => sum + item.amount, 0)
  const totalPayments = payments.reduce((sum, item) => sum + item.amount, 0)
  
  const unmatchedAmount = totalInvoices - totalPayments
  const matchedCount = items.filter(item => item.status === 'matched').length
  const unmatchedCount = items.filter(item => item.status === 'unmatched').length
  const partialCount = items.filter(item => item.status === 'partial').length
  const overDueCount = invoices.filter(item => item.daysOverdue && item.daysOverdue > 0).length

  const filteredItems = filterStatus === 'all' ? items : items.filter(item => item.status === filterStatus)
  const filteredInvoices = filterStatus === 'all' ? invoices : invoices.filter(item => item.status === filterStatus)

  // Group invoices with their matching payments
  const invoiceWithPayments = filteredInvoices.map(invoice => {
    const relatedPayments = payments.filter(payment => 
      payment.matchedWith === invoice.invoiceNumber || 
      invoice.matchedWith === payment.paymentReference
    )
    return {
      invoice,
      payments: relatedPayments
    }
  })

  const handleResolveDiscrepancy = (discrepancy: Discrepancy) => {
    setSelectedDiscrepancy(discrepancy)
    setShowResolveModal(true)
  }

  const confirmResolve = () => {
    if (selectedDiscrepancy) {
      console.log('Discrepancy resolved:', selectedDiscrepancy.id)
      setShowResolveModal(false)
      setSelectedDiscrepancy(null)
    }
  }

  if (organizationLoading) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
        <Sidebar title="Hotel Finance" logoIcon="domain" />
        <main className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
          Loading organization details...
        </main>
      </div>
    )
  }

  if (organizationError || !organization) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
        <Sidebar title="Hotel Finance" logoIcon="domain" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
            {organizationError ?? 'Organization not found'}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar title="Hotel Finance" logoIcon="domain" />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="mx-auto max-w-7xl flex flex-col gap-6">
            {/* Breadcrumbs */}
            <div className="flex flex-wrap gap-2">
              <Link href="/hotel-finance" className="text-slate-500 hover:text-primary text-sm font-medium leading-normal">Dashboard</Link>
              <span className="text-slate-400 text-sm font-medium leading-normal">/</span>
              <Link href="/hotel-finance/organizations" className="text-slate-500 hover:text-primary text-sm font-medium leading-normal">Organizations</Link>
              <span className="text-slate-400 text-sm font-medium leading-normal">/</span>
              <span className="text-slate-900 dark:text-slate-100 text-sm font-medium leading-normal">Reconciliation</span>
            </div>

            {/* Organization Header and Contact Info */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <h1 className="text-slate-900 dark:text-white text-3xl font-extrabold">{organization.name}</h1>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      {organization.status === 'active' ? 'Active' : organization.status === 'inactive' ? 'Inactive' : 'On Hold'}
                    </span>
                  </div>
                  <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">GST:</span>
                      <span className="font-mono">{organization.gst ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Contact:</span>
                      <span>{organization.contactPerson ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Email:</span>
                      <span>{organization.email ?? '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Link href={`/hotel-finance/organizations/${organizationId}/contract`}>
                    <button className="flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-white shadow-sm transition-all hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/30">
                      <span className="material-symbols-outlined mr-2 text-[20px]">description</span>
                      <span className="text-sm font-bold leading-normal">View Contract</span>
                    </button>
                  </Link>
                  <Link href="/hotel-finance/organizations">
                    <button className="flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-slate-900 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700">
                      <span className="material-symbols-outlined mr-2 text-[20px]">arrow_back</span>
                      <span className="text-sm font-bold leading-normal">Back</span>
                    </button>
                  </Link>
                </div>
              </div>

              {/* Credit and Payment Terms */}
              <div className="grid gap-4 sm:grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Credit Period</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{organization.creditPeriod ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Payment Terms</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{organization.paymentTerms ?? '—'}</p>
                </div>
              </div>
            </div>

            {/* Key Metrics Summary */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Total Invoices</p>
                    <p className="text-slate-900 dark:text-white text-2xl font-bold mt-1">₹{totalInvoices.toLocaleString()}</p>
                  </div>
                  <div className="flex size-12 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    <span className="material-symbols-outlined">receipt</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Total Payments</p>
                    <p className="text-slate-900 dark:text-white text-2xl font-bold mt-1">₹{totalPayments.toLocaleString()}</p>
                  </div>
                  <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <span className="material-symbols-outlined">check_circle</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Outstanding</p>
                    <p className={`text-2xl font-bold mt-1 ${unmatchedAmount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      ₹{unmatchedAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className={`flex size-12 items-center justify-center rounded-lg ${unmatchedAmount > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                    <span className="material-symbols-outlined">{unmatchedAmount > 0 ? 'warning' : 'verified'}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Matched Items</p>
                    <p className="text-slate-900 dark:text-white text-2xl font-bold mt-1">{matchedCount}</p>
                  </div>
                  <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="material-symbols-outlined">done_all</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Unmatched Items</p>
                    <p className={`text-2xl font-bold mt-1 ${unmatchedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {unmatchedCount}
                    </p>
                  </div>
                  <div className={`flex size-12 items-center justify-center rounded-lg ${unmatchedCount > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                    <span className="material-symbols-outlined">pending</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Overdue Items</p>
                    <p className={`text-2xl font-bold mt-1 ${overDueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {overDueCount}
                    </p>
                  </div>
                  <div className={`flex size-12 items-center justify-center rounded-lg ${overDueCount > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                    <span className="material-symbols-outlined">{overDueCount > 0 ? 'error' : 'check'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Discrepancies Section */}
            {discrepancies.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    <span className="material-symbols-outlined">error</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 dark:text-red-200 mb-3">Critical: Reconciliation Discrepancies</h3>
                    <p className="text-sm text-red-800 dark:text-red-300 mb-3">The following items have amount mismatches that need immediate attention:</p>
                    <div className="space-y-2">
                      {discrepancies.map((disc) => (
                        <div key={disc.id} className="flex items-center justify-between bg-white rounded-lg p-3 dark:bg-slate-800">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{disc.reason}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Invoice: {disc.invoiceId} | Difference: ₹{disc.amount.toLocaleString()}</p>
                          </div>
                          <button
                            onClick={() => handleResolveDiscrepancy(disc)}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 transition-all whitespace-nowrap ml-4"
                          >
                            Resolve
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
              {['all', 'matched', 'partial', 'unmatched'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status as any)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    filterStatus === status
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {status === 'all' ? 'All Items' : status.charAt(0).toUpperCase() + status.slice(1)} ({filterStatus === 'all' ? filteredItems.length : filterStatus === 'matched' ? matchedCount : filterStatus === 'partial' ? partialCount : unmatchedCount})
                </button>
              ))}
            </div>

            {/* Invoices and Payments Unified Section */}
            <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl">receipt_long</span>
                  Invoices & Payments Reconciliation ({filteredInvoices.length})
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1400px]">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400" colSpan={5}>Invoice Details</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400" colSpan={3}>Payment Details</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Status</th>
                    </tr>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Invoice #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Due Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Description</th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Payment Ref</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Payment Date</th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Amount Paid</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Match Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {invoiceWithPayments.map(({ invoice, payments: relatedPayments }) => (
                      <tr key={invoice.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {/* Invoice Details */}
                        <td className="px-6 py-4 align-top">
                          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{invoice.invoiceNumber}</span>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <span className="text-sm text-slate-600 dark:text-slate-300">{invoice.date}</span>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600 dark:text-slate-300">{invoice.dueDate}</span>
                            {invoice.daysOverdue && invoice.daysOverdue > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                {invoice.daysOverdue}d
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <span className="text-sm text-slate-600 dark:text-slate-300">{invoice.description}</span>
                        </td>
                        <td className="px-6 py-4 text-right align-top">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">₹{invoice.amount.toLocaleString()}</span>
                        </td>

                        {/* Payment Details */}
                        {relatedPayments.length > 0 ? (
                          <>
                            <td className="px-6 py-4 align-top">
                              <div className="space-y-1">
                                {relatedPayments.map(payment => (
                                  <div key={payment.id} className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[16px]">check_circle</span>
                                    <span className="font-mono text-sm font-medium text-emerald-700 dark:text-emerald-400">{payment.paymentReference}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 align-top">
                              <div className="space-y-1">
                                {relatedPayments.map(payment => (
                                  <span key={payment.id} className="block text-sm text-emerald-700 dark:text-emerald-400">{payment.date}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right align-top">
                              <div className="space-y-1">
                                {relatedPayments.map(payment => (
                                  <span key={payment.id} className="block text-sm font-semibold text-emerald-700 dark:text-emerald-400">₹{payment.amount.toLocaleString()}</span>
                                ))}
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 align-top">
                              <span className="text-xs text-slate-400 dark:text-slate-500">No payment</span>
                            </td>
                            <td className="px-6 py-4 align-top">
                              <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                            </td>
                            <td className="px-6 py-4 text-right align-top">
                              <span className="text-xs text-slate-400 dark:text-slate-500">₹0</span>
                            </td>
                          </>
                        )}

                        {/* Status */}
                        <td className="px-6 py-4 align-top">
                          {invoice.status === 'matched' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <span className="material-symbols-outlined text-[14px]">check</span>
                              Matched
                            </span>
                          )}
                          {invoice.status === 'unmatched' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-400">
                              <span className="material-symbols-outlined text-[14px]">close</span>
                              Unmatched
                            </span>
                          )}
                          {invoice.status === 'partial' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              <span className="material-symbols-outlined text-[14px]">schedule</span>
                              Partial
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredInvoices.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-6">
                  <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-3">inbox</span>
                  <p className="text-slate-600 dark:text-slate-400">No items found for selected filter</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 flex-wrap">
              <button className="flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-white shadow-sm shadow-blue-500/20 transition-all hover:bg-blue-600 focus:ring-4 focus:ring-blue-500/30">
                <span className="material-symbols-outlined mr-2 text-[20px]">check</span>
                <span className="text-sm font-bold leading-normal">Mark as Reconciled</span>
              </button>
              <button className="flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-6 text-slate-900 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700">
                <span className="material-symbols-outlined mr-2 text-[20px]">download</span>
                <span className="text-sm font-bold leading-normal">Export PDF Report</span>
              </button>
              <button className="flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-6 text-slate-900 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700">
                <span className="material-symbols-outlined mr-2 text-[20px]">mail</span>
                <span className="text-sm font-bold leading-normal">Send Report</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Resolve Discrepancy Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 p-6 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Resolve Discrepancy</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Invoice ID</label>
                  <p className="text-slate-900 dark:text-white font-mono mt-1">{selectedDiscrepancy?.invoiceId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount Difference</label>
                  <p className="text-slate-900 dark:text-white font-bold mt-1">₹{selectedDiscrepancy?.amount.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Reason</label>
                  <p className="text-slate-900 dark:text-white mt-1">{selectedDiscrepancy?.reason}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Resolution Notes</label>
                  <textarea 
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Explain how this discrepancy was resolved..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 border-t border-slate-200 p-6 dark:border-slate-800">
              <button
                onClick={() => setShowResolveModal(false)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-900 font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmResolve}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-white font-medium hover:bg-blue-600 transition-all"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
