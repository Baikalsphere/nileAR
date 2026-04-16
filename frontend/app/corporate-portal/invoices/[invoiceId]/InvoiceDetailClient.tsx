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
          <div className="flex-1 flex items-center justify-center text-text-sub-light dark:text-text-sub-dark">
            Loading invoice...
          </div>
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
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <span className="material-symbols-outlined text-[64px] text-slate-300 dark:text-slate-600">receipt_long</span>
            <h2 className="text-xl font-bold text-text-main-light dark:text-text-main-dark">Invoice Not Found</h2>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Link href="/corporate-portal/invoices" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Invoices
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v)

  const fmtDate = (d: string | Date | undefined | null, opts?: Intl.DateTimeFormatOptions) => {
    if (!d) return '—'
    const parsed = new Date(d)
    if (Number.isNaN(parsed.getTime())) return '—'
    return parsed.toLocaleDateString('en-IN', opts ?? { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const roomCharges = Number(invoice.roomCharges ?? 0)
  const additionalCharges = invoice.bills
    .filter(b => b.billCategory !== 'Main Bill' && b.billCategory !== 'GST E-Invoice')
    .reduce((s, b) => s + Number(b.billAmount ?? 0), 0)
  const supportingDocs = invoice.bills.filter(b => b.billCategory === 'Main Bill' || b.billCategory === 'GST E-Invoice' || b.hasFile)

  const isOverdue = invoice.status === 'overdue'
  const isPaid = invoice.status === 'paid'

  const statusConfig = {
    paid:    { label: 'Paid',    bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', icon: 'check_circle' },
    overdue: { label: 'Overdue', bg: 'bg-red-100 dark:bg-red-900/30',        text: 'text-red-700 dark:text-red-400',         border: 'border-red-200 dark:border-red-800',         icon: 'error' },
    unpaid:  { label: 'Unpaid',  bg: 'bg-amber-100 dark:bg-amber-900/30',    text: 'text-amber-700 dark:text-amber-400',     border: 'border-amber-200 dark:border-amber-800',     icon: 'schedule' },
  }
  const sc = statusConfig[invoice.status as keyof typeof statusConfig] ?? statusConfig.unpaid

  const accessToken = corporateTokenStorage.get()
  const getBillAssetUrl = (bill: CorporateInvoiceDetail['bills'][number]) => {
    if (!bill.fileUrl || !bill.hasFile || !accessToken) return null
    const base = bill.fileUrl.startsWith('http') ? bill.fileUrl : `${corporateApiBaseUrl}${bill.fileUrl}`
    return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(accessToken)}`
  }
  const isImage = (mime: string | null, name: string) =>
    mime?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name ?? '')
  const isPdf = (mime: string | null, name: string) =>
    mime === 'application/pdf' || /\.pdf$/i.test(name ?? '')

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark">
      <Sidebar title="TravelCorp" logoIcon="apartment" />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-6">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/corporate-portal/invoices" className="text-primary hover:text-blue-700 font-medium transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Invoices
              </Link>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="text-text-main-light dark:text-text-main-dark font-semibold">{invoice.invoiceNumber}</span>
            </nav>

            {/* ── Hero Banner ── */}
            <div className={`rounded-2xl p-6 md:p-8 ${
              isPaid
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                : isOverdue
                ? 'bg-gradient-to-r from-red-600 to-rose-600'
                : 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700'
            } text-white shadow-lg`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                {/* Left: invoice meta */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${sc.bg} ${sc.text} ${sc.border}`}>
                      <span className="material-symbols-outlined text-[14px]">{sc.icon}</span>
                      {sc.label}
                    </span>
                    <span className="text-white/70 text-sm">{invoice.invoiceNumber}</span>
                  </div>
                  <div>
                    <p className="text-white/70 text-sm mb-1">{invoice.senderHotelName ?? invoice.propertyName ?? 'Hotel Stay'}</p>
                    <p className="text-white/80 text-sm">
                      Guest: <span className="font-semibold text-white">{invoice.employeeName ?? '—'}</span>
                      {invoice.bookingNumber && <> &nbsp;·&nbsp; Booking: <span className="font-semibold text-white">{invoice.bookingNumber}</span></>}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-white/80 mt-1">
                    <span>Issued: <span className="font-semibold text-white">{fmtDate(invoice.invoiceDate)}</span></span>
                    <span>Due: <span className={`font-semibold ${isOverdue ? 'text-red-200' : 'text-white'}`}>{fmtDate(invoice.dueDate)}</span></span>
                  </div>
                </div>

                {/* Right: total + action */}
                <div className="flex flex-col items-start md:items-end gap-4">
                  <div className="text-right">
                    <p className="text-white/70 text-sm uppercase tracking-wide font-semibold">Total Due</p>
                    <p className="text-4xl md:text-5xl font-black tracking-tight">{fmt(invoice.amount)}</p>
                  </div>
                  {!isPaid && (
                    <Link
                      href={`/corporate-portal/invoices/${invoiceId}/checkout`}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-bold rounded-xl shadow-lg hover:bg-slate-50 transition-colors text-sm"
                    >
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      Approve &amp; Pay
                    </Link>
                  )}
                  {isPaid && (
                    <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 rounded-xl text-sm font-bold">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      Payment Received
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Main grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left: breakdown + docs (2/3) */}
              <div className="lg:col-span-2 flex flex-col gap-6">

                {/* Invoice Line Items */}
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">receipt_long</span>
                    <h2 className="font-bold text-text-main-light dark:text-text-main-dark">Invoice Breakdown</h2>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-6 py-3 text-left font-semibold">Description</th>
                        <th className="px-6 py-3 text-left font-semibold">Details</th>
                        <th className="px-6 py-3 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {/* Room charges row */}
                      <tr>
                        <td className="px-6 py-4 font-semibold text-text-main-light dark:text-text-main-dark">Room Charges</td>
                        <td className="px-6 py-4 text-text-sub-light dark:text-text-sub-dark">
                          {invoice.roomType}
                          {invoice.nights > 0 && <> · {invoice.nights} night{invoice.nights !== 1 ? 's' : ''}</>}
                          {invoice.pricePerNight > 0 && <> · {fmt(invoice.pricePerNight)}/night</>}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-text-main-light dark:text-text-main-dark">{fmt(roomCharges)}</td>
                      </tr>

                      {/* Additional charge rows */}
                      {invoice.bills
                        .filter(b => b.billCategory !== 'Main Bill' && b.billCategory !== 'GST E-Invoice')
                        .map(bill => (
                          <tr key={bill.id}>
                            <td className="px-6 py-4 font-medium text-text-main-light dark:text-text-main-dark">{bill.billCategory}</td>
                            <td className="px-6 py-4 text-text-sub-light dark:text-text-sub-dark">
                              {bill.notes?.trim()
                                ? <span>{bill.notes}</span>
                                : <span className="italic text-slate-400 text-xs">Additional service charge</span>
                              }
                              {bill.hasFile && getBillAssetUrl(bill) && (
                                <a href={getBillAssetUrl(bill)!} target="_blank" rel="noreferrer"
                                  className="ml-3 inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline">
                                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>View receipt
                                </a>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-text-main-light dark:text-text-main-dark">
                              {Number(bill.billAmount ?? 0) > 0 ? fmt(Number(bill.billAmount)) : <span className="text-slate-400">—</span>}
                            </td>
                          </tr>
                        ))
                      }

                      {invoice.bills.filter(b => b.billCategory !== 'Main Bill' && b.billCategory !== 'GST E-Invoice').length === 0 && (
                        <tr>
                          <td className="px-6 py-4 text-text-sub-light dark:text-text-sub-dark italic" colSpan={3}>No additional charges.</td>
                        </tr>
                      )}
                    </tbody>

                    {/* Totals footer */}
                    <tfoot>
                      {additionalCharges > 0 && (
                        <tr className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                          <td colSpan={2} className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Additional Charges</td>
                          <td className="px-6 py-3 text-right font-semibold text-text-main-light dark:text-text-main-dark">{fmt(additionalCharges)}</td>
                        </tr>
                      )}
                      <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                        <td colSpan={2} className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wider text-text-main-light dark:text-text-main-dark">Total Invoice Amount</td>
                        <td className="px-6 py-4 text-right text-xl font-black text-primary">{fmt(invoice.amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Supporting Documents */}
                {supportingDocs.length > 0 && (
                  <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">folder_open</span>
                      <h2 className="font-bold text-text-main-light dark:text-text-main-dark">Supporting Documents</h2>
                      <span className="ml-auto text-xs font-bold text-primary bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">{supportingDocs.length}</span>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {supportingDocs.map(bill => {
                        const assetUrl = getBillAssetUrl(bill)
                        return (
                          <div key={bill.id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                              <div>
                                <p className="text-xs font-bold text-text-main-light dark:text-text-main-dark">{bill.billCategory}</p>
                                <p className="text-[11px] text-slate-400 truncate max-w-[180px]">{bill.fileName ?? 'No filename'}</p>
                              </div>
                              {assetUrl && (
                                <a href={assetUrl} target="_blank" rel="noreferrer"
                                  className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline shrink-0">
                                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>Open
                                </a>
                              )}
                            </div>
                            <div className="h-52 flex items-center justify-center bg-white dark:bg-slate-900">
                              {!assetUrl ? (
                                <div className="text-center">
                                  <span className="material-symbols-outlined text-[36px] text-slate-300 dark:text-slate-600 block">description</span>
                                  <p className="text-xs text-slate-400 mt-1">File unavailable</p>
                                </div>
                              ) : isImage(bill.mimeType, bill.fileName ?? '') ? (
                                <img src={assetUrl} alt={bill.fileName ?? ''} className="h-full w-full object-contain" />
                              ) : isPdf(bill.mimeType, bill.fileName ?? '') ? (
                                <iframe src={assetUrl} title={bill.fileName ?? ''} className="h-full w-full" />
                              ) : (
                                <a href={assetUrl} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow">
                                  <span className="material-symbols-outlined text-[18px]">description</span>
                                  Open File
                                </a>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right sidebar (1/3) */}
              <div className="flex flex-col gap-4">

                {/* Payment summary card */}
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">payments</span>
                    <h3 className="font-bold text-text-main-light dark:text-text-main-dark">Payment Summary</h3>
                  </div>
                  <div className="px-5 py-4 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-sub-light dark:text-text-sub-dark">Room Charges</span>
                      <span className="font-semibold">{fmt(roomCharges)}</span>
                    </div>
                    {additionalCharges > 0 && (
                      <div className="flex justify-between">
                        <span className="text-text-sub-light dark:text-text-sub-dark">Additional Charges</span>
                        <span className="font-semibold">{fmt(additionalCharges)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-text-main-light dark:text-text-main-dark">Total Due</span>
                      <span className="font-black text-xl text-primary">{fmt(invoice.amount)}</span>
                    </div>
                  </div>
                  {!isPaid && (
                    <div className="px-5 pb-5">
                      <Link
                        href={`/corporate-portal/invoices/${invoiceId}/checkout`}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm shadow-md shadow-primary/25"
                      >
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        Approve &amp; Pay
                      </Link>
                    </div>
                  )}
                  {isPaid && (
                    <div className="px-5 pb-5">
                      <div className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold rounded-xl text-sm border border-emerald-200 dark:border-emerald-800">
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        Payment Received
                      </div>
                    </div>
                  )}
                </div>

                {/* Stay details */}
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">hotel</span>
                    <h3 className="font-bold text-text-main-light dark:text-text-main-dark">Stay Details</h3>
                  </div>
                  <div className="px-5 py-4 space-y-3 text-sm">
                    {[
                      { label: 'Hotel', value: invoice.senderHotelName ?? invoice.propertyName ?? '—' },
                      { label: 'Guest', value: invoice.employeeName ?? '—' },
                      ...(invoice.employeeCode ? [{ label: 'Employee Code', value: invoice.employeeCode }] : []),
                      { label: 'Booking Ref', value: invoice.bookingNumber ?? '—' },
                      { label: 'Room Type', value: invoice.roomType ?? '—' },
                      { label: 'Check-in', value: fmtDate(invoice.checkInDate) },
                      { label: 'Check-out', value: fmtDate(invoice.checkOutDate) },
                      { label: 'Nights', value: String(invoice.nights ?? '—') },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-start gap-3">
                        <span className="text-text-sub-light dark:text-text-sub-dark shrink-0">{label}</span>
                        <span className="font-semibold text-text-main-light dark:text-text-main-dark text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invoice meta */}
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">info</span>
                    <h3 className="font-bold text-text-main-light dark:text-text-main-dark">Invoice Info</h3>
                  </div>
                  <div className="px-5 py-4 space-y-3 text-sm">
                    {[
                      { label: 'Invoice #', value: invoice.invoiceNumber },
                      { label: 'Invoice Date', value: fmtDate(invoice.invoiceDate) },
                      { label: 'Due Date', value: fmtDate(invoice.dueDate) },
                      { label: 'Sent On', value: invoice.sentAt ? fmtDate(invoice.sentAt) : 'Not sent' },
                      { label: 'Status', value: sc.label },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-start gap-3">
                        <span className="text-text-sub-light dark:text-text-sub-dark shrink-0">{label}</span>
                        <span className={`font-semibold text-right ${label === 'Status' ? sc.text : 'text-text-main-light dark:text-text-main-dark'}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
