"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import { useState } from 'react'

interface RoomCharge {
  id: string
  date: string
  description: string
  rate: number
  tax: number
  total: number
}

interface IncidentalCharge {
  id: string
  serviceType: string
  date: string
  amount: number
  notes: string
  receiptFile?: string
  receiptFileName?: string
}

interface CheckoutData {
  bookingId: string
  customerName: string
  corporationName: string
  roomNumber: string
  roomType: string
  checkInDate: string
  checkOutDate: string
  nights: number
  roomCharges: RoomCharge[]
  incidentalCharges: IncidentalCharge[]
}

const mockCheckoutData: CheckoutData = {
  bookingId: 'BK-003',
  customerName: 'Sarah Jenkins',
  corporationName: 'Oracle Corp',
  roomNumber: '402',
  roomType: 'King Suite',
  checkInDate: '2024-02-12',
  checkOutDate: '2024-02-15',
  nights: 3,
  roomCharges: [
    {
      id: '1',
      date: 'Feb 12',
      description: 'Standard King Room',
      rate: 150,
      tax: 15,
      total: 165,
    },
    {
      id: '2',
      date: 'Feb 13',
      description: 'Standard King Room',
      rate: 150,
      tax: 15,
      total: 165,
    },
    {
      id: '3',
      date: 'Feb 14',
      description: 'Standard King Room',
      rate: 150,
      tax: 15,
      total: 165,
    },
  ],
  incidentalCharges: [
    {
      id: '1',
      serviceType: 'Laundry Service',
      date: '2024-02-14',
      amount: 45,
      notes: 'Express Dry Cleaning - Suit',
      receiptFileName: 'laundry_slip_01.jpg',
      receiptFile: 'uploaded',
    },
    {
      id: '2',
      serviceType: 'Transport',
      date: '2024-02-15',
      amount: 25,
      notes: 'Airport Transfer - Taxi',
      receiptFile: undefined,
    },
  ],
}

const formatInrAmount = (value: number) => value.toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export default function CheckoutClient({ bookingId }: { bookingId: string }) {
  const [data] = useState<CheckoutData>(mockCheckoutData)
  const [incidentals, setIncidentals] = useState<IncidentalCharge[]>(data.incidentalCharges)
  const [showAddCharge, setShowAddCharge] = useState(false)
  const [newCharge, setNewCharge] = useState({
    serviceType: 'Laundry Service',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    notes: '',
  })

  const roomChargesSubtotal = data.roomCharges.reduce((sum, charge) => sum + charge.total, 0)
  const incidentalsSubtotal = incidentals.reduce((sum, charge) => sum + charge.amount, 0)
  const totalBeforeTax = roomChargesSubtotal + incidentalsSubtotal
  const taxAmount = Math.round(totalBeforeTax * 0.1 * 100) / 100
  const totalDue = totalBeforeTax + taxAmount

  const handleAddCharge = () => {
    if (newCharge.amount && newCharge.serviceType) {
      setIncidentals([
        ...incidentals,
        {
          id: Date.now().toString(),
          serviceType: newCharge.serviceType,
          date: newCharge.date,
          amount: parseFloat(newCharge.amount),
          notes: newCharge.notes,
        },
      ])
      setNewCharge({
        serviceType: 'Laundry Service',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        notes: '',
      })
      setShowAddCharge(false)
    }
  }

  const handleRemoveCharge = (id: string) => {
    setIncidentals(incidentals.filter(charge => charge.id !== id))
  }

  const handleFileUpload = (id: string, fileName: string) => {
    setIncidentals(
      incidentals.map(charge =>
        charge.id === id
          ? { ...charge, receiptFile: 'uploaded', receiptFileName: fileName }
          : charge
      )
    )
  }

  const handleRemoveFile = (id: string) => {
    setIncidentals(
      incidentals.map(charge =>
        charge.id === id
          ? { ...charge, receiptFile: undefined, receiptFileName: undefined }
          : charge
      )
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark transition-colors duration-200">
      <Sidebar title="Hotel Finance" logoIcon="domain" />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark relative">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="mx-auto max-w-7xl flex flex-col gap-6">
            {/* Page Header */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-extrabold tracking-tight text-text-main-light dark:text-text-main-dark">
                      Checkout: {data.customerName}
                    </h1>
                    <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                      Pending Checkout
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-text-sub-light dark:text-text-sub-dark text-sm font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-lg">business</span>
                      {data.corporationName}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-lg">meeting_room</span>
                      Room {data.roomNumber} ({data.roomType})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-lg">calendar_month</span>
                      {new Date(data.checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(data.checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ({data.nights} Nights)
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main-light dark:text-text-main-dark text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <span className="material-symbols-outlined text-lg">print</span>
                    Print Folio
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main-light dark:text-text-main-dark text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <span className="material-symbols-outlined text-lg">mail</span>
                    Email Invoice
                  </button>
                </div>
              </div>
            </div>

            {/* Split Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Charges */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                {/* Room Charges Section */}
                <section className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <h2 className="text-text-main-light dark:text-text-main-dark text-lg font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">bed</span>
                      Room Charges
                    </h2>
                    <span className="text-sm text-text-sub-light dark:text-text-sub-dark font-medium">Auto-posted nightly</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/2">Description</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Rate</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Tax</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.roomCharges.map((charge) => (
                          <tr key={charge.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 text-sm text-text-sub-light dark:text-text-sub-dark">{charge.date}</td>
                            <td className="px-6 py-4 text-sm text-text-main-light dark:text-text-main-dark font-medium">{charge.description}</td>
                            <td className="px-6 py-4 text-sm text-text-sub-light dark:text-text-sub-dark text-right font-mono">₹{formatInrAmount(charge.rate)}</td>
                            <td className="px-6 py-4 text-sm text-text-sub-light dark:text-text-sub-dark text-right font-mono">₹{formatInrAmount(charge.tax)}</td>
                            <td className="px-6 py-4 text-sm text-text-main-light dark:text-text-main-dark font-bold text-right font-mono">₹{formatInrAmount(charge.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                        <tr>
                          <td colSpan={4} className="px-6 py-3 text-sm font-bold text-text-main-light dark:text-text-main-dark text-right uppercase">
                            Subtotal Room Charges
                          </td>
                          <td className="px-6 py-3 text-sm font-bold text-primary text-right font-mono">₹{formatInrAmount(roomChargesSubtotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                {/* Incidentals & Uploads */}
                <section className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <h2 className="text-text-main-light dark:text-text-main-dark text-lg font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">receipt_long</span>
                      Incidental Charges & Uploads
                    </h2>
                    <button onClick={() => setShowAddCharge(true)} className="text-primary text-sm font-bold flex items-center gap-1 hover:underline">
                      <span className="material-symbols-outlined text-lg">add</span>
                      Add Charge
                    </button>
                  </div>

                  <div className="p-6 flex flex-col gap-6">
                    {/* Existing Charges */}
                    {incidentals.map((charge) => (
                      <div key={charge.id} className="group border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800 hover:border-primary/40 dark:hover:border-primary/40 transition-colors shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                          {/* Form Fields */}
                          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Service Type</label>
                              <select className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary" value={charge.serviceType} disabled>
                                <option>{charge.serviceType}</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Date</label>
                              <input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary" type="date" value={charge.date} disabled />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Amount (₹)</label>
                              <input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-main-light dark:text-text-main-dark font-mono focus:ring-2 focus:ring-primary" type="number" value={charge.amount.toFixed(2)} disabled />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Notes</label>
                              <input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary" type="text" value={charge.notes} disabled />
                            </div>
                          </div>

                          {/* File Upload Area */}
                          <div className="md:col-span-4 h-full">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Receipt Attachment</label>
                            {charge.receiptFile ? (
                              <div className="h-full min-h-[140px] flex flex-col justify-center items-center border-2 border-green-500/50 bg-green-50/50 dark:bg-green-900/10 rounded-lg p-3 text-center transition-colors">
                                <div className="size-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400 mb-2">
                                  <span className="material-symbols-outlined text-lg">check</span>
                                </div>
                                <p className="text-xs font-medium text-text-main-light dark:text-text-main-dark">{charge.receiptFileName}</p>
                                <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">Uploaded successfully</p>
                                <button onClick={() => handleRemoveFile(charge.id)} className="mt-2 text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-bold uppercase tracking-wider">
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <label className="h-full min-h-[140px] flex flex-col justify-center items-center border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 dark:bg-slate-900 hover:border-primary rounded-lg p-3 text-center transition-all cursor-pointer group/upload">
                                <span className="material-symbols-outlined text-3xl text-primary mb-2 group-hover/upload:scale-110 transition-transform">cloud_upload</span>
                                <p className="text-xs font-medium text-primary">Click to upload or drag receipt</p>
                                <p className="text-[10px] text-slate-400 mt-1">PDF, JPG, PNG (Max 5MB)</p>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      handleFileUpload(charge.id, e.target.files[0].name)
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleRemoveCharge(charge.id)}
                          className="mt-4 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-bold uppercase tracking-wider"
                        >
                          Remove Charge
                        </button>
                      </div>
                    ))}

                    {/* Add New Charge Form */}
                    {showAddCharge && (
                      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Service Type</label>
                              <select
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary"
                                value={newCharge.serviceType}
                                onChange={(e) => setNewCharge({ ...newCharge, serviceType: e.target.value })}
                              >
                                <option>Laundry Service</option>
                                <option>Food & Beverage</option>
                                <option>Mini Bar</option>
                                <option>Transport</option>
                                <option>Other</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Date</label>
                              <input
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary"
                                type="date"
                                value={newCharge.date}
                                onChange={(e) => setNewCharge({ ...newCharge, date: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Amount (₹)</label>
                              <input
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-main-light dark:text-text-main-dark font-mono focus:ring-2 focus:ring-primary"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={newCharge.amount}
                                onChange={(e) => setNewCharge({ ...newCharge, amount: e.target.value })}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Notes</label>
                              <input
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary"
                                type="text"
                                placeholder="Enter notes"
                                value={newCharge.notes}
                                onChange={(e) => setNewCharge({ ...newCharge, notes: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={handleAddCharge}
                            className="px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors"
                          >
                            Add Charge
                          </button>
                          <button
                            onClick={() => setShowAddCharge(false)}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-text-main-light dark:text-text-main-dark rounded-lg text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Add Another Charge Button */}
                    {!showAddCharge && (
                      <div className="group border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-white dark:hover:bg-slate-800 transition-all min-h-[100px]">
                        <button
                          onClick={() => setShowAddCharge(true)}
                          className="flex items-center gap-2 text-slate-500 group-hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined">add_circle</span>
                          <span className="font-bold text-sm">Add another charge</span>
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Right Column: Bill Summary */}
              <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
                {/* Financial Summary Card */}
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="p-6 bg-primary text-white">
                    <h3 className="text-lg font-bold mb-1">Bill Summary</h3>
                    <p className="text-white/80 text-sm">Review final charges before invoicing.</p>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center text-text-sub-light dark:text-text-sub-dark text-sm">
                      <span>Room Charges ({data.nights} nights)</span>
                      <span className="font-mono font-medium">₹{formatInrAmount(roomChargesSubtotal)}</span>
                    </div>
                    {incidentalsSubtotal > 0 && (
                      <div className="flex justify-between items-center text-text-sub-light dark:text-text-sub-dark text-sm">
                        <span>Incidentals</span>
                        <span className="font-mono font-medium">₹{formatInrAmount(incidentalsSubtotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-text-sub-light dark:text-text-sub-dark text-sm pb-4 border-b border-slate-200 dark:border-slate-700">
                      <span>Taxes & Fees (10%)</span>
                      <span className="font-mono font-medium">₹{formatInrAmount(taxAmount)}</span>
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-end pt-2">
                      <div className="flex flex-col">
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">Total Due</span>
                        <span className="text-slate-400 text-xs">(INR)</span>
                      </div>
                      <span className="text-3xl font-extrabold text-text-main-light dark:text-text-main-dark font-mono tracking-tight">₹{formatInrAmount(totalDue)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                    <button className="w-full bg-primary hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group">
                      <span>Submit for Invoicing</span>
                      <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                    <button className="w-full bg-surface-light dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-text-main-light dark:text-text-main-dark font-bold py-2.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors">
                      Save Draft
                    </button>
                  </div>
                </div>

                {/* Policy Reminder */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary mt-0.5">info</span>
                    <div>
                      <h4 className="text-sm font-bold text-text-main-light dark:text-text-main-dark mb-1">Policy Reminder</h4>
                      <p className="text-xs text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        Corporate guests from <span className="font-bold">{data.corporationName}</span> require receipts for all incidental charges over ₹25.00. Please ensure files are attached.
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
