"use client"

import SessionTracker from './SessionTracker'

export default function Header() {
  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-[#e7ecf3] dark:border-slate-800 bg-white dark:bg-[#161f2c] flex-shrink-0 z-10">
      <SessionTracker />
      <div className="flex items-center w-full max-w-md">
        <div className="relative w-full text-slate-400 focus-within:text-primary">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input className="block w-full rounded-lg border-none bg-slate-100 dark:bg-slate-800 py-2 pl-10 pr-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6 transition-all" placeholder="Search (Ctrl + /)" type="text" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">BaikalSphere</p>
          </div>
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-600 shadow-sm">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" opacity="0.3" stroke="white" strokeWidth="2" fill="none" />
              <circle cx="12" cy="12" r="6" opacity="0.6" stroke="white" strokeWidth="1.5" fill="none" />
              <circle cx="12" cy="12" r="3" fill="white" />
              <path d="M12 3 Q 19 8 19 12 Q 19 16 12 21" stroke="white" strokeWidth="1" opacity="0.5" fill="none" />
            </svg>
          </div>
        </div>
      </div>
    </header>
  )
}
