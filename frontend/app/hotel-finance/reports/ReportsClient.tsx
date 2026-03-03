"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tokenStorage } from '@/lib/auth'
import {
  fetchHotelFinanceReports,
  HotelFinanceReportsResponse,
  ReportRevenueData,
  ReportRoomPerformance,
  ReportCorporateClient
} from '@/lib/bookingsApi'

const formatInr = (value: number) => value.toLocaleString('en-IN')

export default function ReportsClient() {
  const router = useRouter()
  const [timeRange, setTimeRange] = useState('6months')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revenueData, setRevenueData] = useState<ReportRevenueData[]>([])
  const [roomPerformance, setRoomPerformance] = useState<ReportRoomPerformance[]>([])
  const [corporateClients, setCorporateClients] = useState<ReportCorporateClient[]>([])
  const [kpi, setKpi] = useState({ totalRevenue: 0, totalBookings: 0, avgDailyRate: 0 })

  useEffect(() => {
    const token = tokenStorage.get()
    if (!token) {
      router.replace('/hotel-finance/login')
      return
    }

    const loadReports = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data: HotelFinanceReportsResponse = await fetchHotelFinanceReports()
        setRevenueData(data.revenueData)
        setRoomPerformance(data.roomPerformance)
        setCorporateClients(data.corporateClients)
        setKpi(data.kpi)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load reports'
        setError(message)
        if (message.toLowerCase().includes('unauthorized')) {
          tokenStorage.clear()
          router.replace('/hotel-finance/login')
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadReports()
  }, [router])

  const maxRevenue = revenueData.length > 0 ? Math.max(...revenueData.map(d => d.total)) : 0

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark transition-colors duration-200">
      <Sidebar title="Hotel Finance" logoIcon="domain" />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark relative">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="mx-auto max-w-7xl flex flex-col gap-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-text-main-light dark:text-text-main-dark">Reports & Analytics</h2>
                <p className="text-text-sub-light dark:text-text-sub-dark mt-1">Comprehensive hotel performance insights</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-text-main-light dark:text-text-main-dark shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <option value="30days">Last 30 Days</option>
                  <option value="3months">Last 3 Months</option>
                  <option value="6months">Last 6 Months</option>
                  <option value="1year">Last Year</option>
                </select>
                <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors">
                  <span className="material-symbols-outlined text-[20px]">download</span>
                  Export
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark px-6 py-10 text-center text-sm text-text-sub-light dark:text-text-sub-dark">
                Loading reports data...
              </div>
            ) : (
              <>
                {/* KPI Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary">
                        <span className="material-symbols-outlined">trending_up</span>
                      </div>
                    </div>
                    <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Total Revenue</p>
                    <h3 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mt-1">
                      {kpi.totalRevenue > 0 ? `₹${(kpi.totalRevenue / 1000).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K` : '₹0'}
                    </h3>
                  </div>

                  <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-success">
                        <span className="material-symbols-outlined">hotel</span>
                      </div>
                    </div>
                    <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Room Types</p>
                    <h3 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mt-1">{roomPerformance.length}</h3>
                  </div>

                  <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-warning">
                        <span className="material-symbols-outlined">local_fire_department</span>
                      </div>
                    </div>
                    <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Avg Daily Rate</p>
                    <h3 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mt-1">
                      {kpi.avgDailyRate > 0 ? `₹${kpi.avgDailyRate}` : '₹0'}
                    </h3>
                  </div>

                  <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                        <span className="material-symbols-outlined">business</span>
                      </div>
                    </div>
                    <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Total Bookings</p>
                    <h3 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mt-1">{kpi.totalBookings}</h3>
                  </div>
                </div>

                {/* Revenue Trend Chart */}
                {revenueData.length > 0 ? (
                  <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800">
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">Revenue Trend</h3>
                      <p className="text-sm text-text-sub-light dark:text-text-sub-dark">Monthly breakdown of room and incidental revenue</p>
                    </div>
                    <div className="space-y-4">
                      {revenueData.map((data, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-text-main-light dark:text-text-main-dark">{data.month}</span>
                            <span className="text-sm font-bold text-primary">₹{formatInr(data.total)}</span>
                          </div>
                          <div className="flex gap-1 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                            <div
                              className="bg-blue-500 rounded-l-lg transition-all"
                              style={{width: `${maxRevenue > 0 ? (data.roomRevenue / maxRevenue) * 70 : 0}%`}}
                              title="Room Revenue"
                            />
                            <div
                              className="bg-amber-500 rounded-r-lg transition-all"
                              style={{width: `${maxRevenue > 0 ? (data.incidentals / maxRevenue) * 30 : 0}%`}}
                              title="Incidentals"
                            />
                          </div>
                          <div className="flex gap-4 text-xs text-text-sub-light dark:text-text-sub-dark">
                            <span>Room: ₹{formatInr(data.roomRevenue)}</span>
                            <span>Incidentals: ₹{formatInr(data.incidentals)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-2">Revenue Trend</h3>
                    <p className="text-sm text-text-sub-light dark:text-text-sub-dark">No revenue data available yet. Create bookings to see trends.</p>
                  </div>
                )}

                {/* Room Performance Table */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">insights</span>
                      Room Type Performance
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                          <th className="px-6 py-4 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Room Type</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Nights Sold</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Avg Daily Rate</th>
                          <th className="px-6 py-4 text-right text-sm font-semibold text-text-main-light dark:text-text-main-dark">Total Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {roomPerformance.length > 0 ? roomPerformance.map((room, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-text-main-light dark:text-text-main-dark">{room.roomType}</td>
                            <td className="px-6 py-4 text-sm text-text-main-light dark:text-text-main-dark">{room.nights}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-text-main-light dark:text-text-main-dark">₹{room.avgDailyRate}</td>
                            <td className="px-6 py-4 text-sm font-bold text-primary text-right">₹{formatInr(room.revenue)}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-sm text-text-sub-light dark:text-text-sub-dark">
                              No room performance data available yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Corporate Clients Performance */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">business</span>
                      Corporate Client Performance
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                          <th className="px-6 py-4 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Company</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Bookings</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Occupied Nights</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Avg Booking Value</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Total Spent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {corporateClients.length > 0 ? corporateClients.map((client, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-text-main-light dark:text-text-main-dark">{client.name}</td>
                            <td className="px-6 py-4 text-sm text-text-main-light dark:text-text-main-dark">{client.totalBookings}</td>
                            <td className="px-6 py-4 text-sm text-text-main-light dark:text-text-main-dark">{client.occupiedNights}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-text-main-light dark:text-text-main-dark">₹{formatInr(client.avgBookingValue)}</td>
                            <td className="px-6 py-4 text-sm font-bold text-primary">₹{formatInr(client.totalSpent)}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-sm text-text-sub-light dark:text-text-sub-dark">
                              No corporate client data available yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary Cards - only show when data exists */}
                {(roomPerformance.length > 0 || corporateClients.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-900/50">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">Top Room Type</h4>
                        <span className="material-symbols-outlined text-2xl text-blue-600 dark:text-blue-400">star</span>
                      </div>
                      {roomPerformance.length > 0 ? (
                        <>
                          <p className="text-lg font-bold text-blue-900 dark:text-blue-300">{roomPerformance[0].roomType}</p>
                          <p className="text-sm text-blue-700 dark:text-blue-400 mt-2">{roomPerformance[0].nights} nights &middot; &#8377;{formatInr(roomPerformance[0].revenue)} revenue</p>
                        </>
                      ) : (
                        <p className="text-sm text-blue-700 dark:text-blue-400">No data yet</p>
                      )}
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border border-purple-200 dark:border-purple-900/50">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider">Top Client</h4>
                        <span className="material-symbols-outlined text-2xl text-purple-600 dark:text-purple-400">trending_up</span>
                      </div>
                      {corporateClients.length > 0 ? (
                        <>
                          <p className="text-lg font-bold text-purple-900 dark:text-purple-300">{corporateClients[0].name}</p>
                          <p className="text-sm text-purple-700 dark:text-purple-400 mt-2">{corporateClients[0].totalBookings} bookings &middot; &#8377;{formatInr(corporateClients[0].totalSpent)} spent</p>
                        </>
                      ) : (
                        <p className="text-sm text-purple-700 dark:text-purple-400">No data yet</p>
                      )}
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl p-6 border border-amber-200 dark:border-amber-900/50">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">Total Revenue</h4>
                        <span className="material-symbols-outlined text-2xl text-amber-600 dark:text-amber-400">account_balance</span>
                      </div>
                      <p className="text-lg font-bold text-amber-900 dark:text-amber-300">&#8377;{formatInr(kpi.totalRevenue)}</p>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">{kpi.totalBookings} total bookings this year</p>
                    </div>
                  </div>
                )}

                {/* Empty state when no data at all */}
                {revenueData.length === 0 && roomPerformance.length === 0 && corporateClients.length === 0 && (
                  <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-10 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 text-center">
                    <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-4 block">analytics</span>
                    <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-2">No Report Data Yet</h3>
                    <p className="text-sm text-text-sub-light dark:text-text-sub-dark max-w-md mx-auto">
                      Reports will automatically populate once you start creating bookings. Head to the Bookings page to get started.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
