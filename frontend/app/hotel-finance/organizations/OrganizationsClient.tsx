"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { tokenStorage } from '@/lib/auth'

type OrganizationStatus = 'active' | 'on-hold' | 'inactive'

interface Organization {
  id: string
  name: string
  icon: string
  bgColor: string
  iconColor: string
  darkBgColor: string
  darkIconColor: string
  gst: string
  creditPeriod: string
  paymentTerms: string
  status: OrganizationStatus
  contractStatus?: 'draft' | 'sent' | 'signed' | null
  amountReceived: number
  pendingPayment: number
  initialOutstanding?: number
}

interface ApiOrganization {
  id: string
  name: string
  gst: string | null
  creditPeriod: string | null
  paymentTerms: string | null
  status: OrganizationStatus
  contractStatus?: 'draft' | 'sent' | 'signed' | null
  amountReceived?: number
  outstandingAmount?: number
  initialOutstanding?: number
}

interface GeneratedCredentials {
  userId: string
  password: string
  email: string
  organizationName: string
}

interface ExistingOrganizationLookup {
  id: string
  name: string
  gst: string | null
  creditPeriod: string | null
  paymentTerms: string | null
  status: OrganizationStatus
  corporateEmail: string
  corporateUserId: string
  isLinked: boolean
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000'

const iconThemes = [
  {
    icon: 'apartment',
    bgColor: 'bg-blue-100',
    iconColor: 'text-blue-700',
    darkBgColor: 'dark:bg-blue-900/30',
    darkIconColor: 'dark:text-blue-300'
  },
  {
    icon: 'business',
    bgColor: 'bg-indigo-100',
    iconColor: 'text-indigo-700',
    darkBgColor: 'dark:bg-indigo-900/30',
    darkIconColor: 'dark:text-indigo-300'
  },
  {
    icon: 'local_shipping',
    bgColor: 'bg-purple-100',
    iconColor: 'text-purple-700',
    darkBgColor: 'dark:bg-purple-900/30',
    darkIconColor: 'dark:text-purple-300'
  },
  {
    icon: 'event',
    bgColor: 'bg-teal-100',
    iconColor: 'text-teal-700',
    darkBgColor: 'dark:bg-teal-900/30',
    darkIconColor: 'dark:text-teal-300'
  },
  {
    icon: 'flight',
    bgColor: 'bg-orange-100',
    iconColor: 'text-orange-700',
    darkBgColor: 'dark:bg-orange-900/30',
    darkIconColor: 'dark:text-orange-300'
  }
]

const seedOrganizations: Organization[] = [
  {
    id: 'ORG-001',
    name: 'Acme Corp Hospitality',
    icon: 'apartment',
    bgColor: 'bg-blue-100',
    iconColor: 'text-blue-700',
    darkBgColor: 'dark:bg-blue-900/30',
    darkIconColor: 'dark:text-blue-300',
    gst: '27AAAAA0000A1Z5',
    creditPeriod: '30 Days',
    paymentTerms: 'Net 30',
    status: 'active',
    amountReceived: 245000,
    pendingPayment: 55000
  },
  {
    id: 'ORG-024',
    name: 'Global Tech Solutions',
    icon: 'business',
    bgColor: 'bg-indigo-100',
    iconColor: 'text-indigo-700',
    darkBgColor: 'dark:bg-indigo-900/30',
    darkIconColor: 'dark:text-indigo-300',
    gst: '07BBBBB1111B2Y6',
    creditPeriod: '45 Days',
    paymentTerms: 'Net 45',
    status: 'active',
    amountReceived: 180000,
    pendingPayment: 20000
  },
  {
    id: 'ORG-052',
    name: 'Zenith Travel Partners',
    icon: 'flight',
    bgColor: 'bg-orange-100',
    iconColor: 'text-orange-700',
    darkBgColor: 'dark:bg-orange-900/30',
    darkIconColor: 'dark:text-orange-300',
    gst: '33CCCCC2222C3X7',
    creditPeriod: '15 Days',
    paymentTerms: 'Immediate',
    status: 'on-hold',
    amountReceived: 95000,
    pendingPayment: 65000
  },
  {
    id: 'ORG-089',
    name: 'Apex Logistics',
    icon: 'local_shipping',
    bgColor: 'bg-purple-100',
    iconColor: 'text-purple-700',
    darkBgColor: 'dark:bg-purple-900/30',
    darkIconColor: 'dark:text-purple-300',
    gst: '19DDDDD3333D4W8',
    creditPeriod: '60 Days',
    paymentTerms: 'Net 60',
    status: 'active',
    amountReceived: 320000,
    pendingPayment: 0
  },
  {
    id: 'ORG-102',
    name: 'Summit Events',
    icon: 'event',
    bgColor: 'bg-teal-100',
    iconColor: 'text-teal-700',
    darkBgColor: 'dark:bg-teal-900/30',
    darkIconColor: 'dark:text-teal-300',
    gst: '22EEEEE4444E5V9',
    creditPeriod: '30 Days',
    paymentTerms: 'Net 30',
    status: 'active',
    amountReceived: 152000,
    pendingPayment: 28000
  }
]

const hashId = (value: string) =>
  value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

const toOrganization = (apiOrg: ApiOrganization): Organization => {
  const hash = hashId(apiOrg.id)
  const theme = iconThemes[hash % iconThemes.length]
  const amountReceived = Number(apiOrg.amountReceived ?? 0)
  const pendingPayment = Number(apiOrg.outstandingAmount ?? 0)

  return {
    id: apiOrg.id,
    name: apiOrg.name,
    icon: theme.icon,
    bgColor: theme.bgColor,
    iconColor: theme.iconColor,
    darkBgColor: theme.darkBgColor,
    darkIconColor: theme.darkIconColor,
    gst: apiOrg.gst ?? '-',
    creditPeriod: apiOrg.creditPeriod ?? '30 Days',
    paymentTerms: apiOrg.paymentTerms ?? 'Net 30',
    status: apiOrg.status,
    contractStatus: apiOrg.contractStatus ?? null,
    amountReceived,
    pendingPayment,
    initialOutstanding: Number(apiOrg.initialOutstanding ?? 0)
  }
}

export default function OrganizationsClient() {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [organizationName, setOrganizationName] = useState('')
  const [corporateEmail, setCorporateEmail] = useState('')
  const [gst, setGst] = useState('')
  const [creditPeriod, setCreditPeriod] = useState('30 Days')
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [registerStatus, setRegisterStatus] = useState<OrganizationStatus>('active')
  const [initialOutstanding, setInitialOutstanding] = useState('')
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isLinkingExisting, setIsLinkingExisting] = useState(false)
  const [isCheckingExisting, setIsCheckingExisting] = useState(false)
  const [existingOrganization, setExistingOrganization] = useState<ExistingOrganizationLookup | null>(null)
  const [generatedCredentials, setGeneratedCredentials] = useState<GeneratedCredentials | null>(null)
  const [isSendingCredentials, setIsSendingCredentials] = useState(false)
  const [sendCredentialsMessage, setSendCredentialsMessage] = useState<string | null>(null)
  const [sendCredentialsError, setSendCredentialsError] = useState<string | null>(null)

  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [editName, setEditName] = useState('')
  const [editGst, setEditGst] = useState('')
  const [editCreditPeriod, setEditCreditPeriod] = useState('')
  const [editPaymentTerms, setEditPaymentTerms] = useState('')
  const [editStatus, setEditStatus] = useState<OrganizationStatus>('active')
  const [editOutstanding, setEditOutstanding] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const getAuthHeaders = () => {
    const token = tokenStorage.get()
    if (!token) {
      throw new Error('Unauthorized')
    }

    return {
      Authorization: `Bearer ${token}`
    }
  }

  useEffect(() => {
    const token = tokenStorage.get()
    if (!token) {
      router.replace('/hotel-finance/login')
      return
    }

    const email = corporateEmail.trim().toLowerCase()
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

    if (!isValidEmail) {
      setExistingOrganization(null)
      setIsCheckingExisting(false)
      return
    }

    const timeoutId = window.setTimeout(async () => {
      setIsCheckingExisting(true)
      try {
        const response = await fetch(`${apiBaseUrl}/api/organizations/lookup?corporateEmail=${encodeURIComponent(email)}`, {
          credentials: 'include',
          headers: {
            ...getAuthHeaders()
          }
        })

        if (!response.ok) {
          throw new Error('Failed to check existing organization')
        }

        const data = (await response.json()) as {
          found: boolean
          organization?: ExistingOrganizationLookup
        }

        if (data.found && data.organization) {
          setExistingOrganization(data.organization)
          setOrganizationName(data.organization.name)
          setGst(data.organization.gst ?? '')
          setCreditPeriod(data.organization.creditPeriod ?? '')
          setPaymentTerms(data.organization.paymentTerms ?? '')
          setRegisterStatus(data.organization.status)
        } else {
          setExistingOrganization(null)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to check existing organization'
        if (message.toLowerCase().includes('unauthorized')) {
          tokenStorage.clear()
          router.replace('/hotel-finance/login')
          return
        }

        setExistingOrganization(null)
      } finally {
        setIsCheckingExisting(false)
      }
    }, 450)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [corporateEmail, router])

  useEffect(() => {
    const token = tokenStorage.get()
    if (!token) {
      router.replace('/hotel-finance/login')
      return
    }

    const loadOrganizations = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/organizations`, {
          credentials: 'include',
          headers: {
            ...getAuthHeaders()
          }
        })
        if (!response.ok) {
          throw new Error('Failed to fetch organizations')
        }

        const data = (await response.json()) as { organizations?: ApiOrganization[] }
        if (data.organizations && data.organizations.length > 0) {
          setOrganizations(data.organizations.map(toOrganization))
        } else {
          setOrganizations([])
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch organizations'
        if (message.toLowerCase().includes('unauthorized')) {
          tokenStorage.clear()
          router.replace('/hotel-finance/login')
          return
        }

        setOrganizations([])
      } finally {
        setIsLoading(false)
      }
    }

    void loadOrganizations()
  }, [router])

  const filteredOrganizations = useMemo(() => organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || org.status === statusFilter
    return matchesSearch && matchesStatus
  }), [organizations, searchQuery, statusFilter])

  const handleCreateOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRegisterError(null)
    setGeneratedCredentials(null)
    setSendCredentialsMessage(null)
    setSendCredentialsError(null)
    if (existingOrganization && !existingOrganization.isLinked) {
      setIsLinkingExisting(true)

      try {
        const response = await fetch(`${apiBaseUrl}/api/organizations/link-existing`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ organizationId: existingOrganization.id })
        })

        const data = (await response.json()) as {
          organization?: ApiOrganization
          error?: { message?: string }
        }

        if (!response.ok || !data.organization) {
          throw new Error(data.error?.message ?? 'Unable to add existing organization')
        }

        setOrganizations((current) => {
          const alreadyPresent = current.some((org) => org.id === data.organization?.id)
          if (alreadyPresent) {
            return current
          }

          return [toOrganization(data.organization as ApiOrganization), ...current]
        })

        setGeneratedCredentials(null)
        setSendCredentialsMessage(null)
        setSendCredentialsError(null)
        setRegisterError(null)
        setShowRegisterModal(false)
        setOrganizationName('')
        setCorporateEmail('')
        setGst('')
        setCreditPeriod('30 Days')
        setPaymentTerms('Net 30')
        setRegisterStatus('active')
        setInitialOutstanding('')
        setExistingOrganization(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to add existing organization'
        if (message.toLowerCase().includes('unauthorized')) {
          tokenStorage.clear()
          router.replace('/hotel-finance/login')
          return
        }

        setRegisterError(message)
      } finally {
        setIsLinkingExisting(false)
      }

      return
    }

    setIsRegistering(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/organizations`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: organizationName,
          corporateEmail,
          gst,
          creditPeriod,
          paymentTerms,
          status: registerStatus,
          initialOutstanding: initialOutstanding ? Number(initialOutstanding) : 0
        })
      })

      const data = (await response.json()) as {
        organization?: ApiOrganization
        credentials?: { userId: string; password: string; email?: string }
        error?: { message?: string }
      }

      if (!response.ok || !data.organization || !data.credentials) {
        throw new Error(data.error?.message ?? 'Unable to create organization')
      }

      setOrganizations((current) => [toOrganization(data.organization as ApiOrganization), ...current])
      setGeneratedCredentials({
        userId: data.credentials.userId,
        password: data.credentials.password,
        email: data.credentials.email ?? corporateEmail.trim().toLowerCase(),
        organizationName: organizationName.trim()
      })
      setOrganizationName('')
      setCorporateEmail('')
      setGst('')
      setCreditPeriod('30 Days')
      setPaymentTerms('Net 30')
      setRegisterStatus('active')
      setInitialOutstanding('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create organization'
      if (message.toLowerCase().includes('unauthorized')) {
        tokenStorage.clear()
        router.replace('/hotel-finance/login')
        return
      }

      setRegisterError(message)
    } finally {
      setIsRegistering(false)
    }
  }

  const handleSendCredentials = async () => {
    if (!generatedCredentials) {
      return
    }

    setSendCredentialsMessage(null)
    setSendCredentialsError(null)
    setIsSendingCredentials(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/organizations/send-credentials`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          recipientEmail: generatedCredentials.email,
          organizationName: generatedCredentials.organizationName,
          userId: generatedCredentials.userId,
          password: generatedCredentials.password
        })
      })

      const data = (await response.json()) as { error?: { message?: string } }
      if (!response.ok) {
        throw new Error(data.error?.message ?? 'Unable to send credentials email')
      }

      setSendCredentialsMessage(`Credentials sent to ${generatedCredentials.email}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send credentials email'
      if (message.toLowerCase().includes('unauthorized')) {
        tokenStorage.clear()
        router.replace('/hotel-finance/login')
        return
      }

      setSendCredentialsError(message)
    } finally {
      setIsSendingCredentials(false)
    }
  }

  const closeRegisterModal = () => {
    if (isRegistering) {
      return
    }
    setShowRegisterModal(false)
    setRegisterError(null)
    setGeneratedCredentials(null)
    setSendCredentialsMessage(null)
    setSendCredentialsError(null)
    setExistingOrganization(null)
    setIsCheckingExisting(false)
    setOrganizationName('')
    setCorporateEmail('')
    setGst('')
    setCreditPeriod('30 Days')
    setPaymentTerms('Net 30')
    setRegisterStatus('active')
    setInitialOutstanding('')
  }

  const openEditModal = (org: Organization) => {
    setEditingOrg(org)
    setEditName(org.name)
    setEditGst(org.gst === '-' ? '' : org.gst)
    setEditCreditPeriod(org.creditPeriod)
    setEditPaymentTerms(org.paymentTerms)
    setEditStatus(org.status)
    setEditOutstanding(org.initialOutstanding ? String(org.initialOutstanding) : '')
    setEditError(null)
    setEditSuccess(null)
  }

  const closeEditModal = () => {
    if (isSavingEdit) return
    setEditingOrg(null)
    setEditError(null)
    setEditSuccess(null)
  }

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingOrg) return

    setEditError(null)
    setEditSuccess(null)
    setIsSavingEdit(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/organizations/${editingOrg.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: editName.trim(),
          gst: editGst || null,
          creditPeriod: editCreditPeriod || null,
          paymentTerms: editPaymentTerms || null,
          status: editStatus,
          initialOutstanding: editOutstanding ? Number(editOutstanding) : 0
        })
      })

      const data = (await response.json()) as {
        organization?: { id: string; name: string; gst: string | null; creditPeriod: string | null; paymentTerms: string | null; status: OrganizationStatus; initialOutstanding?: number }
        error?: { message?: string }
      }

      if (!response.ok || !data.organization) {
        throw new Error(data.error?.message ?? 'Unable to update organization')
      }

      setOrganizations((current) =>
        current.map((o) => {
          if (o.id !== editingOrg.id) return o
          const newInitial = Number(data.organization?.initialOutstanding ?? 0)
          const invoiceOutstanding = o.pendingPayment - (o.initialOutstanding ?? 0)
          return {
            ...o,
            name: data.organization?.name ?? o.name,
            gst: data.organization?.gst ?? '-',
            creditPeriod: data.organization?.creditPeriod ?? '30 Days',
            paymentTerms: data.organization?.paymentTerms ?? 'Net 30',
            status: data.organization?.status ?? o.status,
            initialOutstanding: newInitial,
            pendingPayment: newInitial + Math.max(0, invoiceOutstanding)
          }
        })
      )

      setEditSuccess('Organization updated successfully.')
      setTimeout(() => closeEditModal(), 800)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update organization'
      if (message.toLowerCase().includes('unauthorized')) {
        tokenStorage.clear()
        router.replace('/hotel-finance/login')
        return
      }

      setEditError(message)
    } finally {
      setIsSavingEdit(false)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar title="Hotel Finance" logoIcon="domain" />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="mx-auto max-w-7xl flex flex-col gap-6">
            {/* Breadcrumbs */}
            <div className="flex flex-wrap gap-2">
              <a className="text-slate-500 hover:text-primary text-sm font-medium leading-normal" href="#">Dashboard</a>
              <span className="text-slate-400 text-sm font-medium leading-normal">/</span>
              <span className="text-slate-900 dark:text-slate-100 text-sm font-medium leading-normal">Organizations</span>
            </div>

            {/* Page Heading & Actions */}
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div className="flex min-w-72 flex-col gap-2">
                <h1 className="text-slate-900 dark:text-white text-3xl font-extrabold leading-tight tracking-[-0.033em]">Corporate Organizations</h1>
                <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">Manage corporate billing accounts, credit limits, and invoice details.</p>
              </div>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-white shadow-sm shadow-blue-500/20 transition-all hover:bg-blue-600 focus:ring-4 focus:ring-blue-500/30"
              >
                <span className="material-symbols-outlined mr-2 text-[20px]">add</span>
                <span className="text-sm font-bold leading-normal">Register New Organization</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="relative flex min-w-[280px] flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <span className="material-symbols-outlined">search</span>
                </span>
                <input 
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-base text-slate-900 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500" 
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative min-w-[180px]">
                  <select 
                    className="w-full appearance-none bg-none rounded-lg border border-slate-200 bg-slate-50 py-3 pl-4 pr-10 text-base text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">Filter by Status</option>
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <span className="material-symbols-outlined">expand_more</span>
                  </span>
                </div>
                <button className="flex h-[50px] w-[50px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700">
                  <span className="material-symbols-outlined">tune</span>
                </button>
              </div>
            </div>

            {/* Data Table */}
            <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                    <tr>
                      <th className="whitespace-nowrap px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Organization Name</th>
                      <th className="whitespace-nowrap px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Credit Period</th>
                      <th className="whitespace-nowrap px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Terms</th>
                      <th className="whitespace-nowrap px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Amount Received</th>
                      <th className="whitespace-nowrap px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Outstanding</th>
                      <th className="whitespace-nowrap px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Contract</th>
                      <th className="whitespace-nowrap px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading organizations...</td>
                      </tr>
                    ) : filteredOrganizations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">No organizations found</td>
                      </tr>
                    ) : filteredOrganizations.map((org) => (
                      <tr key={org.id} className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <Link href={`/hotel-finance/organizations/${org.id}`} className="flex items-center gap-3">
                            <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${org.bgColor} ${org.iconColor} ${org.darkBgColor} ${org.darkIconColor}`}>
                              <span className="material-symbols-outlined">{org.icon}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{org.name}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">ID: {org.id}</span>
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/hotel-finance/organizations/${org.id}`} className="block">
                            <span className="text-sm text-slate-600 dark:text-slate-300">{org.creditPeriod}</span>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/hotel-finance/organizations/${org.id}`} className="block">
                            <span className="text-sm text-slate-600 dark:text-slate-300">{org.paymentTerms}</span>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/hotel-finance/organizations/${org.id}`} className="block">
                            <span className="text-sm font-semibold text-green-600 dark:text-green-400 text-right block">₹{org.amountReceived.toLocaleString('en-IN')}</span>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/hotel-finance/organizations/${org.id}`} className="block">
                            <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 text-right block">₹{org.pendingPayment.toLocaleString('en-IN')}</span>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {org.contractStatus === 'signed' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-500/30">
                                <span className="material-symbols-outlined text-[14px]">verified</span>
                                Contract Signed
                              </span>
                            ) : (
                              <Link
                                href={`/hotel-finance/organizations/${org.id}/contract`}
                                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white dark:bg-primary/20 dark:text-blue-300 dark:hover:bg-primary dark:hover:text-white"
                              >
                                <span className="material-symbols-outlined text-[14px]">add</span>
                                Create Contract
                              </Link>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditModal(org) }}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            title="Edit organization"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row">
                <span className="text-sm text-slate-500 dark:text-slate-400">Showing <span className="font-semibold text-slate-900 dark:text-white">1</span> to <span className="font-semibold text-slate-900 dark:text-white">{filteredOrganizations.length}</span> of <span className="font-semibold text-slate-900 dark:text-white">{organizations.length}</span> results</span>
                <div className="flex items-center gap-1">
                  <button className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700">
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <div className="flex gap-1">
                    <button className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-medium text-white shadow-sm">1</button>
                    <button className="flex size-9 items-center justify-center rounded-lg bg-transparent text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">2</button>
                    <button className="flex size-9 items-center justify-center rounded-lg bg-transparent text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">3</button>
                    <span className="flex size-9 items-center justify-center text-sm text-slate-400">...</span>
                    <button className="flex size-9 items-center justify-center rounded-lg bg-transparent text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">10</button>
                  </div>
                  <button className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>

            {showRegisterModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Register Organization</h2>
                    <button
                      onClick={closeRegisterModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  <form className="space-y-4" onSubmit={handleCreateOrganization}>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Organization Name</label>
                      <input
                        value={organizationName}
                        onChange={(event) => setOrganizationName(event.target.value)}
                        required={!existingOrganization}
                        disabled={Boolean(existingOrganization)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        placeholder="Example Corp Pvt Ltd"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Corporate Email</label>
                      <input
                        type="email"
                        value={corporateEmail}
                        onChange={(event) => setCorporateEmail(event.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        placeholder="corp@example.com"
                      />
                      <div className="mt-1 min-h-[18px]">
                        {isCheckingExisting && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">Checking existing organization...</p>
                        )}
                        {!isCheckingExisting && existingOrganization && (
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            Existing organization found for this email.
                          </p>
                        )}
                      </div>
                    </div>

                    {existingOrganization && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                        <p className="font-semibold">Existing Organization</p>
                        <p className="mt-1">Name: <span className="font-medium">{existingOrganization.name}</span></p>
                        <p className="mt-1">GST: <span className="font-medium">{existingOrganization.gst ?? '-'}</span></p>
                        <p className="mt-1">Credit Period: <span className="font-medium">{existingOrganization.creditPeriod ?? '-'}</span></p>
                        <p className="mt-1">Payment Terms: <span className="font-medium">{existingOrganization.paymentTerms ?? '-'}</span></p>
                        <p className="mt-1">Status: <span className="font-medium capitalize">{existingOrganization.status}</span></p>
                        {existingOrganization.isLinked && (
                          <p className="mt-2 text-emerald-700 dark:text-emerald-300 font-medium">This organization is already added to your hotel.</p>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">GST</label>
                        <input
                          value={gst}
                          onChange={(event) => setGst(event.target.value)}
                          disabled={Boolean(existingOrganization)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          placeholder="27AAAAA0000A1Z5"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                        <select
                          value={registerStatus}
                          onChange={(event) => setRegisterStatus(event.target.value as OrganizationStatus)}
                          disabled={Boolean(existingOrganization)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="active">Active</option>
                          <option value="on-hold">On Hold</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Credit Period</label>
                        <input
                          value={creditPeriod}
                          onChange={(event) => setCreditPeriod(event.target.value)}
                          disabled={Boolean(existingOrganization)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          placeholder="30 Days"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Payment Terms</label>
                        <input
                          value={paymentTerms}
                          onChange={(event) => setPaymentTerms(event.target.value)}
                          disabled={Boolean(existingOrganization)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          placeholder="Net 30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Outstanding Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={initialOutstanding}
                        onChange={(event) => setInitialOutstanding(event.target.value)}
                        disabled={Boolean(existingOrganization)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        placeholder="0.00"
                      />
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pre-existing outstanding balance carried forward from before onboarding.</p>
                    </div>

                    {registerError && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                        {registerError}
                      </div>
                    )}

                    {generatedCredentials && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <p className="font-semibold">Corporate login credentials generated</p>
                        <p className="mt-1">Email: <span className="font-bold">{generatedCredentials.email}</span></p>
                        <p className="mt-1">User ID: <span className="font-bold">{generatedCredentials.userId}</span></p>
                        <p>Password: <span className="font-bold">{generatedCredentials.password}</span></p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleSendCredentials}
                            disabled={isSendingCredentials}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
                          >
                            {isSendingCredentials ? 'Sending...' : 'Send Credentials by Email'}
                          </button>
                          {sendCredentialsMessage && (
                            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{sendCredentialsMessage}</p>
                          )}
                          {sendCredentialsError && (
                            <p className="text-xs font-medium text-rose-700 dark:text-rose-300">{sendCredentialsError}</p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={closeRegisterModal}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Close
                      </button>
                      <button
                        type="submit"
                        disabled={isRegistering || isLinkingExisting || (existingOrganization?.isLinked ?? false)}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-70"
                      >
                        {existingOrganization
                          ? existingOrganization.isLinked
                            ? 'Already Added'
                            : (isLinkingExisting ? 'Adding...' : 'Add Existing Organization')
                          : (isRegistering ? 'Creating...' : 'Create Organization')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {editingOrg && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Organization</h2>
                    <button
                      onClick={closeEditModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  <form className="space-y-4" onSubmit={handleSaveEdit}>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Organization Name</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">GST</label>
                        <input
                          value={editGst}
                          onChange={(e) => setEditGst(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          placeholder="27AAAAA0000A1Z5"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as OrganizationStatus)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="active">Active</option>
                          <option value="on-hold">On Hold</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Credit Period</label>
                        <input
                          value={editCreditPeriod}
                          onChange={(e) => setEditCreditPeriod(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          placeholder="30 Days"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Payment Terms</label>
                        <input
                          value={editPaymentTerms}
                          onChange={(e) => setEditPaymentTerms(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          placeholder="Net 30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Outstanding Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editOutstanding}
                        onChange={(e) => setEditOutstanding(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        placeholder="0.00"
                      />
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Initial outstanding balance. Invoice-based amounts are added automatically.</p>
                    </div>

                    {editError && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                        {editError}
                      </div>
                    )}
                    {editSuccess && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {editSuccess}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={closeEditModal}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingEdit}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-70"
                      >
                        {isSavingEdit ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
