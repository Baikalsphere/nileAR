"use client"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { logout } from '@/lib/auth'
import { logoutCorporate } from '@/lib/corporateAuth'

export interface SidebarProps {
  title: string
  logoIcon: string
}

export default function Sidebar({ title, logoIcon }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showTooltip, setShowTooltip] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  
  // Determine which portal we're in
  const isHotelFinance = pathname.includes('/hotel-finance')
  const isCorporatePortal = pathname.includes('/corporate-portal')
  
  const dashboardHref = isCorporatePortal ? '/corporate-portal' : (isHotelFinance ? '/hotel-finance' : '#')
  const invoicesHref = isCorporatePortal ? '/corporate-portal/invoices' : '#'
  const organizationsHref = isHotelFinance ? '/hotel-finance/organizations' : '#'
  const bookingsHref = isHotelFinance ? '/hotel-finance/bookings' : '#'
  const hotelReportsHref = isHotelFinance ? '/hotel-finance/reports' : '#'
  const hotelProfileHref = isHotelFinance ? '/hotel-finance/profile' : '#'
  const employeeStaysHref = isCorporatePortal ? '/corporate-portal/employee-stays' : '#'
  const corporateBookingRequestsHref = isCorporatePortal ? '/corporate-portal/booking-requests' : '#'
  const employeesHref = isCorporatePortal ? '/corporate-portal/employees' : '#'
  const reportsHref = isCorporatePortal ? '/corporate-portal/reports' : '#'
  const settingsHref = isCorporatePortal ? '/corporate-portal/settings' : '#'
  
  // Determine active states
  const isDashboardActive = pathname === dashboardHref
  const isInvoicesActive = pathname === invoicesHref
  const isOrganizationsActive = pathname === organizationsHref
  const isBookingsActive = pathname.startsWith('/hotel-finance/bookings')
  const isHotelReportsActive = pathname === hotelReportsHref
  const isHotelProfileActive = pathname === hotelProfileHref
  const isEmployeeStaysActive = pathname === employeeStaysHref
  const isCorporateBookingRequestsActive = pathname.startsWith('/corporate-portal/booking-requests')
  const isEmployeesActive = pathname === employeesHref
  const isReportsActive = pathname === reportsHref
  const isSettingsActive = pathname === settingsHref

  const handleLogout = async () => {
    if (isCorporatePortal) {
      await logoutCorporate()
      router.push('/corporate-portal/login')
      return
    }

    if (isHotelFinance) {
      await logout()
      router.push('/hotel-finance/login')
      return
    }

    router.push('/')
  }

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0 border-r border-[#e7ecf3] dark:border-slate-800 bg-white dark:bg-[#161f2c] hidden lg:flex flex-col transition-all duration-500 ease-in-out shadow-lg`}>
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="h-16 flex items-center px-6 border-b border-[#e7ecf3] dark:border-slate-800 group hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent dark:hover:from-slate-800/40 dark:hover:to-transparent transition-all duration-300 relative overflow-hidden"
      >
        {/* Animated background effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        <div className={`flex items-center gap-3 relative z-10 ${isCollapsed ? 'justify-center w-full' : ''}`}>
          <div
            className={`bg-center bg-no-repeat aspect-square bg-cover rounded-full size-8 ring-2 ring-transparent group-hover:ring-primary/40 group-hover:scale-110 transition-all duration-300 ${isCollapsed ? 'group-hover:rotate-[360deg]' : ''}`}
            style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCwm9cQ0Z_hJGCRfhC8xIumNZQGzbtTe2Zrx9p8pnPNpfC_ZlsxZh9bM-aPkYBndBmwlW1Kt5hbZYKoRvPHn4j62IXht4K_fxrf6xjGr3-diDRweFMNOBaWlRHc5EBw-_dsUGhhLWpS87kva_xOF17HQGrmg9M9vAIIvej5V2xHlTb3FYOuhFyMorLFt0ULxBSvZz0MoMvN9jZMYK66zpwQDQo-ITkw4Jg29rx6tcL81zTw8EtGMiftXr-JfInsARJBMxVudfceSpZ-")'}}
          ></div>
          <h1 className={`text-[#0d131b] dark:text-white text-lg font-bold tracking-tight transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden -translate-x-4' : 'opacity-100 translate-x-0'}`}>
            {title}
          </h1>
          {/* Collapse indicator icon */}
          {!isCollapsed && (
            <span className="material-symbols-outlined text-[20px] text-slate-400 group-hover:text-primary ml-auto transition-all duration-300 group-hover:translate-x-1">
              chevron_left
            </span>
          )}
          {isCollapsed && (
            <span className="material-symbols-outlined text-[20px] text-slate-400 group-hover:text-primary absolute right-1 transition-all duration-300 group-hover:-translate-x-1">
              chevron_right
            </span>
          )}
        </div>
      </button>
      <div className="flex flex-col flex-1 p-4 gap-2 overflow-y-auto">
        <div 
          className="relative"
          onMouseEnter={() => isCollapsed && setShowTooltip('dashboard')}
          onMouseLeave={() => setShowTooltip(null)}
        >
          <Link className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group/link ${isDashboardActive ? 'bg-primary/10 text-primary hover:shadow-md hover:shadow-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'} ${isCollapsed ? 'justify-center' : ''}`} href={dashboardHref}>
            <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${isCollapsed ? 'group-hover/link:scale-125' : ''}`} style={{fontVariationSettings: "'FILL' 1"}}>{isCorporatePortal ? 'dashboard' : 'dashboard'}</span>
            <p className={`text-sm font-semibold transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-75'}`}>Dashboard</p>
            {!isCollapsed && (
              <span className={`material-symbols-outlined text-[16px] ml-auto opacity-0 -translate-x-2 transition-all duration-300 ${isDashboardActive ? 'group-hover/link:opacity-100 group-hover/link:translate-x-0' : 'group-hover/link:opacity-100 group-hover/link:translate-x-0'}`}>
                arrow_forward
              </span>
            )}
          </Link>
          {isCollapsed && showTooltip === 'dashboard' && (
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in fade-in slide-in-from-left-1 duration-200">
              Dashboard
            </div>
          )}
        </div>
        {isCorporatePortal && (
          <>
            <div 
              className="relative"
              onMouseEnter={() => isCollapsed && setShowTooltip('invoices')}
              onMouseLeave={() => setShowTooltip(null)}
            >
              <Link className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group/link ${isInvoicesActive ? 'bg-primary/10 text-primary hover:shadow-md hover:shadow-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'} ${isCollapsed ? 'justify-center' : ''}`} href={invoicesHref}>
                <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${isCollapsed ? 'group-hover/link:scale-125' : ''}`}>receipt_long</span>
                <p className={`text-sm font-medium transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-75'}`}>Invoices</p>
                {!isCollapsed && (
                  <span className={`material-symbols-outlined text-[16px] ml-auto opacity-0 -translate-x-2 transition-all duration-300 ${isInvoicesActive ? 'group-hover/link:opacity-100 group-hover/link:translate-x-0' : 'group-hover/link:opacity-100 group-hover/link:translate-x-0'}`}>
                    arrow_forward
                  </span>
                )}
              </Link>
              {isCollapsed && showTooltip === 'invoices' && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in fade-in slide-in-from-left-1 duration-200">
                  Invoices
                </div>
              )}
            </div>
            <div 
              className="relative"
              onMouseEnter={() => isCollapsed && setShowTooltip('employees')}
              onMouseLeave={() => setShowTooltip(null)}
            >
              <Link className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group/link ${isEmployeesActive ? 'bg-primary/10 text-primary hover:shadow-md hover:shadow-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'} ${isCollapsed ? 'justify-center' : ''}`} href={employeesHref}>
                <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${isCollapsed ? 'group-hover/link:scale-125' : ''}`}>group</span>
                <p className={`text-sm font-medium transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-75'}`}>Employees</p>
                {!isCollapsed && (
                  <span className={`material-symbols-outlined text-[16px] ml-auto opacity-0 -translate-x-2 transition-all duration-300 ${isEmployeesActive ? 'group-hover/link:opacity-100 group-hover/link:translate-x-0' : 'group-hover/link:opacity-100 group-hover/link:translate-x-0'}`}>
                    arrow_forward
                  </span>
                )}
              </Link>
              {isCollapsed && showTooltip === 'employees' && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in fade-in slide-in-from-left-1 duration-200">
                  Employees
                </div>
              )}
            </div>
            <div 
              className="relative"
              onMouseEnter={() => isCollapsed && setShowTooltip('employee-stays')}
              onMouseLeave={() => setShowTooltip(null)}
            >
              <Link className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group/link ${isEmployeeStaysActive ? 'bg-primary/10 text-primary hover:shadow-md hover:shadow-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'} ${isCollapsed ? 'justify-center' : ''}`} href={employeeStaysHref}>
                <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${isCollapsed ? 'group-hover/link:scale-125' : ''}`}>hotel</span>
                <p className={`text-sm font-medium transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-75'}`}>Employee Stays</p>
                {!isCollapsed && (
                  <span className={`material-symbols-outlined text-[16px] ml-auto opacity-0 -translate-x-2 transition-all duration-300 ${isEmployeeStaysActive ? 'group-hover/link:opacity-100 group-hover/link:translate-x-0' : 'group-hover/link:opacity-100 group-hover/link:translate-x-0'}`}>
                    arrow_forward
                  </span>
                )}
              </Link>
              {isCollapsed && showTooltip === 'employee-stays' && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in fade-in slide-in-from-left-1 duration-200">
                  Employee Stays
                </div>
              )}
            </div>
            <div
              className="relative"
              onMouseEnter={() => isCollapsed && setShowTooltip('book-rooms')}
              onMouseLeave={() => setShowTooltip(null)}
            >
              <Link className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group/link ${isCorporateBookingRequestsActive ? 'bg-primary/10 text-primary hover:shadow-md hover:shadow-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'} ${isCollapsed ? 'justify-center' : ''}`} href={corporateBookingRequestsHref}>
                <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${isCollapsed ? 'group-hover/link:scale-125' : ''}`}>add_business</span>
                <p className={`text-sm font-medium transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-75'}`}>Book Rooms</p>
                {!isCollapsed && (
                  <span className={`material-symbols-outlined text-[16px] ml-auto opacity-0 -translate-x-2 transition-all duration-300 ${isCorporateBookingRequestsActive ? 'group-hover/link:opacity-100 group-hover/link:translate-x-0' : 'group-hover/link:opacity-100 group-hover/link:translate-x-0'}`}>
                    arrow_forward
                  </span>
                )}
              </Link>
              {isCollapsed && showTooltip === 'book-rooms' && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in fade-in slide-in-from-left-1 duration-200">
                  Book Rooms
                </div>
              )}
            </div>
          </>
        )}
        {isHotelFinance && (
          <>
            <div 
              className="relative"
              onMouseEnter={() => isCollapsed && setShowTooltip('organizations')}
              onMouseLeave={() => setShowTooltip(null)}
            >
              <Link className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group/link ${isOrganizationsActive ? 'bg-primary/10 text-primary hover:shadow-md hover:shadow-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'} ${isCollapsed ? 'justify-center' : ''}`} href={organizationsHref}>
                <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${isCollapsed ? 'group-hover/link:scale-125' : ''}`}>business_center</span>
                <p className={`text-sm font-medium transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-75'}`}>Organizations</p>
                {!isCollapsed && (
                  <span className={`material-symbols-outlined text-[16px] ml-auto opacity-0 -translate-x-2 transition-all duration-300 ${isOrganizationsActive ? 'group-hover/link:opacity-100 group-hover/link:translate-x-0' : 'group-hover/link:opacity-100 group-hover/link:translate-x-0'}`}>
                    arrow_forward
                  </span>
                )}
              </Link>
              {isCollapsed && showTooltip === 'organizations' && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in fade-in slide-in-from-left-1 duration-200">
                  Organizations
                </div>
              )}
            </div>
            <div 
              className="relative"
              onMouseEnter={() => isCollapsed && setShowTooltip('bookings')}
              onMouseLeave={() => setShowTooltip(null)}
            >
              <Link className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group/link ${isBookingsActive ? 'bg-primary/10 text-primary hover:shadow-md hover:shadow-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'} ${isCollapsed ? 'justify-center' : ''}`} href={bookingsHref}>
                <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${isCollapsed ? 'group-hover/link:scale-125' : ''}`}>calendar_month</span>
                <p className={`text-sm font-medium transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-75'}`}>Bookings</p>
                {!isCollapsed && (
                  <span className={`material-symbols-outlined text-[16px] ml-auto opacity-0 -translate-x-2 transition-all duration-300 ${isBookingsActive ? 'group-hover/link:opacity-100 group-hover/link:translate-x-0' : 'group-hover/link:opacity-100 group-hover/link:translate-x-0'}`}>
                    arrow_forward
                  </span>
                )}
              </Link>
              {isCollapsed && showTooltip === 'bookings' && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in fade-in slide-in-from-left-1 duration-200">
                  Bookings
                </div>
              )}
            </div>
            <div 
              className="relative"
              onMouseEnter={() => isCollapsed && setShowTooltip('reports')}
              onMouseLeave={() => setShowTooltip(null)}
            >
              <Link className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group/link ${isHotelReportsActive ? 'bg-primary/10 text-primary hover:shadow-md hover:shadow-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'} ${isCollapsed ? 'justify-center' : ''}`} href={hotelReportsHref}>
                <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${isCollapsed ? 'group-hover/link:scale-125' : ''}`}>analytics</span>
                <p className={`text-sm font-medium transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-75'}`}>Reports</p>
                {!isCollapsed && (
                  <span className={`material-symbols-outlined text-[16px] ml-auto opacity-0 -translate-x-2 transition-all duration-300 ${isHotelReportsActive ? 'group-hover/link:opacity-100 group-hover/link:translate-x-0' : 'group-hover/link:opacity-100 group-hover/link:translate-x-0'}`}>
                    arrow_forward
                  </span>
                )}
              </Link>
              {isCollapsed && showTooltip === 'reports' && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in fade-in slide-in-from-left-1 duration-200">
                  Reports
                </div>
              )}
            </div>
          </>
        )}
        {isCorporatePortal && (
          <div 
            className="relative"
            onMouseEnter={() => isCollapsed && setShowTooltip('reports')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <Link className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group/link ${isReportsActive ? 'bg-primary/10 text-primary hover:shadow-md hover:shadow-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'} ${isCollapsed ? 'justify-center' : ''}`} href={reportsHref}>
              <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${isCollapsed ? 'group-hover/link:scale-125' : ''}`}>bar_chart</span>
              <p className={`text-sm font-medium transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-75'}`}>Reports</p>
              {!isCollapsed && (
                <span className={`material-symbols-outlined text-[16px] ml-auto opacity-0 -translate-x-2 transition-all duration-300 ${isReportsActive ? 'group-hover/link:opacity-100 group-hover/link:translate-x-0' : 'group-hover/link:opacity-100 group-hover/link:translate-x-0'}`}>
                  arrow_forward
                </span>
              )}
            </Link>
            {isCollapsed && showTooltip === 'reports' && (
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in fade-in slide-in-from-left-1 duration-200">
                Reports
              </div>
            )}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-[#e7ecf3] dark:border-slate-800">
        {/* Collapse toggle hint - shows when expanded */}
        {!isCollapsed && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary animate-pulse">lightbulb</span>
              Click logo to collapse sidebar
            </p>
          </div>
        )}
        {isCorporatePortal && (
          <div 
            className="relative mb-2"
            onMouseEnter={() => isCollapsed && setShowTooltip('settings')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <Link className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group/link ${isSettingsActive ? 'bg-primary/10 text-primary hover:shadow-md hover:shadow-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'} ${isCollapsed ? 'justify-center' : ''}`} href={settingsHref}>
              <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${isCollapsed ? 'group-hover/link:scale-125' : ''}`}>settings</span>
              <p className={`text-sm font-medium transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-75'}`}>Settings</p>
              {!isCollapsed && (
                <span className={`material-symbols-outlined text-[16px] ml-auto opacity-0 -translate-x-2 transition-all duration-300 ${isSettingsActive ? 'group-hover/link:opacity-100 group-hover/link:translate-x-0' : 'group-hover/link:opacity-100 group-hover/link:translate-x-0'}`}>
                  arrow_forward
                </span>
              )}
            </Link>
            {isCollapsed && showTooltip === 'settings' && (
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in fade-in slide-in-from-left-1 duration-200">
                Settings
              </div>
            )}
          </div>
        )}
        {isHotelFinance && (
          <div 
            className="relative mb-2"
            onMouseEnter={() => isCollapsed && setShowTooltip('hotel-profile')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <Link className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group/link ${isHotelProfileActive ? 'bg-primary/10 text-primary hover:shadow-md hover:shadow-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'} ${isCollapsed ? 'justify-center' : ''}`} href={hotelProfileHref}>
              <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${isCollapsed ? 'group-hover/link:scale-125' : ''}`}>badge</span>
              <p className={`text-sm font-medium transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-75'}`}>Hotel Profile</p>
              {!isCollapsed && (
                <span className={`material-symbols-outlined text-[16px] ml-auto opacity-0 -translate-x-2 transition-all duration-300 ${isHotelProfileActive ? 'group-hover/link:opacity-100 group-hover/link:translate-x-0' : 'group-hover/link:opacity-100 group-hover/link:translate-x-0'}`}>
                  arrow_forward
                </span>
              )}
            </Link>
            {isCollapsed && showTooltip === 'hotel-profile' && (
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in fade-in slide-in-from-left-1 duration-200">
                Hotel Profile
              </div>
            )}
          </div>
        )}
        <div 
          className="relative"
          onMouseEnter={() => isCollapsed && setShowTooltip('logout')}
          onMouseLeave={() => setShowTooltip(null)}
        >
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-300 group/link ${isCollapsed ? 'justify-center' : ''}`}
          >
            <span className={`material-symbols-outlined text-[22px] transition-all duration-300 group-hover/link:-translate-x-1 ${isCollapsed ? 'group-hover/link:scale-125 group-hover/link:translate-x-0' : ''}`}>logout</span>
            <p className={`text-sm font-medium transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 delay-75'}`}>Log Out</p>
          </button>
          {isCollapsed && showTooltip === 'logout' && (
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-red-600 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in fade-in slide-in-from-left-1 duration-200">
              Log Out
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
