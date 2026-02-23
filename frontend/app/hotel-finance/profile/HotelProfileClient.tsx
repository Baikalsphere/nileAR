"use client"

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import { fetchHotelProfile, tokenStorage, updateHotelProfile, uploadHotelLogo } from '@/lib/auth'

export default function HotelProfileClient() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [hotelName, setHotelName] = useState('')
  const [gst, setGst] = useState('')
  const [location, setLocation] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')

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
        setGst(response.profile.gst ?? '')
        setLocation(response.profile.location ?? '')
        setLogoUrl(response.profile.logoUrl)
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
      setLogoFile(null)
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
        gst: gst || null,
        location: location || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        address: address || null
      })

      setHotelName(response.profile.hotelName ?? '')
      setGst(response.profile.gst ?? '')
      setLocation(response.profile.location ?? '')
      setLogoUrl(response.profile.logoUrl)
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
                        {logoUrl ? (
                          <img src={logoUrl} alt="Hotel logo" className="size-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                        ) : (
                          <div className="size-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                            <span className="material-symbols-outlined">image</span>
                          </div>
                        )}
                        <div className="flex-1 grid gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
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
          </div>
        </div>
      </main>
    </div>
  )
}
