"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Sidebar from "@/app/components/Sidebar"
import Header from "@/app/components/Header"
import {
  corporateTokenStorage,
  fetchCorporateProfile,
  setCorporatePassword,
  updateCorporateProfile,
  changeCorporateUserPassword
} from "@/lib/corporateAuth"

interface CompanyForm {
  name: string
  registrationNumber: string
  address: string
  contactEmail: string
  phone: string
}

const emptyCompanyForm: CompanyForm = {
  name: "",
  registrationNumber: "",
  address: "",
  contactEmail: "",
  phone: ""
}

export default function SettingsClient() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState("company-details")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [mustSetPassword, setMustSetPassword] = useState(false)
  const [isSettingPassword, setIsSettingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" })

  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm)
  const [isOnboarding, setIsOnboarding] = useState(false)

  const [changePwForm, setChangePwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })
  const [isChangingPw, setIsChangingPw] = useState(false)
  const [changePwError, setChangePwError] = useState<string | null>(null)
  const [changePwSuccess, setChangePwSuccess] = useState<string | null>(null)

  const [taxId, setTaxId] = useState("9918USA29910Z1")
  const [notifications, setNotifications] = useState({
    invoiceAlerts: true,
    paymentReminders: true
  })

  const authorizedPayers = [
    {
      id: 1,
      name: "John Doe",
      role: "Primary Admin",
      email: "admin@acme.com",
      status: "Active"
    },
    {
      id: 2,
      name: "Sarah Smith",
      role: "Finance Manager",
      email: "finance@acme.com",
      status: "Active"
    },
    {
      id: 3,
      name: "Mike Johnson",
      role: "Travel Coordinator",
      email: "travel@acme.com",
      status: "Inactive"
    }
  ]

  useEffect(() => {
    const token = corporateTokenStorage.get()
    if (!token) {
      router.replace("/corporate-portal/login")
      return
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      setIsOnboarding(params.get("onboarding") === "1")
    }

    const loadProfile = async () => {
      setIsLoading(true)
      setLoadError(null)

      try {
        const data = await fetchCorporateProfile()
        setCompanyForm({
          name: data.profile.name,
          registrationNumber: data.profile.registrationNumber ?? "",
          address: data.profile.address ?? "",
          contactEmail: data.profile.contactEmail ?? "",
          phone: data.profile.phone ?? ""
        })
        setMustSetPassword(data.mustSetPassword)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load company details"
        setLoadError(message)

        if (message.toLowerCase().includes("unauthorized")) {
          corporateTokenStorage.clear()
          router.replace("/corporate-portal/login")
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfile()
  }, [router])

  const updateCompanyField = (field: keyof CompanyForm, value: string) => {
    setCompanyForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaveMessage(null)
    setSaveError(null)
    setIsSavingProfile(true)

    try {
      const response = await updateCorporateProfile({
        name: companyForm.name,
        registrationNumber: companyForm.registrationNumber,
        address: companyForm.address,
        contactEmail: companyForm.contactEmail,
        phone: companyForm.phone
      })

      setCompanyForm({
        name: response.profile.name,
        registrationNumber: response.profile.registrationNumber ?? "",
        address: response.profile.address ?? "",
        contactEmail: response.profile.contactEmail ?? "",
        phone: response.profile.phone ?? ""
      })
      setSaveMessage("Company details saved successfully.")
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save company details")
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordMessage(null)

    const { newPassword, confirmPassword } = passwordForm
    if (newPassword.length < 12 || confirmPassword.length < 12) {
      setPasswordError("Password must be at least 12 characters long")
      return
    }

    const checks = [
      /[a-z]/.test(newPassword),
      /[A-Z]/.test(newPassword),
      /[0-9]/.test(newPassword),
      /[^A-Za-z0-9]/.test(newPassword)
    ]

    if (checks.some((ok) => !ok)) {
      setPasswordError("Password must include upper, lower, number, and symbol characters")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    setIsSettingPassword(true)

    try {
      const result = await setCorporatePassword(newPassword, confirmPassword)
      setMustSetPassword(result.mustSetPassword)
      setPasswordForm({ newPassword: "", confirmPassword: "" })
      setPasswordMessage("Password updated. You can now use your company email and new password for login.")
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Unable to set password")
    } finally {
      setIsSettingPassword(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
        <Sidebar title="Corporate Portal" logoIcon="apartment" />
        <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">Loading company settings...</div>
      </div>
    )
  }

  const onboardingHint = isOnboarding || mustSetPassword
    ? "First login detected. Please complete company details and set your own password."
    : null

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white overflow-hidden">
      <Sidebar title="Corporate Portal" logoIcon="apartment" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl flex flex-col gap-6">
              <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <a href="/corporate-portal" className="hover:text-primary transition-colors">
                  Home
                </a>
                <span className="material-symbols-outlined icon-sm">chevron_right</span>
                <span className="font-medium text-slate-900 dark:text-white">Settings</span>
              </nav>

              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
                    Settings & Preferences
                  </h1>
                  <p className="mt-2 text-base text-slate-500 dark:text-slate-400 max-w-3xl">
                    Manage your company details, authorized payers, billing information, and notification settings for your corporate account.
                  </p>
                </div>
                <div className="flex md:justify-end">
                  <button className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
                    <span className="material-symbols-outlined icon-sm">help</span>
                    Support
                  </button>
                </div>
              </div>

              {onboardingHint && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                  {onboardingHint}
                </div>
              )}

              {loadError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                  {loadError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <aside className="lg:col-span-3 lg:sticky lg:top-24">
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary">apartment</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{companyForm.name || "Company"}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Enterprise Account</p>
                      </div>
                    </div>
                    <nav className="flex flex-col p-2 gap-1">
                      <button
                        onClick={() => setActiveTab("company-details")}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          activeTab === "company-details"
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <span className="material-symbols-outlined icon-sm fill">business</span>
                        Company Details
                      </button>
                      <button
                        onClick={() => setActiveTab("authorized-payers")}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          activeTab === "authorized-payers"
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <span className="material-symbols-outlined icon-sm">group</span>
                        Authorized Payers
                      </button>
                      <button
                        onClick={() => setActiveTab("billing-tax")}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          activeTab === "billing-tax"
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <span className="material-symbols-outlined icon-sm">credit_card</span>
                        Billing & Tax
                      </button>
                      <button
                        onClick={() => setActiveTab("notifications")}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          activeTab === "notifications"
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <span className="material-symbols-outlined icon-sm">notifications</span>
                        Notifications
                      </button>
                      <button
                        onClick={() => setActiveTab("change-password")}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          activeTab === "change-password"
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <span className="material-symbols-outlined icon-sm">lock</span>
                        Change Password
                      </button>
                    </nav>
                  </div>
                </aside>

                <main className="lg:col-span-9 flex flex-col gap-6">
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col sm:flex-row gap-5 items-start">
                    <div className="h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 rounded-xl bg-primary/10 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-4xl">apartment</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 truncate">{companyForm.name || "Company"}</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <p className="text-slate-500 dark:text-slate-400">
                          Contact email: <span className="font-medium text-slate-900 dark:text-slate-200">{companyForm.contactEmail || "Not set"}</span>
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">
                          Registration: <span className="font-medium text-slate-900 dark:text-slate-200">{companyForm.registrationNumber || "Not set"}</span>
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 md:col-span-2">
                          Phone: <span className="font-medium text-slate-900 dark:text-slate-200">{companyForm.phone || "Not set"}</span>
                        </p>
                      </div>
                      <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-semibold border border-green-100 dark:border-green-800">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Active Account
                      </div>
                    </div>
                  </div>

                  {activeTab === "company-details" && (
                    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <form onSubmit={handleSaveCompany}>
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Company Information</h3>
                          <button
                            type="submit"
                            disabled={isSavingProfile}
                            className="text-sm font-semibold text-primary disabled:opacity-60"
                          >
                            {isSavingProfile ? "Saving..." : "Save Changes"}
                          </button>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-900 dark:text-slate-300">Company Name</label>
                            <input
                              type="text"
                              value={companyForm.name}
                              onChange={(e) => updateCompanyField("name", e.target.value)}
                              required
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-900 dark:text-slate-300">Registration Number</label>
                            <input
                              type="text"
                              value={companyForm.registrationNumber}
                              onChange={(e) => updateCompanyField("registrationNumber", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-slate-900 dark:text-slate-300">Registered Address</label>
                            <input
                              type="text"
                              value={companyForm.address}
                              onChange={(e) => updateCompanyField("address", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-900 dark:text-slate-300">Contact Email</label>
                            <div className="relative">
                              <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 icon-sm">mail</span>
                              <input
                                type="email"
                                value={companyForm.contactEmail}
                                onChange={(e) => updateCompanyField("contactEmail", e.target.value)}
                                className="w-full pl-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-900 dark:text-slate-300">Phone Number</label>
                            <div className="relative">
                              <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 icon-sm">call</span>
                              <input
                                type="tel"
                                value={companyForm.phone}
                                onChange={(e) => updateCompanyField("phone", e.target.value)}
                                className="w-full pl-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                              />
                            </div>
                          </div>

                          {saveError && (
                            <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                              {saveError}
                            </div>
                          )}

                          {saveMessage && (
                            <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                              {saveMessage}
                            </div>
                          )}
                        </div>
                      </form>

                      {mustSetPassword && (
                        <div className="px-6 pb-6">
                          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Set Your Password</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Set your own password now. After this, you can login with your contact email.</p>

                            <form className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4" onSubmit={handleSetPassword}>
                              <input
                                type="password"
                                value={passwordForm.newPassword}
                                onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                                minLength={12}
                                required
                                placeholder="New password"
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm"
                              />
                              <input
                                type="password"
                                value={passwordForm.confirmPassword}
                                onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                                minLength={12}
                                required
                                placeholder="Confirm password"
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm"
                              />

                              {passwordError && (
                                <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                  {passwordError}
                                </div>
                              )}

                              {passwordMessage && (
                                <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                                  {passwordMessage}
                                </div>
                              )}

                              <div className="md:col-span-2">
                                <button
                                  type="submit"
                                  disabled={isSettingPassword}
                                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {isSettingPassword ? "Setting Password..." : "Set Password"}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {activeTab === "billing-tax" && (
                    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Billing & Tax</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your tax identification and payment methods.</p>
                      </div>
                      <div className="p-6 space-y-6">
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                          <div className="flex-1 space-y-2 w-full">
                            <label className="text-sm font-medium text-slate-900 dark:text-slate-300">GSTIN / VAT Number</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={taxId}
                                onChange={(e) => setTaxId(e.target.value)}
                                className="w-full rounded-lg border border-green-500 bg-green-50 dark:bg-green-900/10 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition-all"
                              />
                              <span className="material-symbols-outlined absolute right-3 top-2.5 text-green-600 icon-sm">check_circle</span>
                            </div>
                            <p className="text-xs text-green-600 font-medium">Verified Tax ID</p>
                          </div>
                          <button className="h-[42px] px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            Request Update
                          </button>
                        </div>
                      </div>
                    </section>
                  )}

                  {activeTab === "authorized-payers" && (
                    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 justify-between items-center">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Authorized Payers</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Personnel authorized to book stays and process invoices.</p>
                        </div>
                        <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-primary/20">
                          <span className="material-symbols-outlined icon-sm">person_add</span>
                          Add Payer
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                              <th className="p-4">Name</th>
                              <th className="p-4">Role</th>
                              <th className="p-4">Email</th>
                              <th className="p-4">Status</th>
                              <th className="p-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                            {authorizedPayers.map((payer) => (
                              <tr key={payer.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                                <td className="p-4 font-medium text-slate-900 dark:text-white">{payer.name}</td>
                                <td className="p-4 text-slate-500 dark:text-slate-400">{payer.role}</td>
                                <td className="p-4 text-slate-500 dark:text-slate-400">{payer.email}</td>
                                <td className="p-4">
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                      payer.status === "Active"
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                                    }`}
                                  >
                                    {payer.status}
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <button className="text-slate-500 hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined icon-sm">more_vert</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {activeTab === "notifications" && (
                    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-10">
                      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Notification Preferences</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Choose how and when you want to be notified.</p>
                      </div>
                      <div className="p-6 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-4">
                            <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                              <span className="material-symbols-outlined icon-sm">receipt_long</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">New Invoice Generated</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Receive an email when a new invoice is ready for payment.</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={notifications.invoiceAlerts}
                              onChange={(e) => setNotifications({ ...notifications, invoiceAlerts: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                          </label>
                        </div>

                        <hr className="border-slate-200 dark:border-slate-700" />

                        <div className="flex items-center justify-between">
                          <div className="flex gap-4">
                            <div className="h-10 w-10 rounded-full bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 flex items-center justify-center">
                              <span className="material-symbols-outlined icon-sm">event_upcoming</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">Payment Due Reminders</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Get reminded 3 days before an invoice is due.</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={notifications.paymentReminders}
                              onChange={(e) => setNotifications({ ...notifications, paymentReminders: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                          </label>
                        </div>
                      </div>
                    </section>
                  )}

                  {activeTab === "change-password" && (
                    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-10">
                      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Change Password</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Update your login password. You&apos;ll need to enter your current password first.</p>
                      </div>
                      <form
                        className="p-6 flex flex-col gap-5 max-w-lg"
                        onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                          e.preventDefault()
                          setChangePwError(null)
                          setChangePwSuccess(null)

                          const { currentPassword, newPassword, confirmPassword } = changePwForm
                          if (!currentPassword) { setChangePwError("Current password is required"); return }
                          if (newPassword.length < 8) { setChangePwError("New password must be at least 8 characters"); return }
                          if (newPassword !== confirmPassword) { setChangePwError("Passwords do not match"); return }

                          setIsChangingPw(true)
                          try {
                            await changeCorporateUserPassword({ currentPassword, newPassword, confirmPassword })
                            setChangePwSuccess("Password changed successfully.")
                            setChangePwForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
                          } catch (err) {
                            setChangePwError(err instanceof Error ? err.message : "Failed to change password")
                          } finally {
                            setIsChangingPw(false)
                          }
                        }}
                      >
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-900 dark:text-slate-300">Current Password</label>
                          <input
                            type="password"
                            value={changePwForm.currentPassword}
                            onChange={(e) => setChangePwForm((p) => ({ ...p, currentPassword: e.target.value }))}
                            required
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-900 dark:text-slate-300">New Password</label>
                          <input
                            type="password"
                            value={changePwForm.newPassword}
                            onChange={(e) => setChangePwForm((p) => ({ ...p, newPassword: e.target.value }))}
                            required
                            minLength={8}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-900 dark:text-slate-300">Confirm New Password</label>
                          <input
                            type="password"
                            value={changePwForm.confirmPassword}
                            onChange={(e) => setChangePwForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                            required
                            minLength={8}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          />
                        </div>

                        {changePwError && (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                            {changePwError}
                          </div>
                        )}

                        {changePwSuccess && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                            {changePwSuccess}
                          </div>
                        )}

                        <div>
                          <button
                            type="submit"
                            disabled={isChangingPw}
                            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 transition-colors"
                          >
                            {isChangingPw ? "Changing..." : "Change Password"}
                          </button>
                        </div>
                      </form>
                    </section>
                  )}
                </main>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
