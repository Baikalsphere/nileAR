"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { tokenStorage } from '@/lib/auth'
import { addBookingBill, BookingRecord, fetchBookingById } from '@/lib/bookingsApi'
import { saveAttachments, type AttachedDocumentsMeta } from './data'

interface Charge {
  id: string
  serviceType: string
  date: string
  amount: string
  notes: string
  file: File | null
  fileName?: string
}

const BILL_KEY_MAP: Record<string, keyof AttachedDocumentsMeta> = {
  'Laundry Service': 'laundry',
  'Food & Beverage': 'foodBeverage',
  'Room Service': 'roomService',
  'Bar & Lounge': 'barLounge',
  'Spa & Wellness': 'spaWellness',
  Minibar: 'minibar',
  'Conference & Banquet': 'conferenceHall',
  'Parking & Valet': 'parking',
  'Phone & Communication': 'miscellaneous',
  Transportation: 'miscellaneous',
  Miscellaneous: 'miscellaneous',
}

const SERVICE_TYPES = [
  'Laundry Service',
  'Food & Beverage',
  'Room Service',
  'Bar & Lounge',
  'Spa & Wellness',
  'Minibar',
  'Conference & Banquet',
  'Parking & Valet',
  'Phone & Communication',
  'Transportation',
  'Miscellaneous',
]

export default function AttachBillsClient({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [booking, setBooking] = useState<BookingRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [charges, setCharges] = useState<Charge[]>([])
  const [gstInvoice, setGstInvoice] = useState<{ file: File | null; fileName?: string }>({ file: null })
  const [dragOver, setDragOver] = useState<string | null>(null)
  
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const gstRef = useRef<HTMLInputElement>(null)

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
        const response = await fetchBookingById(bookingId)
        setBooking(response.booking)
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load booking')
      } finally {
        setIsLoading(false)
      }
    }

    void loadBooking()
  }, [bookingId, router])

  const handleFileSelect = (chargeId: string, file: File | null) => {
    if (!file) return
    setCharges(prev => prev.map(c => 
      c.id === chargeId 
        ? { ...c, file, fileName: file.name }
        : c
    ))
  }

  const handleGstFileSelect = (file: File | null) => {
    if (!file) return
    setGstInvoice({ file, fileName: file.name })
  }

  const handleRemoveFile = (chargeId: string) => {
    setCharges(prev => prev.map(c => 
      c.id === chargeId 
        ? { ...c, file: null, fileName: undefined }
        : c
    ))
    if (fileRefs.current[chargeId]) {
      fileRefs.current[chargeId]!.value = ''
    }
  }

  const handleRemoveGst = () => {
    setGstInvoice({ file: null })
    if (gstRef.current) gstRef.current.value = ''
  }

  const handleUpdateCharge = (chargeId: string, field: keyof Charge, value: any) => {
    setCharges(prev => prev.map(c => 
      c.id === chargeId 
        ? { ...c, [field]: value }
        : c
    ))
  }

  const handleAddCharge = () => {
    const newCharge: Charge = {
      id: Date.now().toString(),
      serviceType: 'Laundry Service',
      date: new Date().toISOString().split('T')[0],
      amount: '',
      notes: '',
      file: null,
    }
    setCharges(prev => [...prev, newCharge])
  }

  const handleRemoveCharge = (chargeId: string) => {
    setCharges(prev => prev.filter(c => c.id !== chargeId))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const parseChargeAmount = (value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0
    }
    return parsed
  }

  const uploadedCharges = charges.filter((charge) => charge.file)
  const extraBillsTotal = uploadedCharges.reduce((sum, charge) => sum + parseChargeAmount(charge.amount), 0)
  const updatedInvoiceTotal = booking ? booking.totalPrice + extraBillsTotal : extraBillsTotal

  const handleSubmit = async () => {
    const hasCharges = charges.length > 0
    
    if (!hasCharges && !gstInvoice.file) {
      alert('Please add at least one charge or upload a GST e-invoice.')
      return
    }

    setIsSubmitting(true)
    try {
      const attachedDocuments: AttachedDocumentsMeta = {}

      for (const charge of charges) {
        if (!charge.file) continue

        const parsedAmount = Number(charge.amount)
        if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
          alert(`Enter a valid amount for ${charge.serviceType}`)
          setIsSubmitting(false)
          return
        }

        const key = BILL_KEY_MAP[charge.serviceType] ?? 'miscellaneous'
        attachedDocuments[key] = {
          name: charge.file.name,
          size: charge.file.size,
          type: charge.file.type,
        }

        await addBookingBill(bookingId, {
          billCategory: charge.serviceType,
          fileName: charge.file.name,
          file: charge.file,
          billAmount: parsedAmount,
          mimeType: charge.file.type || null,
          fileSize: charge.file.size,
          notes: charge.notes || null,
        })
      }

      if (gstInvoice.file) {
        attachedDocuments.miscellaneous = {
          name: gstInvoice.file.name,
          size: gstInvoice.file.size,
          type: gstInvoice.file.type,
        }

        await addBookingBill(bookingId, {
          billCategory: 'GST E-Invoice',
          fileName: gstInvoice.file.name,
          file: gstInvoice.file,
          billAmount: 0,
          mimeType: gstInvoice.file.type || null,
          fileSize: gstInvoice.file.size,
          notes: null,
        })
      }

      saveAttachments(bookingId, attachedDocuments)
      alert('Attachments saved successfully! Proceeding to send...')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save attachments')
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    router.push(`/hotel-finance/bookings/${bookingId}/send`)
  }

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
              <span className="text-text-main-light dark:text-text-main-dark font-medium">{booking.bookingNumber}</span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="text-primary font-semibold">Bills & Incidental Charges</span>
            </div>

            {/* Booking Info Card */}
            <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4"></div>
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2.5 py-1 bg-white/20 rounded-lg text-xs font-bold uppercase tracking-wider">
                        {booking.bookingNumber}
                      </span>
                      <span className="px-2.5 py-1 bg-sky-400/20 text-sky-200 rounded-lg text-xs font-bold uppercase tracking-wider">
                        {booking.status}
                      </span>
                    </div>
                    <h1 className="text-2xl font-bold">{booking.organizationName}</h1>
                    <p className="text-blue-100 mt-1">Guest: {booking.employeeName} • {booking.roomType}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-200 text-sm">Contract Base Amount</p>
                    <p className="text-2xl font-extrabold">₹{booking.totalPrice.toLocaleString()}</p>
                    <p className="text-blue-200 text-sm mt-1">Extra Bills: ₹{extraBillsTotal.toLocaleString()}</p>
                    <p className="text-white text-lg font-bold mt-1">Updated Total: ₹{updatedInvoiceTotal.toLocaleString()}</p>
                    <p className="text-blue-200 text-sm mt-1">
                      Check-in: {new Date(booking.checkInDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Incidental Charges Section */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-primary">receipt_long</span>
                  <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">Incidental Charges & Uploads</h2>
                </div>
                <button
                  onClick={handleAddCharge}
                  className="flex items-center gap-2 px-4 py-2 text-primary font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined">add</span>
                  Add Charge
                </button>
              </div>

              {/* Charges List */}
              <div className="p-6 space-y-6">
                {charges.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700 block mb-3">inbox</span>
                    <p className="text-text-sub-light dark:text-text-sub-dark">No charges added yet. Click "Add Charge" to get started.</p>
                  </div>
                ) : (
                  charges.map((charge) => (
                    <div key={charge.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 hover:border-primary/40 dark:hover:border-primary/40 transition-colors">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: Form Fields */}
                        <div className="lg:col-span-2 space-y-4">
                          {/* Service Type */}
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                              Service Type
                            </label>
                            <select
                              value={charge.serviceType}
                              onChange={(e) => handleUpdateCharge(charge.id, 'serviceType', e.target.value)}
                              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            >
                              {SERVICE_TYPES.map(type => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Date and Amount Row */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                                Date
                              </label>
                              <input
                                type="date"
                                value={charge.date}
                                onChange={(e) => handleUpdateCharge(charge.id, 'date', e.target.value)}
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                                Amount ($)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={charge.amount}
                                onChange={(e) => handleUpdateCharge(charge.id, 'amount', e.target.value)}
                                placeholder="0.00"
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                              />
                            </div>
                          </div>

                          {/* Notes */}
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                              Notes
                            </label>
                            <input
                              type="text"
                              value={charge.notes}
                              onChange={(e) => handleUpdateCharge(charge.id, 'notes', e.target.value)}
                              placeholder="E.g., Express Dry Cleaning - Suit"
                              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            />
                          </div>
                        </div>

                        {/* Right Column: File Upload */}
                        <div className="lg:col-span-1">
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                            Receipt Attachment
                          </label>
                          <input
                            ref={(el) => { fileRefs.current[charge.id] = el }}
                            type="file"
                            onChange={(e) => handleFileSelect(charge.id, e.target.files?.[0] || null)}
                            className="hidden"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          />

                          {charge.file && charge.fileName ? (
                            // Uploaded state
                            <div className="h-full min-h-[140px] flex flex-col justify-center items-center border-2 border-dashed border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg p-4 text-center">
                              <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                                <span className="material-symbols-outlined text-lg">check</span>
                              </div>
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-full">
                                {charge.fileName}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-1">Uploaded successfully</p>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(charge.id)}
                                className="mt-2 text-[10px] text-red-500 hover:text-red-600 font-bold uppercase tracking-wider"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            // Upload state
                            <div
                              onDrop={(e) => {
                                e.preventDefault()
                                setDragOver(null)
                                handleFileSelect(charge.id, e.dataTransfer.files?.[0] || null)
                              }}
                              onDragOver={(e) => { e.preventDefault(); setDragOver(charge.id) }}
                              onDragLeave={() => setDragOver(null)}
                              onClick={() => fileRefs.current[charge.id]?.click()}
                              className={`h-full min-h-[140px] flex flex-col justify-center items-center border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                                dragOver === charge.id
                                  ? 'border-primary bg-blue-50 dark:bg-blue-900/20 scale-105'
                                  : 'border-primary/30 bg-primary/5 hover:bg-primary/10 dark:bg-slate-900 hover:border-primary'
                              }`}
                            >
                              <span className="material-symbols-outlined text-3xl text-primary mb-2">cloud_upload</span>
                              <p className="text-xs font-medium text-primary">Click to upload or drag receipt</p>
                              <p className="text-[10px] text-slate-400 mt-1">PDF, JPG, PNG (Max 5MB)</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveCharge(charge.id)}
                        className="mt-4 text-sm font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                        Remove Charge
                      </button>
                    </div>
                  ))
                )}

                {/* Add Another Charge Button */}
                {charges.length > 0 && (
                  <div
                    onClick={handleAddCharge}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all group"
                  >
                    <div className="flex items-center gap-2 text-slate-500 group-hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-2xl">add_circle</span>
                      <span className="font-bold">Add another charge</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* GST E-Invoice Section */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-1">
                  <span className="material-symbols-outlined text-2xl text-primary">verified</span>
                  <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">GST E-Invoice</h2>
                </div>
                <p className="text-sm text-text-sub-light dark:text-text-sub-dark ml-11">Upload the GST e-invoice for this booking</p>
              </div>

              <div className="p-6">
                <input
                  ref={gstRef}
                  type="file"
                  onChange={(e) => handleGstFileSelect(e.target.files?.[0] || null)}
                  className="hidden"
                  accept=".pdf,.xml,.json"
                />

                {gstInvoice.file && gstInvoice.fileName ? (
                  <div className="border-2 border-dashed border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg p-6 text-center">
                    <div className="size-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-3">
                      <span className="material-symbols-outlined text-xl">check</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                      {gstInvoice.fileName}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Uploaded successfully</p>
                    <button
                      type="button"
                      onClick={handleRemoveGst}
                      className="mt-3 text-xs text-red-500 hover:text-red-600 font-bold uppercase tracking-wider"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOver(null)
                      handleGstFileSelect(e.dataTransfer.files?.[0] || null)
                    }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver('gst') }}
                    onDragLeave={() => setDragOver(null)}
                    onClick={() => gstRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                      dragOver === 'gst'
                        ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                        : 'border-primary/30 bg-primary/5 hover:bg-primary/10 dark:bg-slate-900 hover:border-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-4xl text-primary block mb-3">document_scanner</span>
                    <p className="text-sm font-medium text-primary mb-1">Click to upload or drag GST e-invoice</p>
                    <p className="text-xs text-slate-400">PDF, XML, JSON (Max 10MB)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between py-4 border-t border-slate-200 dark:border-slate-700">
              <Link
                href="/hotel-finance/bookings"
                className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-text-main-light dark:text-text-main-dark hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back
              </Link>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-blue-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-primary/30"
              >
                <span>{isSubmitting ? 'Saving...' : 'Continue to Send'}</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
