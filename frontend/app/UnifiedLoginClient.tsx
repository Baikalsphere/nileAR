"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { login, tokenStorage } from "@/lib/auth"
import { corporateTokenStorage, loginCorporate } from "@/lib/corporateAuth"

const getHotelDestinationByRole = (role: string) => {
  const normalizedRole = role.trim().toLowerCase()
  if (normalizedRole === "corporate_portal_user" || normalizedRole.startsWith("corporate_")) {
    return "/corporate-portal"
  }

  return "/hotel-finance"
}

const isFallbackEligibleHotelError = (message: string) => {
  const normalized = message.toLowerCase()
  return normalized.includes("invalid credentials") || normalized.includes("invalid email") || normalized.includes("request failed")
}

export default function UnifiedLoginClient() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const normalizedIdentifier = identifier.trim()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const canTryHotelLogin = normalizedIdentifier.includes("@")

    try {
      if (canTryHotelLogin) {
        try {
          const hotelResponse = await login(normalizedIdentifier, password)
          corporateTokenStorage.clear()
          router.push(getHotelDestinationByRole(hotelResponse.user.role))
          return
        } catch (hotelError) {
          const hotelMessage = hotelError instanceof Error ? hotelError.message : "Login failed"
          if (!isFallbackEligibleHotelError(hotelMessage)) {
            setError(hotelMessage)
            return
          }
        }
      }

      const corporateResponse = await loginCorporate(normalizedIdentifier, password)
      tokenStorage.clear()

      if (corporateResponse.mustSetPassword) {
        router.push("/corporate-portal/settings?onboarding=1")
        return
      }

      router.push("/corporate-portal")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed"
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-background-dark dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-20 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        <div className="absolute -inset-1 rounded-[30px] bg-gradient-to-r from-blue-500/30 via-indigo-500/20 to-primary/30 blur-md"></div>
        <section className="relative rounded-[28px] border border-white/60 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl p-7 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-primary text-xs font-bold tracking-wide">
              <span className="material-symbols-outlined text-[16px]">lock</span>
              Secure Access
            </div>
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300">
              <span className="material-symbols-outlined text-[16px]">bolt</span>
            </span>
          </div>

          <h1 className="mt-5 text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Welcome back
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Sign in with your credentials to continue.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 px-2.5 py-2 text-center text-slate-600 dark:text-slate-300">
              <span className="material-symbols-outlined text-[16px] align-middle mr-1">apartment</span>
              Corporate
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 px-2.5 py-2 text-center text-slate-600 dark:text-slate-300">
              <span className="material-symbols-outlined text-[16px] align-middle mr-1">domain</span>
              Hotel
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 px-2.5 py-2 text-center text-slate-600 dark:text-slate-300">
              <span className="material-symbols-outlined text-[16px] align-middle mr-1">verified_user</span>
              Secure
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500" htmlFor="unified-identifier">
                Email or User ID
              </label>
              <input
                id="unified-identifier"
                name="identifier"
                type="text"
                placeholder="you@company.com or CORP-ABC123"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500" htmlFor="unified-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="unified-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-4 pr-12 py-3 text-sm font-medium text-slate-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-primary transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 block w-full rounded-xl bg-gradient-to-r from-primary to-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:from-blue-700 hover:to-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Log in"}
            </button>
          </form>

          <p className="mt-5 text-xs text-slate-500 dark:text-slate-400 text-center">
            Authentication is secure and routing is automatic.
          </p>
        </section>
      </div>
    </main>
  )
}
