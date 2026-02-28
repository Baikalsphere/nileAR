"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CorporateEmployeeStay,
  CorporateInvoice,
  corporateTokenStorage,
  fetchCorporateEmployeeStays,
  fetchCorporateInvoices
} from '@/lib/corporateAuth'

interface DepartmentSpend {
  label: string
  amount: number
}

interface TravelerSpend {
  employeeName: string
  employeeCode: string
  department: string
  stays: number
  totalSpend: number
}

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const formatInr = (amount: number, digits = 0) => amount.toLocaleString('en-IN', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
})

const formatDateRange = (start: Date, end: Date) => {
  const startText = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const endText = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startText} - ${endText}`
}

const getQuarterRange = (date = new Date()) => {
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3
  const start = new Date(date.getFullYear(), quarterStartMonth, 1)
  const end = new Date(date.getFullYear(), quarterStartMonth + 3, 0)
  return { start, end }
}

const getPreviousQuarterRange = (currentStart: Date) => {
  const previousQuarterEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0)
  const previousQuarterStart = new Date(previousQuarterEnd.getFullYear(), previousQuarterEnd.getMonth() - 2, 1)
  return { start: previousQuarterStart, end: previousQuarterEnd }
}

const percentDelta = (current: number, previous: number) => {
  if (previous <= 0) {
    return null
  }

  return ((current - previous) / previous) * 100
}

const getInitials = (fullName: string) => {
  const parts = fullName.split(' ').filter(Boolean)
  if (parts.length === 0) {
    return 'NA'
  }

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

const getDepartmentTone = (index: number) => {
  const tones = [
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
  ]

  return tones[index % tones.length]
}

export default function ReportsClient() {
  const router = useRouter()
  const [selectedPeriod, setSelectedPeriod] = useState('This Quarter')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<CorporateInvoice[]>([])
  const [stays, setStays] = useState<CorporateEmployeeStay[]>([])

  useEffect(() => {
    const token = corporateTokenStorage.get()
    if (!token) {
      router.replace('/corporate-portal/login')
      return
    }

    const loadReportData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [invoiceResponse, stayResponse] = await Promise.all([
          fetchCorporateInvoices(),
          fetchCorporateEmployeeStays()
        ])

        setInvoices(invoiceResponse.invoices)
        setStays(stayResponse.stays)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load report data'
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

    void loadReportData()
  }, [router])

  const quarter = useMemo(() => getQuarterRange(new Date()), [])
  const previousQuarter = useMemo(() => getPreviousQuarterRange(quarter.start), [quarter.start])

  const quarterStays = useMemo(() => stays.filter((stay) => {
    const checkIn = new Date(stay.checkInDate)
    return checkIn >= quarter.start && checkIn <= quarter.end
  }), [stays, quarter.end, quarter.start])

  const previousQuarterStays = useMemo(() => stays.filter((stay) => {
    const checkIn = new Date(stay.checkInDate)
    return checkIn >= previousQuarter.start && checkIn <= previousQuarter.end
  }), [stays, previousQuarter.end, previousQuarter.start])

  const quarterInvoices = useMemo(() => invoices.filter((invoice) => {
    const invoiceDate = new Date(invoice.invoiceDate)
    return invoiceDate >= quarter.start && invoiceDate <= quarter.end
  }), [invoices, quarter.end, quarter.start])

  const previousQuarterInvoices = useMemo(() => invoices.filter((invoice) => {
    const invoiceDate = new Date(invoice.invoiceDate)
    return invoiceDate >= previousQuarter.start && invoiceDate <= previousQuarter.end
  }), [invoices, previousQuarter.end, previousQuarter.start])

  const totalSpend = useMemo(() => quarterInvoices.reduce((sum, invoice) => sum + invoice.amount, 0), [quarterInvoices])
  const previousSpend = useMemo(() => previousQuarterInvoices.reduce((sum, invoice) => sum + invoice.amount, 0), [previousQuarterInvoices])
  const totalNights = useMemo(() => quarterStays.reduce((sum, stay) => sum + stay.nights, 0), [quarterStays])
  const previousNights = useMemo(() => previousQuarterStays.reduce((sum, stay) => sum + stay.nights, 0), [previousQuarterStays])
  const adr = totalNights > 0 ? totalSpend / totalNights : 0
  const previousAdr = previousNights > 0 ? previousSpend / previousNights : 0

  const spendDelta = percentDelta(totalSpend, previousSpend)
  const nightsDelta = percentDelta(totalNights, previousNights)
  const adrDelta = percentDelta(adr, previousAdr)

  const spendByDepartment = useMemo<DepartmentSpend[]>(() => {
    const byDepartment = new Map<string, number>()

    quarterStays.forEach((stay) => {
      const key = stay.department?.trim() || 'Unassigned'
      byDepartment.set(key, (byDepartment.get(key) ?? 0) + stay.totalAmount)
    })

    return [...byDepartment.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [quarterStays])

  const monthlyAdr = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const accumulator = new Map<number, { amount: number; nights: number }>()

    stays.forEach((stay) => {
      const date = new Date(stay.checkInDate)
      if (date.getFullYear() !== currentYear) {
        return
      }

      const month = date.getMonth()
      const current = accumulator.get(month) ?? { amount: 0, nights: 0 }
      accumulator.set(month, {
        amount: current.amount + stay.totalAmount,
        nights: current.nights + stay.nights
      })
    })

    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthData = accumulator.get(monthIndex)
      const monthAdr = monthData && monthData.nights > 0 ? monthData.amount / monthData.nights : 0

      return {
        month: monthLabels[monthIndex],
        adr: monthAdr
      }
    })
  }, [stays])

  const peakAdr = useMemo(() => Math.max(...monthlyAdr.map((item) => item.adr), 0), [monthlyAdr])

  const topTravelers = useMemo<TravelerSpend[]>(() => {
    const byTraveler = new Map<string, TravelerSpend>()

    quarterStays.forEach((stay) => {
      const key = `${stay.employeeCode}-${stay.employeeName}`
      const current = byTraveler.get(key)

      if (current) {
        current.stays += 1
        current.totalSpend += stay.totalAmount
        return
      }

      byTraveler.set(key, {
        employeeName: stay.employeeName,
        employeeCode: stay.employeeCode,
        department: stay.department?.trim() || 'Unassigned',
        stays: 1,
        totalSpend: stay.totalAmount
      })
    })

    return [...byTraveler.values()].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 6)
  }, [quarterStays])

  const quarterLabel = useMemo(() => formatDateRange(quarter.start, quarter.end), [quarter.end, quarter.start])
  const chartMax = spendByDepartment.length > 0 ? Math.max(...spendByDepartment.map((item) => item.amount), 0) : 0

  const formatDelta = (value: number | null) => {
    if (value === null) {
      return '—'
    }

    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const deltaTone = (value: number | null) => {
    if (value === null) {
      return 'text-slate-400'
    }

    return value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
  }

  return (
    <div className="flex-1 overflow-y-auto h-full relative">
      <div className="max-w-[1280px] mx-auto p-8 flex flex-col gap-8">
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Spend Analytics</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Overview of company travel expenses • {quarterLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200">
              <span className="material-symbols-outlined text-[20px]">calendar_today</span>
              <span>{selectedPeriod}</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-primary text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors">
              <span className="material-symbols-outlined text-[20px]">download</span>
              <span>Download Report</span>
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mr-2">Filter by:</span>
          <button className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-all shadow-sm">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Department</span>
            <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-primary">expand_more</span>
          </button>
          <button className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-all shadow-sm">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Time Period</span>
            <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-primary">expand_more</span>
          </button>
          <button className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-all shadow-sm">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Region</span>
            <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-primary">expand_more</span>
          </button>
          <button className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-all shadow-sm">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Hotel Chain</span>
            <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-primary">expand_more</span>
          </button>
          <button className="ml-auto text-sm font-medium text-primary hover:text-blue-700">Clear all</button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading report data...
          </div>
        )}

        {/* Stats KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Spend (YTD)</p>
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[20px]">trending_up</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">₹{formatInr(totalSpend)}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm font-bold ${deltaTone(spendDelta)}`}>{formatDelta(spendDelta)}</span>
              <span className="text-sm text-slate-400">vs previous quarter</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Nights Booked</p>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <span className="material-symbols-outlined text-primary text-[20px]">bed</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{formatInr(totalNights)}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm font-bold ${deltaTone(nightsDelta)}`}>{formatDelta(nightsDelta)}</span>
              <span className="text-sm text-slate-400">vs previous quarter</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Avg Daily Rate (ADR)</p>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-[20px]">price_check</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">₹{formatInr(adr, 2)}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm font-bold ${deltaTone(adrDelta)}`}>{formatDelta(adrDelta)}</span>
              <span className="text-sm text-slate-400">vs previous quarter</span>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spend by Department Chart */}
          <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Spend by Department</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Current Quarter Analysis ({quarterLabel})</p>
              </div>
              <button className="text-slate-400 hover:text-primary">
                <span className="material-symbols-outlined">more_horiz</span>
              </button>
            </div>
            <div className="flex-1 flex items-end justify-between gap-4 h-[250px] px-2">
              {/* Bar Items */}
              {spendByDepartment.map((item) => {
                const barHeight = chartMax > 0 ? `${Math.max(8, (item.amount / chartMax) * 100)}%` : '8%'
                return (
                <div key={item.label} className="flex flex-col items-center gap-2 flex-1 h-full group cursor-pointer">
                  <div className="w-full flex-1 bg-slate-100 dark:bg-slate-700 rounded-t-lg relative overflow-hidden flex items-end">
                    <div 
                      className="w-full bg-primary opacity-90 group-hover:opacity-100 transition-all duration-500 relative" 
                      style={{ height: barHeight }}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity">
                        ₹{formatInr(item.amount)}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">{item.label}</span>
                </div>
              )})}
              {spendByDepartment.length === 0 && (
                <div className="h-full w-full flex items-center justify-center text-sm text-slate-400">No department spend data</div>
              )}
            </div>
          </div>

          {/* ADR Trend Chart */}
          <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Average Daily Rate (ADR) Trends</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Jan - Dec {new Date().getFullYear()}</p>
              </div>
              <button className="text-slate-400 hover:text-primary">
                <span className="material-symbols-outlined">more_horiz</span>
              </button>
            </div>
            <div className="flex-1 flex flex-col justify-end relative h-[250px]">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="border-t border-dashed border-slate-200 dark:border-slate-700 w-full"></div>
                <div className="border-t border-dashed border-slate-200 dark:border-slate-700 w-full"></div>
                <div className="border-t border-dashed border-slate-200 dark:border-slate-700 w-full"></div>
                <div className="border-t border-dashed border-slate-200 dark:border-slate-700 w-full"></div>
                <div className="border-t border-slate-200 dark:border-slate-700 w-full"></div>
              </div>
              <div className="relative z-10 flex items-end justify-between gap-2 h-full">
                {monthlyAdr.map((point) => (
                  <div key={point.month} className="flex flex-col items-center gap-2 flex-1 h-full group">
                    <div className="w-full flex-1 bg-slate-100 dark:bg-slate-700 rounded-t-md flex items-end overflow-hidden">
                      <div
                        className="w-full bg-primary/85 group-hover:bg-primary transition-colors"
                        style={{ height: `${peakAdr > 0 ? Math.max(6, (point.adr / peakAdr) * 100) : 6}%` }}
                        title={`₹${formatInr(point.adr, 2)}`}
                      ></div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{point.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top Travelers Table */}
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-10">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Top Travelers</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Employees with highest travel spend this period</p>
            </div>
            <button className="text-sm font-medium text-primary hover:text-blue-700">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-16">Rank</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Stays</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {topTravelers.map((traveler, index) => (
                  <tr key={`${traveler.employeeCode}-${traveler.employeeName}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {getInitials(traveler.employeeName)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{traveler.employeeName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{traveler.employeeCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDepartmentTone(index)}`}>
                        {traveler.department}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-700 dark:text-slate-300">{traveler.stays}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-slate-900 dark:text-white">₹{formatInr(traveler.totalSpend)}</td>
                  </tr>
                ))}
                {!isLoading && topTravelers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No traveler spend data available for this quarter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
