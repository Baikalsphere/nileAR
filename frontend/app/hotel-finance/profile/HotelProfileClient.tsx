"use client"

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import { changeHotelPassword, changePortalUserPassword, fetchHotelProfile, getUserRoleFromStorage, tokenStorage, updateHotelProfile, uploadHotelLogo } from '@/lib/auth'

export default function HotelProfileClient() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [hotelName, setHotelName] = useState('')
  const [entityName, setEntityName] = useState('')
  const [gst, setGst] = useState('')
  const [location, setLocation] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [isLogoLoadFailed, setIsLogoLoadFailed] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl)
      }
    }
  }, [logoPreviewUrl])

  useEffect(() => {
    const token = tokenStorage.get()
    if (!token) {
      router.replace('/hotel-finance/login')
      return
    }

    const loadProfile = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetchHotelProfile()
        setHotelName(response.profile.hotelName ?? '')
        setEntityName(response.profile.entityName ?? '')
        setGst(response.profile.gst ?? '')
        setLocation(response.profile.location ?? '')
        setLogoUrl(response.profile.logoUrl)
        setIsLogoLoadFailed(false)
        setContactEmail(response.profile.contactEmail ?? '')
        setContactPhone(response.profile.contactPhone ?? '')
        setAddress(response.profile.address ?? '')
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load profile'
        setError(message)

        if (message.toLowerCase().includes('unauthorized')) {
          tokenStorage.clear()
          router.replace('/hotel-finance/login')
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfile()
  }, [router])

  const handleUploadLogo = async () => {
    if (!logoFile) {
      setError('Please select an image before uploading.')
      return
    }

    setError(null)
    setSuccess(null)
    setIsUploadingLogo(true)

    try {
      const response = await uploadHotelLogo(logoFile)
      setLogoUrl(response.profile.logoUrl)
      setIsLogoLoadFailed(false)
      setLogoFile(null)
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl)
      }
      setLogoPreviewUrl(null)
      setSuccess('Logo uploaded successfully.')
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Failed to upload logo'
      setError(message)
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const response = await updateHotelProfile({
        hotelName,
        entityName: entityName || null,
        gst: gst || null,
        location: location || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        address: address || null
      })

      setHotelName(response.profile.hotelName ?? '')
      setEntityName(response.profile.entityName ?? '')
      setGst(response.profile.gst ?? '')
      setLocation(response.profile.location ?? '')
      setLogoUrl(response.profile.logoUrl)
      setIsLogoLoadFailed(false)
      setContactEmail(response.profile.contactEmail ?? '')
      setContactPhone(response.profile.contactPhone ?? '')
      setAddress(response.profile.address ?? '')
      setSuccess('Hotel profile updated successfully.')
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to update profile'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null

    if (selected) {
      const maxBytes = 5 * 1024 * 1024
      if (!selected.type.toLowerCase().startsWith('image/')) {
        setError('Only image files are allowed for logo upload.')
        event.target.value = ''
        return
      }

      if (selected.size > maxBytes) {
        setError('Logo must be 5MB or smaller.')
        event.target.value = ''
        return
      }
    }

    setError(null)
    setLogoFile(selected)

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl)
    }

    if (selected) {
      setLogoPreviewUrl(URL.createObjectURL(selected))
      return
    }

    setLogoPreviewUrl(null)
  }

  const handleLogoPreviewError = () => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl)
      setLogoPreviewUrl(null)
      return
    }

    setIsLogoLoadFailed(true)
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    const { currentPassword, newPassword, confirmPassword } = passwordForm
    if (!currentPassword) {
      setPasswordError('Current password is required.')
      return
    }

    if (newPassword.length < 12 || confirmPassword.length < 12) {
      setPasswordError('New password and confirmation must be at least 12 characters.')
      return
    }

    const hasComplexity = [
      /[a-z]/.test(newPassword),
      /[A-Z]/.test(newPassword),
      /[0-9]/.test(newPassword),
      /[^A-Za-z0-9]/.test(newPassword)
    ].every(Boolean)

    if (!hasComplexity) {
      setPasswordError('Password must include upper, lower, number, and symbol characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password must match.')
      return
    }

    setIsChangingPassword(true)
    try {
      await changePortalUserPassword({
        currentPassword,
        newPassword,
        confirmPassword
      })

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setPasswordSuccess('Password changed successfully.')
    } catch (passwordSubmitError) {
      const message = passwordSubmitError instanceof Error ? passwordSubmitError.message : 'Failed to change password'
      setPasswordError(message)
    } finally {
      setIsChangingPassword(false)
    }
  }

  const visibleLogoUrl = logoPreviewUrl ?? logoUrl

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar title="Hotel Finance" logoIcon="domain" />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="mx-auto max-w-4xl flex flex-col gap-6">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-text-main-light dark:text-text-main-dark">Hotel Profile</h1>
              <p className="text-text-sub-light dark:text-text-sub-dark mt-1">Update your hotel details used across invoices and corporate portal views.</p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-300">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {isLoading ? (
                <div className="py-8 text-sm text-text-sub-light dark:text-text-sub-dark">Loading profile...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">Hotel Name</label>
                    <input
                      required
                      value={hotelName}
                      onChange={(event) => setHotelName(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="Enter hotel name"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">Entity Name</label>
                    <input
                      value={entityName}
                      onChange={(event) => setEntityName(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="Legal / registered entity name"
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">The legal entity name used on invoices and contracts.</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">GST</label>
                    <input
                      value={gst}
                      onChange={(event) => setGst(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="GST Number"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">Location</label>
                    <input
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="City, State"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">Hotel Logo</label>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                      <div className="flex items-center gap-4">
                        {visibleLogoUrl && !isLogoLoadFailed ? (
                          <img
                            src={visibleLogoUrl}
                            alt="Hotel logo"
                            onError={handleLogoPreviewError}
                            className="size-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="size-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                            <span className="material-symbols-outlined">image</span>
                          </div>
                        )}
                        <div className="flex-1 grid gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoFileChange}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Recommended: PNG/JPG/WebP, square logo, maximum 5MB.
                          </p>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleUploadLogo}
                              disabled={!logoFile || isUploadingLogo}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <span className="material-symbols-outlined text-[18px]">upload</span>
                              {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">Phone</label>
                    <input
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="Phone number"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">Email</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="finance@hotel.com"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">Address</label>
                    <input
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="Hotel address"
                    />
                  </div>

                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading || isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>

            <form onSubmit={handlePasswordSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-xl font-bold text-text-main-light dark:text-text-main-dark">Change Password</h2>
                  <p className="mt-1 text-sm text-text-sub-light dark:text-text-sub-dark">Update your hotel finance account password.</p>
                </div>

                {passwordError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-300">
                    {passwordSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">Current Password</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="Enter current password"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">New Password</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="Enter new password"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">Confirm Password</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span className="material-symbols-outlined text-[18px]">password</span>
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
