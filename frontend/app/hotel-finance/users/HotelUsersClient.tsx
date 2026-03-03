"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import Header from '@/app/components/Header'
import {
  tokenStorage,
  fetchHotelUsers,
  createHotelUser,
  updateHotelUser,
  deleteHotelUser,
  getUserRoleFromStorage,
  type PortalUser,
  type PortalUserPayload
} from '@/lib/auth'

const HOTEL_SIDEBAR_PAGES = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', description: 'Overview & analytics' },
  { key: 'organizations', label: 'Organizations', icon: 'corporate_fare', description: 'Corporate clients' },
  { key: 'bookings', label: 'Bookings', icon: 'hotel', description: 'Room reservations' },
  { key: 'reports', label: 'Reports', icon: 'bar_chart', description: 'Financial reports' },
  { key: 'profile', label: 'Hotel Profile', icon: 'settings', description: 'Hotel settings' },
]

export default function HotelUsersClient() {
  const router = useRouter()
  const [users, setUsers] = useState<PortalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<PortalUser | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<'admin' | 'user'>('user')
  const [formPages, setFormPages] = useState<string[]>([])
  const [formError, setFormError] = useState('')

  useEffect(() => {
    const token = tokenStorage.get()
    if (!token) {
      router.replace('/hotel-finance/login')
      return
    }
    const meta = getUserRoleFromStorage()
    if (meta.role !== 'admin' || meta.isSubUser) {
      router.replace('/hotel-finance')
      return
    }
    loadUsers()
  }, [router])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await fetchHotelUsers()
      setUsers(data.users)
    } catch (err: any) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormRole('user')
    setFormPages([])
    setFormError('')
    setShowModal(true)
  }

  const openEditModal = (user: PortalUser) => {
    setEditingUser(user)
    setFormName(user.full_name)
    setFormEmail(user.email)
    setFormRole(user.role as 'admin' | 'user')
    setFormPages(user.allowed_pages || [])
    setFormError('')
    setShowModal(true)
  }

  const togglePage = (pageKey: string) => {
    setFormPages(prev =>
      prev.includes(pageKey)
        ? prev.filter(p => p !== pageKey)
        : [...prev, pageKey]
    )
  }

  const handleSave = async () => {
    setFormError('')
    if (!formName.trim()) { setFormError('Name is required'); return }
    if (!editingUser && !formEmail.trim()) { setFormError('Email is required'); return }

    setSaving(true)
    try {
      if (editingUser) {
        await updateHotelUser(editingUser.id, {
          fullName: formName.trim(),
          role: formRole,
          allowedPages: formRole === 'admin' ? [] : formPages
        })
      } else {
        await createHotelUser({
          fullName: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
          allowedPages: formRole === 'admin' ? [] : formPages
        })
      }
      setShowModal(false)
      await loadUsers()
    } catch (err: any) {
      setFormError(err.message || 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user: PortalUser) => {
    try {
      await updateHotelUser(user.id, { isActive: !user.is_active })
      await loadUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to update user')
    }
  }

  const handleDelete = async (user: PortalUser) => {
    if (!confirm(`Delete user "${user.full_name}"? This cannot be undone.`)) return
    try {
      await deleteHotelUser(user.id)
      await loadUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to delete user')
    }
  }

  return (
    <div className="flex h-screen bg-[#f8fafb] dark:bg-[#0f1623]">
      <Sidebar title="Hotel Finance" logoIcon="hotel" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[#0d131b] dark:text-white">Users</h1>
                <p className="text-sm text-slate-500 mt-1">Manage portal users and their access permissions</p>
              </div>
              <button
                type="button"
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
              >
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                Add User
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <span className="material-symbols-outlined text-[48px] mb-3 block opacity-40">group</span>
                <p className="text-lg font-medium">No users yet</p>
                <p className="text-sm mt-1">Add users to grant them portal access</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#161f2c] rounded-xl border border-[#e7ecf3] dark:border-slate-800 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e7ecf3] dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Access</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e7ecf3] dark:divide-slate-800">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-[#0d131b] dark:text-white">{user.full_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {user.role === 'admin' ? 'All Pages' : (user.allowed_pages?.length > 0 ? user.allowed_pages.join(', ') : 'None')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => openEditModal(user)} className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Edit">
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button type="button" onClick={() => handleToggleActive(user)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title={user.is_active ? 'Deactivate' : 'Activate'}>
                              <span className="material-symbols-outlined text-[18px]">{user.is_active ? 'person_off' : 'person'}</span>
                            </button>
                            <button type="button" onClick={() => handleDelete(user)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Delete">
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-[#161f2c] rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto animate-modal-slide" onClick={e => e.stopPropagation()}>
            {/* Header with avatar preview */}
            <div className="relative bg-gradient-to-br from-primary/5 via-primary/10 to-blue-50 dark:from-primary/10 dark:via-primary/5 dark:to-slate-800 px-6 pt-6 pb-5 rounded-t-2xl">
              <button type="button" onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-white/60 dark:hover:bg-slate-700/60 transition-all">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
              <div className="flex items-center gap-4">
                {/* Avatar preview */}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ${formName.trim() ? 'bg-gradient-to-br from-primary to-blue-600' : 'bg-slate-300 dark:bg-slate-600'} transition-all duration-300`}>
                  {formName.trim() ? formName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : (
                    <span className="material-symbols-outlined text-[24px] text-white/70">person</span>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#0d131b] dark:text-white">
                    {editingUser ? 'Edit User' : 'Add New User'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {editingUser ? 'Update user details and permissions' : 'Create a new portal user with access permissions'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {formError && (
                <div className="flex items-center gap-2.5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-sm">
                  <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Personal Information Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px] text-primary">badge</span>
                  <h3 className="text-sm font-semibold text-[#0d131b] dark:text-white uppercase tracking-wider">Personal Information</h3>
                </div>
                <div className="space-y-3">
                  <div className="relative">
                    <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">person</span>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#e7ecf3] dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/60 text-[#0d131b] dark:text-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="Full name"
                    />
                  </div>
                  {!editingUser && (
                    <div>
                      <div className="relative">
                        <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">mail</span>
                        <input
                          type="email"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-[#e7ecf3] dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/60 text-[#0d131b] dark:text-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          placeholder="Email address"
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 ml-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">info</span>
                        Login credentials will be sent to this email
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Role Selection Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px] text-primary">shield_person</span>
                  <h3 className="text-sm font-semibold text-[#0d131b] dark:text-white uppercase tracking-wider">Role</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormRole('user')}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                      formRole === 'user'
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                        : 'border-[#e7ecf3] dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {formRole === 'user' && (
                      <span className="absolute top-2 right-2 material-symbols-outlined filled text-primary text-[16px] animate-checkmark-pop">check_circle</span>
                    )}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formRole === 'user' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <span className={`material-symbols-outlined text-[20px] ${formRole === 'user' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>person</span>
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-semibold ${formRole === 'user' ? 'text-primary' : 'text-[#0d131b] dark:text-white'}`}>User</p>
                      <p className="text-xs text-slate-500 mt-0.5">Selected pages only</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRole('admin')}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                      formRole === 'admin'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10 shadow-sm'
                        : 'border-[#e7ecf3] dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {formRole === 'admin' && (
                      <span className="absolute top-2 right-2 material-symbols-outlined filled text-purple-500 text-[16px] animate-checkmark-pop">check_circle</span>
                    )}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formRole === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <span className={`material-symbols-outlined text-[20px] ${formRole === 'admin' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>shield_person</span>
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-semibold ${formRole === 'admin' ? 'text-purple-600' : 'text-[#0d131b] dark:text-white'}`}>Admin</p>
                      <p className="text-xs text-slate-500 mt-0.5">Full access + manage users</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Page Access Section */}
              {formRole === 'user' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">lock_open</span>
                      <h3 className="text-sm font-semibold text-[#0d131b] dark:text-white uppercase tracking-wider">Page Access</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (formPages.length === HOTEL_SIDEBAR_PAGES.length) {
                          setFormPages([])
                        } else {
                          setFormPages(HOTEL_SIDEBAR_PAGES.map(p => p.key))
                        }
                      }}
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      {formPages.length === HOTEL_SIDEBAR_PAGES.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {HOTEL_SIDEBAR_PAGES.map(page => {
                      const isChecked = formPages.includes(page.key)
                      return (
                        <label
                          key={page.key}
                          className={`flex items-center justify-between px-3.5 py-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                            isChecked
                              ? 'border-primary/30 bg-primary/5 dark:bg-primary/10 dark:border-primary/20'
                              : 'border-[#e7ecf3] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isChecked ? 'bg-primary/10 dark:bg-primary/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                              <span className={`material-symbols-outlined text-[18px] ${isChecked ? 'text-primary' : 'text-slate-400'}`}>{page.icon}</span>
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${isChecked ? 'text-[#0d131b] dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{page.label}</p>
                              <p className="text-xs text-slate-400">{page.description}</p>
                            </div>
                          </div>
                          {/* Toggle switch */}
                          <div className={`toggle-switch ${isChecked ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`} onClick={(e) => { e.preventDefault(); togglePage(page.key) }}>
                            <span className={`toggle-switch-dot ${isChecked ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                          <input type="checkbox" checked={isChecked} onChange={() => togglePage(page.key)} className="sr-only" />
                        </label>
                      )
                    })}
                  </div>
                  {formPages.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1 ml-1">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      Select at least one page to grant access
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#e7ecf3] dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 rounded-b-2xl">
              <div className="text-xs text-slate-400">
                {formRole === 'admin' ? (
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">verified</span> Full access to all pages</span>
                ) : (
                  <span>{formPages.length} of {HOTEL_SIDEBAR_PAGES.length} pages selected</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-[#e7ecf3] dark:border-slate-700 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm hover:shadow-md disabled:shadow-none"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">{editingUser ? 'save' : 'person_add'}</span>
                      {editingUser ? 'Update User' : 'Create User'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
