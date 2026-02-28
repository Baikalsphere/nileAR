"use client"

import { useState, useRef } from 'react'

interface DocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: DocumentUploadData) => void
  bookingInfo?: {
    customerName: string
    corporationName: string
    roomType: string
  }
}

export interface DocumentUploadData {
  serviceType: string
  date: string
  amount: string
  notes: string
  file: File | null
  fileName?: string
}

const SERVICE_TYPES = [
  'Room Charges',
  'Food & Beverage',
  'Bar & Lounge',
  'Room Service',
  'Laundry & Dry Cleaning',
  'Spa & Wellness',
  'Minibar',
  'Conference & Banquet',
  'Parking & Valet',
  'Phone & Communication',
  'Transportation',
  'Miscellaneous',
]

export default function DocumentUploadModal({
  isOpen,
  onClose,
  onSubmit,
  bookingInfo,
}: DocumentUploadModalProps) {
  const [formData, setFormData] = useState<DocumentUploadData>({
    serviceType: 'Room Charges',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    notes: '',
    file: null,
    fileName: undefined,
  })
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileSelect = (file: File | null) => {
    if (!file) return
    setFormData(prev => ({
      ...prev,
      file,
      fileName: file.name,
    }))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleRemoveFile = () => {
    setFormData(prev => ({
      ...prev,
      file: null,
      fileName: undefined,
    }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.serviceType || !formData.date || !formData.amount) {
      alert('Please fill in all required fields')
      return
    }
    onSubmit(formData)
    setFormData({
      serviceType: 'Room Charges',
      date: new Date().toISOString().split('T')[0],
      amount: '',
      notes: '',
      file: null,
      fileName: undefined,
    })
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold">Add Incidental Charge</h2>
            {bookingInfo && (
              <p className="text-blue-100 text-sm mt-1">
                {bookingInfo.customerName} • {bookingInfo.roomType}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column: Form Fields */}
            <div className="lg:col-span-2 space-y-4">
              {/* Service Type */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Service Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.serviceType}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, serviceType: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
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
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, date: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, amount: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="E.g., Express Dry Cleaning - Suit, Airport Transfer - Taxi"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Right Column: File Upload */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Receipt Attachment
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              />

              {formData.file && formData.fileName ? (
                // Uploaded state
                <div className="h-full min-h-[140px] flex flex-col justify-center items-center border-2 border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg p-4 text-center">
                  <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                    <span className="material-symbols-outlined text-lg">check</span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-full">
                    {formData.fileName}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {formatFileSize(formData.file.size)}
                  </p>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="mt-2 text-[10px] text-red-500 hover:text-red-600 font-bold uppercase tracking-wider transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                // Upload state
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`h-full min-h-[140px] flex flex-col justify-center items-center border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 scale-105'
                      : 'border-primary/30 bg-primary/5 hover:bg-primary/10 dark:bg-slate-900 hover:border-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-3xl text-primary mb-2">
                    cloud_upload
                  </span>
                  <p className="text-xs font-medium text-primary">
                    Click to upload or drag & drop
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    PDF, JPG, PNG (Max 5MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 border-t border-slate-200 dark:border-slate-700 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-primary/30 flex items-center justify-center gap-2"
            >
              <span>Add Charge</span>
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>

          {/* Helper Text */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl flex-shrink-0">
                info
              </span>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-white mb-1">Corporate Policy</p>
                <p>
                  Receipts are required for all incidental charges over ₹25.00. Ensure files are attached and clearly labeled.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
