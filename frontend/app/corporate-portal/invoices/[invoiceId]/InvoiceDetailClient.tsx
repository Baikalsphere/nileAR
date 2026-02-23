"use client"

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import { useEffect, useState } from 'react'
import { corporateApiBaseUrl, corporateTokenStorage, fetchCorporateInvoiceDetail, CorporateInvoiceDetail } from '@/lib/corporateAuth'

export default function InvoiceDetailClient() {
  const params = useParams()
  const router = useRouter()
  const invoiceId = params.invoiceId as string

  const [invoice, setInvoice] = useState<CorporateInvoiceDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = corporateTokenStorage.get()
    if (!token) {
      router.replace('/corporate-portal/login')
      return
    }

    const loadInvoice = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetchCorporateInvoiceDetail(invoiceId)
        setInvoice(response.invoice)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load invoice'
        setError(message)
        if (message.toLowerCase().includes('unauthorized')) {
          corporateTokenStorage.clear()
          router.replace('/corporate-portal/login')
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadInvoice()
  }, [invoiceId, router])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
        <Sidebar title="TravelCorp" logoIcon="apartment" />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <Header />
          <div className="flex-1 flex items-center justify-center">Loading invoice...</div>
        </main>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
        <Sidebar title="TravelCorp" logoIcon="apartment" />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <Header />
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-[64px] text-slate-300 dark:text-slate-600">error</span>
            <h2 className="text-xl font-bold mt-4 text-text-main-light dark:text-text-main-dark">Invoice Not Found</h2>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            <Link href="/corporate-portal/invoices" className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Invoices
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const invoiceDate = new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const checkInDate = new Date(invoice.checkInDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const checkOutDate = new Date(invoice.checkOutDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const sentAt = invoice.sentAt
    ? new Date(invoice.sentAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Not sent'

  const getStatusBadge = (status: string) => {
    if (status === 'paid') {
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
    } else if (status === 'overdue') {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
    } else {
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
    }
  }

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(value)
  }

  const extraBillsTotal = invoice.bills.reduce((sum, bill) => sum + Number(bill.billAmount ?? 0), 0)

  const accessToken = corporateTokenStorage.get()

  const getBillAssetUrl = (bill: CorporateInvoiceDetail['bills'][number]) => {
    if (!bill.fileUrl || !bill.hasFile) {
      return null
    }

    if (!accessToken) {
      return null
    }

    const base = bill.fileUrl.startsWith('http') ? bill.fileUrl : `${corporateApiBaseUrl}${bill.fileUrl}`
    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}token=${encodeURIComponent(accessToken)}`
  }

  const isImageBill = (mimeType: string | null, fileName: string) => {
    if (mimeType?.startsWith('image/')) {
      return true
    }
    return /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName)
  }

  const isPdfBill = (mimeType: string | null, fileName: string) => {
    if (mimeType === 'application/pdf') {
      return true
    }
    return /\.pdf$/i.test(fileName)
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark">
      <Sidebar title="TravelCorp" logoIcon="apartment" />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="shrink-0 px-6 pt-6 pb-2 bg-white dark:bg-[#161f2c] border-b border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-wrap gap-2 mb-4 items-center">
                <Link className="text-primary hover:text-blue-700 text-sm font-medium leading-normal transition-colors" href="/corporate-portal/invoices">
                  Invoices
                </Link>
                <span className="text-slate-400 text-sm font-medium leading-normal material-symbols-outlined text-[16px]">
                  chevron_right
                </span>
                <span className="text-slate-900 dark:text-white text-sm font-medium leading-normal">#{invoiceId}</span>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl md:text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">
                      Invoice {invoice.invoiceNumber}
                    </h1>
                    <span className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-semibold ${getStatusBadge(invoice.status)}`}>
                      {getStatusLabel(invoice.status)}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">
                    {invoice.propertyName ?? 'Property'} • Issued {invoiceDate}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button className="flex items-center justify-center overflow-hidden rounded-lg h-10 px-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    Dispute
                  </button>
                  {invoice.status !== 'paid' ? (
                    <Link
                      href={`/corporate-portal/invoices/${invoiceId}/checkout`}
                      className="flex items-center justify-center overflow-hidden rounded-lg h-10 px-6 bg-primary hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-colors gap-2"
                    >
                      <span className="material-symbols-outlined text-[20px]">check</span>
                      Approve &amp; Pay
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-6 gap-6 max-w-7xl mx-auto w-full">
            <div className="flex-1 lg:flex-[1.2] bg-white dark:bg-[#161f2c] dark:border dark:border-slate-800 rounded-xl shadow-sm flex flex-col overflow-hidden h-full">
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400">receipt_long</span>
                  Invoice Breakdown
                </h3>
                <div className="text-sm text-text-sub-light dark:text-text-sub-dark">
                  {invoice.bills.length} bill{invoice.bills.length === 1 ? '' : 's'} uploaded
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">Category</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">Bill File</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">Uploaded</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                    {invoice.bills.length > 0 ? (
                      invoice.bills.map((bill) => (
                        <tr key={bill.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-4 px-5 font-medium">{bill.billCategory}</td>
                          <td className="py-4 px-5">
                            <div className="flex flex-col gap-1">
                              <span>{bill.fileName}</span>
                              {getBillAssetUrl(bill) ? (
                                <a
                                  href={getBillAssetUrl(bill) ?? '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary text-xs font-semibold"
                                >
                                  Open exact copy
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">File copy unavailable</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-5 text-right font-semibold">{formatCurrency(Number(bill.billAmount ?? 0))}</td>
                          <td className="py-4 px-5">{new Date(bill.createdAt).toLocaleDateString('en-IN')}</td>
                          <td className="py-4 px-5">{bill.notes?.trim() ? bill.notes : '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 px-5 text-center text-text-sub-light dark:text-text-sub-dark">
                          No uploaded bills found for this invoice.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {invoice.bills.length > 0 ? (
                <div className="px-5 pb-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-200 mb-3">Uploaded Bill Copies</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {invoice.bills.map((bill) => {
                      const assetUrl = getBillAssetUrl(bill)
                      return (
                        <div key={bill.id} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900/30">
                          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {bill.billCategory} - {bill.fileName}
                          </div>
                          <div className="h-56 flex items-center justify-center bg-white dark:bg-slate-900">
                            {!assetUrl ? (
                              <span className="text-xs text-slate-400">No file copy available</span>
                            ) : isImageBill(bill.mimeType, bill.fileName) ? (
                              <img src={assetUrl} alt={bill.fileName} className="h-full w-full object-contain" />
                            ) : isPdfBill(bill.mimeType, bill.fileName) ? (
                              <iframe src={assetUrl} title={bill.fileName} className="h-full w-full" />
                            ) : (
                              <a
                                href={assetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-white text-sm font-semibold"
                              >
                                <span className="material-symbols-outlined text-[18px]">description</span>
                                Open File Copy
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-500">Extra Bills Total</span>
                  <span className="text-base font-semibold text-slate-900 dark:text-white">{formatCurrency(extraBillsTotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Total Invoice Amount</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(invoice.amount)}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-white dark:bg-[#161f2c] dark:border dark:border-slate-800 rounded-xl shadow-sm flex flex-col overflow-hidden h-full">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400">verified_user</span>
                  Booking & Employee Details
                </h3>
              </div>

              <div className="p-5 space-y-4 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-text-sub-light dark:text-text-sub-dark">Employee</span>
                  <span className="font-semibold text-text-main-light dark:text-text-main-dark">{invoice.employeeName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-sub-light dark:text-text-sub-dark">Employee Code</span>
                  <span className="font-semibold text-text-main-light dark:text-text-main-dark">{invoice.employeeCode}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-sub-light dark:text-text-sub-dark">Booking Number</span>
                  <span className="font-semibold text-text-main-light dark:text-text-main-dark">{invoice.bookingNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-sub-light dark:text-text-sub-dark">Room Type</span>
                  <span className="font-semibold text-text-main-light dark:text-text-main-dark">{invoice.roomType}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-sub-light dark:text-text-sub-dark">Stay Period</span>
                  <span className="font-semibold text-text-main-light dark:text-text-main-dark">{checkInDate} - {checkOutDate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-sub-light dark:text-text-sub-dark">Due Date</span>
                  <span className="font-semibold text-text-main-light dark:text-text-main-dark">{dueDate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-sub-light dark:text-text-sub-dark">Sent On</span>
                  <span className="font-semibold text-text-main-light dark:text-text-main-dark">{sentAt}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
