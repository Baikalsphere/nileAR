"use client"

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import { useState } from 'react'

interface LineItem {
  id: string
  description: string
  amount: number
  disputable: boolean
}

interface InvoiceData {
  invoiceNumber: string
  hotelName: string
  stayDates: string
  guestName: string
  status: string
  lineItems: LineItem[]
}

const invoicesForCheckout: InvoiceData[] = [
  {
    invoiceNumber: '#INV-10234',
    hotelName: 'Hilton Garden Inn',
    stayDates: 'Oct 12-14, 2023',
    guestName: 'John Doe',
    status: 'Approved',
    lineItems: [
      { id: '1', description: 'Room Charges (2 Nights)', amount: 400.00, disputable: true },
      { id: '2', description: 'Room Service (Dinner)', amount: 45.00, disputable: true },
      { id: '3', description: 'City Tax & Fees', amount: 32.50, disputable: false },
    ],
  },
  {
    invoiceNumber: '#INV-10255',
    hotelName: 'Marriott Downtown',
    stayDates: 'Oct 15, 2023',
    guestName: 'Sarah Smith',
    status: 'Approved',
    lineItems: [
      { id: '1', description: 'Room Charges (1 Night)', amount: 250.00, disputable: true },
      { id: '2', description: 'Minibar', amount: 38.00, disputable: true },
      { id: '3', description: 'Taxes & Fees', amount: 32.00, disputable: false },
    ],
  },
]

type PaymentMethod = 'card' | 'bank' | 'credit'

const formatInrAmount = (value: number) => value.toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export default function CheckoutClient() {
  const params = useParams()
  const router = useRouter()
  const invoiceId = params.invoiceId as string

  const [expandedInvoice, setExpandedInvoice] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [routingNumber, setRoutingNumber] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const subtotal = invoicesForCheckout.reduce(
    (sum, inv) => sum + inv.lineItems.reduce((s, item) => s + item.amount, 0),
    0
  )
  const taxesAndFees = 52.50
  const totalAmount = subtotal + taxesAndFees

  const handlePayment = () => {
    setIsProcessing(true)
    setTimeout(() => {
      setIsProcessing(false)
      setPaymentSuccess(true)
    }, 2000)
  }

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = (matches && matches[0]) || ''
    const parts = []
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    return parts.length ? parts.join(' ') : v
  }

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    if (v.length >= 2) {
      return v.substring(0, 2) + ' / ' + v.substring(2, 4)
    }
    return v
  }

  if (paymentSuccess) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
        <Sidebar title="TravelCorp" logoIcon="apartment" />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <Header />
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="bg-white dark:bg-[#161f2c] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-12 max-w-lg w-full text-center flex flex-col items-center gap-6">
              <div className="size-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Payment Successful</h1>
              <p className="text-slate-500 dark:text-slate-400 text-lg">
                Your payment of <span className="font-bold text-slate-900 dark:text-white">₹{formatInrAmount(totalAmount)}</span> has been processed successfully.
              </p>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 w-full text-left flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Transaction ID</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">TXN-{Date.now().toString(36).toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Payment Method</span>
                  <span className="font-medium text-slate-900 dark:text-white capitalize">{paymentMethod}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Invoices Paid</span>
                  <span className="font-medium text-slate-900 dark:text-white">{invoicesForCheckout.length}</span>
                </div>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => router.push('/corporate-portal/invoices')}
                  className="flex-1 px-6 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Back to Invoices
                </button>
                <button className="flex-1 px-6 py-3 rounded-lg bg-primary text-white font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">download</span>
                  Download Receipt
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar title="TravelCorp" logoIcon="apartment" />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto scroll-smooth">
          {/* Breadcrumbs & Header */}
          <div className="shrink-0 px-6 pt-6 pb-6 bg-white dark:bg-[#161f2c] border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-wrap gap-2 mb-4 items-center">
                <Link className="text-primary hover:text-blue-700 text-sm font-medium transition-colors" href="/corporate-portal/invoices">
                  Invoices
                </Link>
                <span className="text-slate-400 text-sm material-symbols-outlined text-[16px]">chevron_right</span>
                <Link className="text-primary hover:text-blue-700 text-sm font-medium transition-colors" href={`/corporate-portal/invoices/${invoiceId}`}>
                  #{invoiceId}
                </Link>
                <span className="text-slate-400 text-sm material-symbols-outlined text-[16px]">chevron_right</span>
                <span className="text-primary font-bold text-sm">Secure Checkout</span>
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Secure Checkout</h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg">Review your selected invoices and process payment securely.</p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 md:p-8 lg:p-12">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                {/* LEFT COLUMN: Invoice Summary */}
                <div className="xl:col-span-2 flex flex-col gap-6">
                  {/* Section Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">receipt_long</span>
                      Invoice Summary ({invoicesForCheckout.length})
                    </h2>
                    <Link
                      href={`/corporate-portal/invoices/${invoiceId}`}
                      className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Edit Selection
                    </Link>
                  </div>

                  {/* Invoice Cards */}
                  {invoicesForCheckout.map((invoice, index) => (
                    <div
                      key={index}
                      className={`bg-white dark:bg-[#161f2c] rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden transition-colors ${
                        expandedInvoice === index
                          ? 'border-primary/30'
                          : 'border-slate-200 hover:border-primary/50 cursor-pointer'
                      }`}
                    >
                      {/* Invoice Header */}
                      <div
                        className={`px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-4 ${
                          expandedInvoice === index ? 'bg-slate-50 dark:bg-slate-800/50' : ''
                        }`}
                        onClick={() => setExpandedInvoice(expandedInvoice === index ? -1 : index)}
                      >
                        <div className="flex items-center gap-4">
                          {expandedInvoice !== index && (
                            <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500 group-hover:text-primary transition-colors">
                              <span className="material-symbols-outlined">expand_more</span>
                            </div>
                          )}
                          <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                              <h3 className="font-bold text-lg text-slate-900 dark:text-white">{invoice.invoiceNumber}</h3>
                              <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs font-bold px-2 py-1 rounded">
                                {invoice.status}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {invoice.hotelName} • {invoice.stayDates}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {expandedInvoice === index ? (
                            <>
                              <p className="text-sm text-slate-500 dark:text-slate-400">Guest</p>
                              <p className="font-medium text-slate-900 dark:text-white">{invoice.guestName}</p>
                            </>
                          ) : (
                            <p className="font-bold text-lg text-slate-900 dark:text-white">
                              ₹{formatInrAmount(invoice.lineItems.reduce((s, i) => s + i.amount, 0))}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Expanded Line Items */}
                      {expandedInvoice === index && (
                        <div className="p-6">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                <th className="pb-3 font-medium">Description</th>
                                <th className="pb-3 font-medium text-right">Amount</th>
                                <th className="pb-3 font-medium text-right w-24">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {invoice.lineItems.map((item) => (
                                <tr key={item.id}>
                                  <td className="py-4 text-slate-900 dark:text-slate-200">{item.description}</td>
                                  <td className="py-4 text-right font-medium text-slate-900 dark:text-white">
                                    ₹{formatInrAmount(item.amount)}
                                  </td>
                                  <td className="py-4 text-right">
                                    {item.disputable ? (
                                      <button className="text-xs font-semibold text-rose-500 hover:text-rose-700 hover:underline flex items-center justify-end gap-1 w-full">
                                        Dispute
                                      </button>
                                    ) : (
                                      <span className="opacity-50 cursor-not-allowed text-xs text-slate-400">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td className="pt-4 font-bold text-slate-900 dark:text-white">Invoice Total</td>
                                <td className="pt-4 text-right font-bold text-lg text-slate-900 dark:text-white">
                                  ₹{formatInrAmount(invoice.lineItems.reduce((s, i) => s + i.amount, 0))}
                                </td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <button className="text-primary text-sm font-semibold hover:underline flex items-center gap-1">
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                              View Original PDF
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* RIGHT COLUMN: Payment Execution */}
                <div className="xl:col-span-1 flex flex-col gap-6 xl:sticky xl:top-6">
                  {/* Payment Method Selector */}
                  <div className="bg-white dark:bg-[#161f2c] rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">Payment Details</h3>
                    </div>

                    {/* Payment Tabs */}
                    <div className="grid grid-cols-3 p-2 gap-1 bg-slate-50 dark:bg-slate-900/50">
                      <button
                        onClick={() => setPaymentMethod('card')}
                        className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg transition-all ${
                          paymentMethod === 'card'
                            ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-primary'
                            : 'hover:bg-white/50 dark:hover:bg-slate-800/50 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: paymentMethod === 'card' ? "'FILL' 1" : "'FILL' 0" }}>credit_card</span>
                        <span className={`text-xs ${paymentMethod === 'card' ? 'font-bold' : 'font-medium'}`}>Card</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('bank')}
                        className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg transition-all ${
                          paymentMethod === 'bank'
                            ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-primary'
                            : 'hover:bg-white/50 dark:hover:bg-slate-800/50 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined">account_balance</span>
                        <span className={`text-xs ${paymentMethod === 'bank' ? 'font-bold' : 'font-medium'}`}>Bank</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('credit')}
                        className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg transition-all ${
                          paymentMethod === 'credit'
                            ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-primary'
                            : 'hover:bg-white/50 dark:hover:bg-slate-800/50 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined">request_quote</span>
                        <span className={`text-xs ${paymentMethod === 'credit' ? 'font-bold' : 'font-medium'}`}>Credit</span>
                      </button>
                    </div>

                    {/* Form Content */}
                    <div className="p-6 flex flex-col gap-5">
                      {/* Card Payment Form */}
                      {paymentMethod === 'card' && (
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Card Number</label>
                            <div className="relative">
                              <input
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 pl-11 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                                placeholder="0000 0000 0000 0000"
                                type="text"
                                value={cardNumber}
                                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                                maxLength={19}
                              />
                              <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400">credit_card</span>
                              <div className="absolute right-3 top-3 flex gap-1">
                                <div className="w-8 h-5 bg-gradient-to-r from-orange-400 to-red-500 rounded text-[8px] text-white flex items-center justify-center font-bold italic">MC</div>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Expiry</label>
                              <input
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                                placeholder="MM / YY"
                                type="text"
                                value={expiry}
                                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                                maxLength={7}
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">CVV</label>
                              <div className="relative">
                                <input
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                                  placeholder="123"
                                  type="text"
                                  value={cvv}
                                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                  maxLength={4}
                                />
                                <span className="material-symbols-outlined absolute right-3 top-3 text-slate-400 text-lg cursor-help">help</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cardholder Name</label>
                            <input
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                              placeholder="Name on card"
                              type="text"
                              value={cardholderName}
                              onChange={(e) => setCardholderName(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Bank Transfer Form */}
                      {paymentMethod === 'bank' && (
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Account Number</label>
                            <div className="relative">
                              <input
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 pl-11 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                                placeholder="Enter account number"
                                type="text"
                                value={bankAccount}
                                onChange={(e) => setBankAccount(e.target.value)}
                              />
                              <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400">account_balance</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Routing Number</label>
                            <input
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                              placeholder="Enter routing number"
                              type="text"
                              value={routingNumber}
                              onChange={(e) => setRoutingNumber(e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Account Holder Name</label>
                            <input
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                              placeholder="Name on account"
                              type="text"
                              value={cardholderName}
                              onChange={(e) => setCardholderName(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Credit Line Form */}
                      {paymentMethod === 'credit' && (
                        <div className="flex flex-col gap-4">
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                            <div className="flex items-start gap-3">
                              <span className="material-symbols-outlined text-primary">info</span>
                              <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Corporate Credit Line</p>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                  Payment will be charged to your corporate credit line. Available credit: <span className="font-bold text-green-600">₹24,500.00</span>
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Authorization Code</label>
                            <input
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                              placeholder="Enter authorization code"
                              type="text"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cost Center</label>
                            <select className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow appearance-none">
                              <option>CC-1001 — Travel & Expenses</option>
                              <option>CC-2004 — Client Entertainment</option>
                              <option>CC-3021 — Operations</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Divider */}
                      <div className="h-px bg-slate-100 dark:bg-slate-700 w-full"></div>

                      {/* Order Summary */}
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                          <span>Subtotal ({invoicesForCheckout.length} Invoices)</span>
                          <span>₹{formatInrAmount(subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                          <span>Taxes & Fees</span>
                          <span>₹{formatInrAmount(taxesAndFees)}</span>
                        </div>
                        <div className="flex justify-between items-end mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-500">Total to Pay</span>
                            <span className="text-xs text-primary cursor-pointer hover:underline">View Breakdown</span>
                          </div>
                          <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            ₹{formatInrAmount(totalAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={handlePayment}
                        disabled={isProcessing}
                        className="w-full bg-primary hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 px-6 rounded-lg shadow-lg shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
                      >
                        {isProcessing ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined group-hover:hidden">lock</span>
                            <span className="material-symbols-outlined hidden group-hover:block">lock_open</span>
                            Pay ₹{formatInrAmount(totalAmount)}
                          </>
                        )}
                      </button>

                      {/* Trust Badges */}
                      <div className="flex justify-center items-center gap-4 opacity-60 grayscale hover:grayscale-0 transition-all">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 border border-slate-300 rounded px-1.5 py-0.5">
                          <span className="material-symbols-outlined text-[14px]">security</span>
                          PCI DSS
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 border border-slate-300 rounded px-1.5 py-0.5">
                          <span className="material-symbols-outlined text-[14px]">encrypted</span>
                          256-BIT SSL
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Help Widget */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 flex items-start gap-3 border border-blue-100 dark:border-blue-800">
                    <span className="material-symbols-outlined text-primary">support_agent</span>
                    <div className="flex flex-col gap-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Need help with this payment?</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Contact our corporate support team at{' '}
                        <a className="text-primary hover:underline" href="mailto:billing@travelcorp.com">billing@travelcorp.com</a>{' '}
                        or call +1-800-555-0123.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 py-8 text-center text-sm text-slate-500">
            <p>© 2024 TravelCorp Corporate Portal. All rights reserved.</p>
            <div className="flex justify-center gap-4 mt-2">
              <a className="hover:text-primary transition-colors" href="#">Privacy Policy</a>
              <a className="hover:text-primary transition-colors" href="#">Terms of Service</a>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}
