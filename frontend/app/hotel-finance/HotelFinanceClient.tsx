"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import { fetchHotelProfile, tokenStorage } from '@/lib/auth'
import { fetchHotelFinanceDashboardSummary, HotelFinanceDashboardResponse } from '@/lib/bookingsApi'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HotelFinanceClient() {
  const router = useRouter()
  const [dashboardData, setDashboardData] = useState<HotelFinanceDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hotelName, setHotelName] = useState<string>('Hotel Finance')
  const [hotelLogoUrl, setHotelLogoUrl] = useState<string | null>(null)
  const [isHotelLogoFailed, setIsHotelLogoFailed] = useState(false)

  useEffect(() => {
    const token = tokenStorage.get()
    if (!token) {
      router.replace('/hotel-finance/login')
      return
    }

    const loadDashboard = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [dashboardResponse, profileResponse] = await Promise.all([
          fetchHotelFinanceDashboardSummary(),
          fetchHotelProfile()
        ])

        setDashboardData(dashboardResponse)
        setHotelName(profileResponse.profile.hotelName || 'Hotel Finance')
        setHotelLogoUrl(profileResponse.profile.logoUrl)
        setIsHotelLogoFailed(false)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load dashboard'
        setError(message)
        if (message.toLowerCase().includes('unauthorized')) {
          tokenStorage.clear()
          router.replace('/hotel-finance/login')
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadDashboard()
  }, [router])

  const formatCurrency = (amount: number) =>
    `₹${Math.round(amount).toLocaleString('en-IN')}`

  const summary = dashboardData?.summary ?? {
    totalInvoicedMtd: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    overdueInvoices: 0
  }

  const invoiceVsCollection = dashboardData?.invoiceVsCollection ?? [
    { label: 'Week 1', invoiced: 0, collected: 0 },
    { label: 'Week 2', invoiced: 0, collected: 0 },
    { label: 'Week 3', invoiced: 0, collected: 0 },
    { label: 'Week 4', invoiced: 0, collected: 0 }
  ]

  const agingBuckets = dashboardData?.aging?.buckets ?? [
    { label: '0-30 Days', amount: 0, percentage: 0 },
    { label: '31-60 Days', amount: 0, percentage: 0 },
    { label: '60+ Days', amount: 0, percentage: 0 }
  ]

  const topOrganizationsOutstanding = dashboardData?.topOrganizationsOutstanding ?? []

  const outstandingLevel =
    summary.totalOutstanding >= 500000
      ? 'High'
      : summary.totalOutstanding >= 100000
      ? 'Medium'
      : 'Low'

  const chartConfig = useMemo(() => {
    const maxValue = Math.max(
      1,
      ...invoiceVsCollection.flatMap((point) => [point.invoiced, point.collected])
    )

    const startX = 50
    const endX = 780
    const startY = 200
    const chartHeight = 180
    const step = invoiceVsCollection.length > 1 ? (endX - startX) / (invoiceVsCollection.length - 1) : 0

    const toY = (value: number) => startY - (value / maxValue) * chartHeight
    const toPath = (values: number[]) => {
      if (values.length === 0) {
        return ''
      }
      return values
        .map((value, index) => `${index === 0 ? 'M' : 'L'} ${startX + index * step},${toY(value)}`)
        .join(' ')
    }

    return {
      invoicedPath: toPath(invoiceVsCollection.map((point) => point.invoiced)),
      collectedPath: toPath(invoiceVsCollection.map((point) => point.collected))
    }
  }, [invoiceVsCollection])

  const donutConfig = useMemo(() => {
    const circumference = 2 * Math.PI * 40
    let offset = 0

    return agingBuckets.map((bucket) => {
      const fraction = Math.max(0, bucket.percentage) / 100
      const dash = fraction * circumference
      const config = {
        label: bucket.label,
        amount: bucket.amount,
        percentage: bucket.percentage,
        strokeDasharray: `${dash} ${Math.max(0, circumference - dash)}`,
        strokeDashoffset: -offset
      }
      offset += dash
      return config
    })
  }, [agingBuckets])

  const topOutstandingMax = Math.max(1, ...topOrganizationsOutstanding.map((item) => item.amount))

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark transition-colors duration-200">
      <Sidebar title="Hotel Finance" logoIcon="domain" />
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark relative">
        <Header />
        
        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="mx-auto max-w-7xl flex flex-col gap-6">
            {/* Page Heading */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex items-start gap-3">
                {hotelLogoUrl && !isHotelLogoFailed ? (
                  <img
                    src={hotelLogoUrl}
                    alt={hotelName}
                    onError={() => setIsHotelLogoFailed(true)}
                    className="size-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold border border-primary/20">
                    {hotelName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Hotel</p>
                  <p className="text-sm font-bold text-text-main-light dark:text-text-main-dark">{hotelName}</p>
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-text-main-light dark:text-text-main-dark">Financial Overview</h2>
                <p className="text-text-sub-light dark:text-text-sub-dark mt-1">Real-time corporate billing status &amp; performance</p>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-text-main-light dark:text-text-main-dark shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                  <span>This Month</span>
                  <span className="material-symbols-outlined text-[20px]">arrow_drop_down</span>
                </button>
                <button className="flex items-center justify-center px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors shadow-blue-500/20">
                  <span className="material-symbols-outlined text-[20px] mr-2">download</span>
                  Export
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            )}
            
            {/* KPI Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Total Invoiced */}
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary">
                    <span className="material-symbols-outlined">receipt</span>
                  </div>
                  <span className="flex items-center text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-full">MTD</span>
                </div>
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Total Invoiced (MTD)</p>
                <h3 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mt-1">
                  {isLoading ? '...' : formatCurrency(summary.totalInvoicedMtd)}
                </h3>
              </div>
              
              {/* Total Collected */}
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-success">
                    <span className="material-symbols-outlined">savings</span>
                  </div>
                  <span className="flex items-center text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-full">Paid</span>
                </div>
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Total Collected</p>
                <h3 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mt-1">
                  {isLoading ? '...' : formatCurrency(summary.totalCollected)}
                </h3>
              </div>
              
              {/* Outstanding Amount */}
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-warning">
                    <span className="material-symbols-outlined">pending_actions</span>
                  </div>
                  <span className="flex items-center text-xs font-bold text-warning bg-warning/10 px-2 py-1 rounded-full">{outstandingLevel}</span>
                </div>
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Outstanding Amount</p>
                <h3 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mt-1">
                  {isLoading ? '...' : formatCurrency(summary.totalOutstanding)}
                </h3>
              </div>
              
              {/* Overdue Invoices */}
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-danger">
                    <span className="material-symbols-outlined">warning</span>
                  </div>
                  <span className="flex items-center text-xs font-bold text-danger bg-danger/10 px-2 py-1 rounded-full">Live</span>
                </div>
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Overdue Invoices</p>
                <h3 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mt-1">
                  {isLoading ? '...' : summary.overdueInvoices}
                </h3>
              </div>
            </div>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Invoice vs Collection Chart */}
              <div className="xl:col-span-2 bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">Invoice vs Collection</h3>
                    <p className="text-sm text-text-sub-light dark:text-text-sub-dark">Comparison of billed volume vs collected revenue</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                      <span className="text-xs text-text-sub-light dark:text-text-sub-dark">Invoiced</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-success"></div>
                      <span className="text-xs text-text-sub-light dark:text-text-sub-dark">Collected</span>
                    </div>
                  </div>
                </div>
                
                {/* Chart Area */}
                <div className="relative h-64 w-full">
                  <svg className="w-full h-full" viewBox="0 0 800 256">
                    {/* Grid lines */}
                    <line x1="0" y1="0" x2="800" y2="0" stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-700" strokeDasharray="4 4" />
                    <line x1="0" y1="64" x2="800" y2="64" stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-700" strokeDasharray="4 4" />
                    <line x1="0" y1="128" x2="800" y2="128" stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-700" strokeDasharray="4 4" />
                    <line x1="0" y1="192" x2="800" y2="192" stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-700" strokeDasharray="4 4" />
                    
                    {/* Invoiced line (blue) */}
                    <path
                      d={chartConfig.invoicedPath}
                      fill="none"
                      stroke="#0651ED"
                      strokeWidth="3"
                      className="drop-shadow-lg"
                    />
                    
                    {/* Collected line (green) */}
                    <path
                      d={chartConfig.collectedPath}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="3"
                      strokeDasharray="5 5"
                    />
                    
                    {/* Month labels */}
                    {invoiceVsCollection.map((point, index) => {
                      const x = invoiceVsCollection.length > 1 ? 50 + (730 / (invoiceVsCollection.length - 1)) * index : 50
                      return (
                        <text key={point.label} x={x} y="245" className="text-xs fill-slate-400" textAnchor="middle">
                          {point.label}
                        </text>
                      )
                    })}
                  </svg>
                </div>
              </div>
              
              {/* Aging Analysis */}
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-2">Aging Analysis</h3>
                <p className="text-sm text-text-sub-light dark:text-text-sub-dark mb-6">Breakdown of outstanding invoices by age.</p>
                
                {/* Donut Chart */}
                <div className="flex items-center justify-center mb-6">
                  <div className="relative w-48 h-48">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {/* 0-30 Days - Blue (60%) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#0651ED"
                        strokeWidth="20"
                        strokeDasharray={donutConfig[0]?.strokeDasharray ?? '0 251.2'}
                        strokeDashoffset={donutConfig[0]?.strokeDashoffset ?? 0}
                      />
                      {/* 31-60 Days - Orange (30%) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="20"
                        strokeDasharray={donutConfig[1]?.strokeDasharray ?? '0 251.2'}
                        strokeDashoffset={donutConfig[1]?.strokeDashoffset ?? 0}
                      />
                      {/* 60+ Days - Red (10%) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="20"
                        strokeDasharray={donutConfig[2]?.strokeDasharray ?? '0 251.2'}
                        strokeDashoffset={donutConfig[2]?.strokeDashoffset ?? 0}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-xs text-text-sub-light dark:text-text-sub-dark">Total Due</p>
                      <p className="text-xl font-bold text-text-main-light dark:text-text-main-dark">
                        {isLoading ? '...' : formatCurrency(summary.totalOutstanding)}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Legend */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                      <span className="text-sm text-text-main-light dark:text-text-main-dark">0-30 Days</span>
                    </div>
                    <span className="text-sm font-bold text-text-main-light dark:text-text-main-dark">{Math.round(agingBuckets[0]?.percentage ?? 0)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-warning"></div>
                      <span className="text-sm text-text-main-light dark:text-text-main-dark">31-60 Days</span>
                    </div>
                    <span className="text-sm font-bold text-text-main-light dark:text-text-main-dark">{Math.round(agingBuckets[1]?.percentage ?? 0)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-danger"></div>
                      <span className="text-sm text-text-main-light dark:text-text-main-dark">60+ Days</span>
                    </div>
                    <span className="text-sm font-bold text-text-main-light dark:text-text-main-dark">{Math.round(agingBuckets[2]?.percentage ?? 0)}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Top Organizations Outstanding */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-6">Top Organizations Outstanding</h3>
              
              <div className="space-y-4">
                {topOrganizationsOutstanding.length > 0 ? (
                  topOrganizationsOutstanding.map((organization) => (
                    <div key={organization.name}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text-main-light dark:text-text-main-dark">{organization.name}</span>
                        <span className="text-sm font-bold text-text-main-light dark:text-text-main-dark">{formatCurrency(organization.amount)}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mt-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${Math.max(6, (organization.amount / topOutstandingMax) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-sub-light dark:text-text-sub-dark">No outstanding balances at the moment.</p>
                )}
              </div>
            </div>
            
            {/* Send Reminders Card */}
            <div className="bg-primary rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <span className="material-symbols-outlined text-4xl">mark_email_unread</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">Send Reminders</h3>
                  <p className="text-sm text-blue-100 mb-4">{summary.overdueInvoices} overdue invoices need attention.</p>
                  <button className="px-6 py-2.5 bg-white text-primary rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors">
                    Review &amp; Send
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
