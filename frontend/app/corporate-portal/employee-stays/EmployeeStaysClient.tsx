"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import Header from '@/app/components/Header'
import { CorporateEmployeeStay, corporateTokenStorage, fetchCorporateEmployeeStays } from '@/lib/corporateAuth'

interface Stay {
  id: string
  guestName: string
  employeeId: string
  department?: string
  property: string
  checkInDate: string
  checkOutDate: string
  nights: number
  totalAmount: number
  status: 'Pending Invoice' | 'Paid' | 'Invoiced'
  initials?: string
}

const getStatusColor = (status: Stay['status']) => {
  switch (status) {
    case 'Pending Invoice':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    case 'Paid':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'Invoiced':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300'
  }
}

export default function EmployeeStaysClient() {
  const router = useRouter()
  const [stays, setStays] = useState<Stay[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    const token = corporateTokenStorage.get()
    if (!token) {
      router.replace('/corporate-portal/login')
      return
    }

    const loadStays = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetchCorporateEmployeeStays()
        const mapped: Stay[] = response.stays.map((stay: CorporateEmployeeStay) => ({
          id: stay.id,
          guestName: stay.employeeName,
          employeeId: stay.employeeCode,
          department: stay.department ?? undefined,
          property: stay.propertyName,
          checkInDate: new Date(stay.checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          checkOutDate: new Date(stay.checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          nights: stay.nights,
          totalAmount: stay.totalAmount,
          status: stay.status === 'paid' ? 'Paid' : stay.status === 'invoiced' ? 'Invoiced' : 'Pending Invoice',
          initials: stay.employeeName.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join('')
        }))
        setStays(mapped)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load employee stays'
        setError(message)
        if (message.toLowerCase().includes('unauthorized')) {
          corporateTokenStorage.clear()
          router.replace('/corporate-portal/login')
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadStays()
  }, [router])

  const filteredStays = stays.filter(stay =>
    stay.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stay.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (stay.department ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(new Set(stays.map(s => s.id)))
    } else {
      setSelectedRows(new Set())
    }
  }

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedRows(newSelected)
  }

  const totalSpend = stays.reduce((sum, stay) => sum + stay.totalAmount, 0)
  const activeStays = stays.length
  const pendingInvoices = stays.filter(s => s.status === 'Pending Invoice').length

  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display overflow-hidden selection:bg-primary/20">
      {/* Sidebar */}
      <Sidebar title="Corporate Portal" logoIcon="business" />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Header */}
        <Header />

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
          <div className="max-w-[1400px] mx-auto flex flex-col gap-6">
            {/* Breadcrumbs */}
            <div className="flex flex-wrap gap-2 items-center">
              <Link href="/corporate-portal" className="text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-primary transition-colors">Home</Link>
              <span className="text-slate-400 dark:text-slate-500 text-sm font-medium">/</span>
              <span className="text-slate-900 dark:text-white text-sm font-medium">Employee Stays</span>
            </div>

            {/* Page Header & Action */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Employee Stay Records</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-base">Manage hotel checkouts, review costs, and process payments.</p>
              </div>
              <button className="flex items-center justify-center gap-2 bg-primary hover:bg-blue-700 text-white px-5 py-3 rounded-lg shadow-sm transition-all hover:shadow-md shrink-0">
                <span className="material-symbols-outlined text-[20px]">download</span>
                <span className="text-sm font-bold">Download All Supporting Bills</span>
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1 p-5 rounded-xl bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary bg-primary/10 p-1.5 rounded-full text-[20px]">attach_money</span>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">Total Spend YTD</p>
                </div>
                <p className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">${totalSpend.toFixed(2)}</p>
                <p className="text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  +12% vs last month
                </p>
              </div>
              <div className="flex flex-col gap-1 p-5 rounded-xl bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-purple-600 bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded-full text-[20px]">hotel</span>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">Active Stays</p>
                </div>
                <p className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">{activeStays}</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">Currently checked in</p>
              </div>
              <div className="flex flex-col gap-1 p-5 rounded-xl bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-orange-600 bg-orange-100 dark:bg-orange-900/30 p-1.5 rounded-full text-[20px]">pending_actions</span>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">Pending Invoices</p>
                </div>
                <p className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">{pendingInvoices}</p>
                <p className="text-orange-600 dark:text-orange-400 text-xs font-medium mt-1">Needs attention</p>
              </div>
            </div>

            {/* Main Table Container */}
            <div className="flex flex-col bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden mb-10">
              {/* Toolbar */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                {/* Search */}
                <div className="w-full lg:w-96">
                  <label className="flex items-center w-full h-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-transparent focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden transition-all">
                    <div className="pl-3 pr-2 text-slate-500 dark:text-slate-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">search</span>
                    </div>
                    <input
                      className="w-full bg-transparent border-none text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-0 h-full p-0"
                      placeholder="Search employee, ID, or cost center..."
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </label>
                </div>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                  <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">calendar_today</span>
                    Date Range
                    <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">arrow_drop_down</span>
                  </button>
                  <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">apartment</span>
                    Property
                    <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">arrow_drop_down</span>
                  </button>
                  <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">filter_list</span>
                    Status
                    <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">arrow_drop_down</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-4 w-12">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-600"
                          onChange={handleSelectAll}
                          checked={selectedRows.size === stays.length && stays.length > 0}
                        />
                      </th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Guest Name</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">ID / Department</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Property</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Dates</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 text-center">Nights</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 text-right">Total Amount</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Status</th>
                      <th className="p-4 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {isLoading ? (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading employee stays...</td>
                      </tr>
                    ) : filteredStays.map((stay) => (
                      <tr key={stay.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-600"
                            checked={selectedRows.has(stay.id)}
                            onChange={() => handleSelectRow(stay.id)}
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                              {stay.initials}
                            </div>
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{stay.guestName}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 dark:text-slate-300">{stay.employeeId}</span>
                            <span className="text-xs">{stay.department ?? '—'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm font-medium text-primary hover:underline cursor-pointer">{stay.property}</td>
                        <td className="p-4 text-sm text-slate-900 dark:text-slate-300">
                          {stay.checkInDate} - {stay.checkOutDate}, 2023
                        </td>
                        <td className="p-4 text-sm text-center text-slate-900 dark:text-slate-300">{stay.nights}</td>
                        <td className="p-4 text-sm font-bold text-right text-slate-900 dark:text-slate-200">${stay.totalAmount.toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(stay.status)}`}>
                            {stay.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button className="text-slate-500 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <span className="material-symbols-outlined text-[20px]">more_vert</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Showing <span className="font-bold text-slate-900 dark:text-white">1</span> to{' '}
                  <span className="font-bold text-slate-900 dark:text-white">{filteredStays.length}</span> of{' '}
                  <span className="font-bold text-slate-900 dark:text-white">{stays.length}</span> records
                </p>
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-medium">1</button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium transition-colors">2</button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium transition-colors">3</button>
                  <span className="text-slate-600 dark:text-slate-400 px-1">...</span>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium transition-colors">6</button>
                  <button className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
