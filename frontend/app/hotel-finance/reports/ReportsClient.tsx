"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import { useState } from 'react'

interface RevenueData {
  month: string
  roomRevenue: number
  incidentals: number
  total: number
}

interface RoomPerformance {
  roomType: string
  occupancy: number
  revenue: number
  avgDailyRate: number
  nights: number
}

interface CorporateClient {
  name: string
  totalBookings: number
  totalSpent: number
  occupiedNights: number
  avgBookingValue: number
  paymentStatus: 'paid' | 'pending' | 'overdue'
}

const revenueData: RevenueData[] = [
  { month: 'Jan', roomRevenue: 45000, incidentals: 5200, total: 50200 },
  { month: 'Feb', roomRevenue: 52000, incidentals: 6800, total: 58800 },
  { month: 'Mar', roomRevenue: 58000, incidentals: 7500, total: 65500 },
  { month: 'Apr', roomRevenue: 62000, incidentals: 8200, total: 70200 },
  { month: 'May', roomRevenue: 71000, incidentals: 9100, total: 80100 },
  { month: 'Jun', roomRevenue: 85000, incidentals: 11200, total: 96200 },
]

const roomPerformance: RoomPerformance[] = [
  { roomType: 'Standard Room', occupancy: 78, revenue: 125000, avgDailyRate: 165, nights: 758 },
  { roomType: 'Deluxe Suite', occupancy: 85, revenue: 95000, avgDailyRate: 285, nights: 333 },
  { roomType: 'Presidential Suite', occupancy: 92, revenue: 108000, avgDailyRate: 520, nights: 208 },
  { roomType: 'Executive Room', occupancy: 81, revenue: 87000, avgDailyRate: 220, nights: 395 },
]

const corporateClients: CorporateClient[] = [
  { name: 'Oracle Corp', totalBookings: 24, totalSpent: 87500, occupiedNights: 145, avgBookingValue: 3646, paymentStatus: 'paid' },
  { name: 'Tech Innovations Inc', totalBookings: 18, totalSpent: 62300, occupiedNights: 89, avgBookingValue: 3461, paymentStatus: 'paid' },
  { name: 'Global Finance Ltd', totalBookings: 32, totalSpent: 125600, occupiedNights: 267, avgBookingValue: 3925, paymentStatus: 'pending' },
  { name: 'Enterprise Solutions', totalBookings: 15, totalSpent: 48900, occupiedNights: 78, avgBookingValue: 3260, paymentStatus: 'pending' },
  { name: 'Digital Transformations Co', totalBookings: 22, totalSpent: 71200, occupiedNights: 112, avgBookingValue: 3236, paymentStatus: 'overdue' },
]

const formatInr = (value: number) => value.toLocaleString('en-IN')

export default function ReportsClient() {
  const [timeRange, setTimeRange] = useState('6months')
  const [selectedMetric, setSelectedMetric] = useState('revenue')

  const maxRevenue = Math.max(...revenueData.map(d => d.total))
  const totalRevenue = revenueData.reduce((sum, d) => sum + d.total, 0)
  const totalOccupancy = Math.round(roomPerformance.reduce((sum, r) => sum + r.occupancy, 0) / roomPerformance.length)
  const avgDailyRate = Math.round(roomPerformance.reduce((sum, r) => sum + r.avgDailyRate, 0) / roomPerformance.length)
  const totalBookings = corporateClients.reduce((sum, c) => sum + c.totalBookings, 0)
  const overduAmount = corporateClients.filter(c => c.paymentStatus === 'overdue').reduce((sum, c) => sum + c.totalSpent, 0)

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

            {/* KPI Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary">
                    <span className="material-symbols-outlined">trending_up</span>
                  </div>
                  <span className="flex items-center text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-full">+12.5%</span>
                </div>
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Total Revenue</p>
                <h3 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mt-1">₹{(totalRevenue / 1000).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K</h3>
              </div>

              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-success">
                    <span className="material-symbols-outlined">hotel</span>
                  </div>
                  <span className="flex items-center text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-full">+8%</span>
                </div>
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Avg Occupancy Rate</p>
                <h3 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mt-1">{totalOccupancy}%</h3>
              </div>

              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-warning">
                    <span className="material-symbols-outlined">local_fire_department</span>
                  </div>
                  <span className="flex items-center text-xs font-bold text-warning bg-warning/10 px-2 py-1 rounded-full">Avg</span>
                </div>
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Avg Daily Rate</p>
                <h3 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mt-1">₹{avgDailyRate}</h3>
              </div>

              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                    <span className="material-symbols-outlined">business</span>
                  </div>
                  <span className="flex items-center text-xs font-bold text-info bg-info/10 px-2 py-1 rounded-full">{totalBookings}</span>
                </div>
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Total Bookings</p>
                <h3 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mt-1">{totalBookings}</h3>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue Trend Chart */}
              <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800">
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
                          style={{width: `${(data.roomRevenue / maxRevenue) * 70}%`}}
                          title="Room Revenue"
                        />
                        <div 
                          className="bg-amber-500 rounded-r-lg transition-all"
                          style={{width: `${(data.incidentals / maxRevenue) * 30}%`}}
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

              {/* Payment Status Card */}
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-6">Payment Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Paid</p>
                      <p className="text-xs text-text-sub-light dark:text-text-sub-dark">₹{formatInr(corporateClients.filter(c => c.paymentStatus === 'paid').reduce((s, c) => s + c.totalSpent, 0))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">schedule</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Pending</p>
                      <p className="text-xs text-text-sub-light dark:text-text-sub-dark">₹{formatInr(corporateClients.filter(c => c.paymentStatus === 'pending').reduce((s, c) => s + c.totalSpent, 0))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-red-600 dark:text-red-400">warning</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Overdue</p>
                      <p className="text-xs text-text-sub-light dark:text-text-sub-dark">₹{formatInr(overduAmount)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

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
                      <th className="px-6 py-4 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Occupancy</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Nights Sold</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Avg Daily Rate</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-text-main-light dark:text-text-main-dark">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {roomPerformance.map((room, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-text-main-light dark:text-text-main-dark">{room.roomType}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-primary to-blue-600" style={{width: `${room.occupancy}%`}} />
                            </div>
                            <span className="text-sm font-semibold text-text-main-light dark:text-text-main-dark w-10 text-right">{room.occupancy}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-text-main-light dark:text-text-main-dark">{room.nights}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-text-main-light dark:text-text-main-dark">₹{room.avgDailyRate}</td>
                        <td className="px-6 py-4 text-sm font-bold text-primary text-right">₹{formatInr(room.revenue)}</td>
                      </tr>
                    ))}
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
                      <th className="px-6 py-4 text-left text-sm font-semibold text-text-main-light dark:text-text-main-dark">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {corporateClients.map((client, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-text-main-light dark:text-text-main-dark">{client.name}</td>
                        <td className="px-6 py-4 text-sm text-text-main-light dark:text-text-main-dark">{client.totalBookings}</td>
                        <td className="px-6 py-4 text-sm text-text-main-light dark:text-text-main-dark">{client.occupiedNights}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-text-main-light dark:text-text-main-dark">₹{formatInr(client.avgBookingValue)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-primary">₹{formatInr(client.totalSpent)}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            client.paymentStatus === 'paid' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : client.paymentStatus === 'pending'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            <span className="material-symbols-outlined text-sm">
                              {client.paymentStatus === 'paid' ? 'check_circle' : client.paymentStatus === 'pending' ? 'schedule' : 'warning'}
                            </span>
                            {client.paymentStatus.charAt(0).toUpperCase() + client.paymentStatus.slice(1)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-900/50">
                <div className="flex items-start justify-between mb-4">
                  <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">Top Performer</h4>
                  <span className="material-symbols-outlined text-2xl text-blue-600 dark:text-blue-400">star</span>
                </div>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-300">Presidential Suite</p>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-2">92% occupancy | ₹108K revenue | ₹520 ADR</p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border border-purple-200 dark:border-purple-900/50">
                <div className="flex items-start justify-between mb-4">
                  <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider">Top Client</h4>
                  <span className="material-symbols-outlined text-2xl text-purple-600 dark:text-purple-400">trending_up</span>
                </div>
                <p className="text-lg font-bold text-purple-900 dark:text-purple-300">Global Finance Ltd</p>
                <p className="text-sm text-purple-700 dark:text-purple-400 mt-2">32 bookings | ₹125.6K spent | 267 nights</p>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl p-6 border border-amber-200 dark:border-amber-900/50">
                <div className="flex items-start justify-between mb-4">
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">Action Required</h4>
                  <span className="material-symbols-outlined text-2xl text-amber-600 dark:text-amber-400">warning</span>
                </div>
                <p className="text-lg font-bold text-amber-900 dark:text-amber-300">Overdue Invoices</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">₹{formatInr(overduAmount)} from Digital Transformations Co</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
