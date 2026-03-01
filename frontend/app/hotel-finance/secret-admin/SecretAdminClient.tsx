"use client"

import { FormEvent, useMemo, useState } from 'react'
import {
  createHotelAccountBySecret,
  verifyProvisioningSecret,
  type AdminCreatedHotelAccount
} from '@/lib/auth'

export default function SecretAdminClient() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerifyingSecret, setIsVerifyingSecret] = useState(false)
  const [isSecretVerified, setIsSecretVerified] = useState(false)

  const [provisioningSecret, setProvisioningSecret] = useState('')
  const [hotelName, setHotelName] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [createdAccount, setCreatedAccount] = useState<AdminCreatedHotelAccount | null>(null)

  const helperText = useMemo(
    () => 'Credentials are sent to the registered email, including: Visit the Hotel Profile section to update your password.',
    []
  )

  const handleVerifySecret = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setCreatedAccount(null)

    const trimmedSecret = provisioningSecret.trim()
    if (!trimmedSecret) {
      setError('Provisioning secret is required')
      return
    }

    setIsVerifyingSecret(true)
    try {
      await verifyProvisioningSecret(trimmedSecret)
      setIsSecretVerified(true)
      setSuccess('Provisioning secret verified. You can now register a hotel account.')
    } catch (verifyError) {
      const message = verifyError instanceof Error ? verifyError.message : 'Failed to verify provisioning secret'
      setError(message)
    } finally {
      setIsVerifyingSecret(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setCreatedAccount(null)
    setIsSubmitting(true)

    try {
      if (!isSecretVerified) {
        throw new Error('Verify provisioning secret first')
      }

      const trimmedSecret = provisioningSecret.trim()

      const response = await createHotelAccountBySecret(
        {
          hotelName: hotelName.trim(),
          email: email.trim(),
          fullName: fullName.trim() || undefined
        },
        trimmedSecret
      )

      setCreatedAccount(response.account)
      setSuccess(response.message)
      setHotelName('')
      setEmail('')
      setFullName('')
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to create hotel account'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background-light dark:bg-background-dark p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-main-light dark:text-text-main-dark">Secret Admin Provisioning</h1>
          <p className="text-text-sub-light dark:text-text-sub-dark mt-1">Create a new hotel account and auto-send credentials by email.</p>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-300">
            {success}
          </div>
        ) : null}

        {!isSecretVerified ? (
          <form onSubmit={handleVerifySecret} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">Provisioning Secret</label>
              <input
                required
                type="password"
                value={provisioningSecret}
                onChange={(event) => setProvisioningSecret(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Enter provisioning secret"
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={isVerifyingSecret}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                {isVerifyingSecret ? 'Verifying...' : 'Verify Secret'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-1 gap-4">
              <div>
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
                <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">Registered Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="accounts@hotel.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-text-main-light dark:text-text-main-dark">Primary Contact Name (optional)</label>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Enter contact person name"
                />
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              {helperText}
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                {isSubmitting ? 'Creating account...' : 'Create Hotel Account'}
              </button>
            </div>
          </form>
        )}

        {createdAccount ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-text-main-light dark:text-text-main-dark">Created Account</h2>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-300">
              <p><span className="font-semibold">Hotel:</span> {createdAccount.hotelName}</p>
              <p><span className="font-semibold">Email/User ID:</span> {createdAccount.email}</p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
