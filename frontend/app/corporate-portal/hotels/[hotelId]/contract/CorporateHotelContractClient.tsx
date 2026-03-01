"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  corporateTokenStorage,
  fetchCorporateHotelLatestContract,
  fetchCorporateHotels,
  fetchCorporateHotelSignedContractHistory,
  type CorporateHotelLatestContract,
  type CorporateHotelSignedContractHistoryItem,
  type CorporateHotelSummary
} from '@/lib/corporateAuth'
import { useRouter } from 'next/navigation'

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const resolveText = (value: unknown, fallback = '-') => {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : fallback
}

export default function CorporateHotelContractClient({ hotelId }: { hotelId: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hotel, setHotel] = useState<CorporateHotelSummary | null>(null)
  const [latestContract, setLatestContract] = useState<CorporateHotelLatestContract | null>(null)
  const [contractPdfBlobUrl, setContractPdfBlobUrl] = useState<string | null>(null)
  const [currentSignedContract, setCurrentSignedContract] = useState<CorporateHotelSignedContractHistoryItem | null>(null)
  const [previousSignedContracts, setPreviousSignedContracts] = useState<CorporateHotelSignedContractHistoryItem[]>([])

  const getCorporateAuthHeaders = () => {
    const token = corporateTokenStorage.get()
    if (!token) {
      throw new Error('Unauthorized')
    }

    return {
      Authorization: `Bearer ${token}`
    }
  }

  const loadContractPdfPreview = async (pdfUrl: string) => {
    const response = await fetch(pdfUrl, {
      credentials: 'include',
      headers: {
        ...getCorporateAuthHeaders()
      }
    })

    if (!response.ok) {
      throw new Error('Unable to load contract PDF')
    }

    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    setContractPdfBlobUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current)
      }
      return blobUrl
    })
  }

  const openContractPdfInNewTab = async (pdfUrl: string) => {
    try {
      const response = await fetch(pdfUrl, {
        credentials: 'include',
        headers: {
          ...getCorporateAuthHeaders()
        }
      })

      if (!response.ok) {
        throw new Error('Unable to open contract PDF')
      }

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (openError) {
      const message = openError instanceof Error ? openError.message : 'Unable to open contract PDF'
      setError(message)
    }
  }

  useEffect(() => {
    return () => {
      if (contractPdfBlobUrl) {
        URL.revokeObjectURL(contractPdfBlobUrl)
      }
    }
  }, [contractPdfBlobUrl])

  useEffect(() => {
    const token = corporateTokenStorage.get()
    if (!token) {
      router.replace('/corporate-portal/login')
      return
    }

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [hotelsResponse, latestContractResponse, signedHistoryResponse] = await Promise.all([
          fetchCorporateHotels(),
          fetchCorporateHotelLatestContract(hotelId),
          fetchCorporateHotelSignedContractHistory(hotelId)
        ])

        const selectedHotel = hotelsResponse.hotels.find((entry) => entry.id === hotelId) ?? null
        if (!selectedHotel) {
          setHotel(null)
          setLatestContract(null)
          setCurrentSignedContract(null)
          setPreviousSignedContracts([])
          setError('Hotel not found for this organization.')
          return
        }

        setHotel(selectedHotel)
        setLatestContract(latestContractResponse.contract)
        setCurrentSignedContract(signedHistoryResponse.currentSignedContract)
        setPreviousSignedContracts(signedHistoryResponse.previousSignedContracts)

        if (latestContractResponse.contract?.pdfUrl) {
          await loadContractPdfPreview(latestContractResponse.contract.pdfUrl)
        } else {
          setContractPdfBlobUrl((current) => {
            if (current) {
              URL.revokeObjectURL(current)
            }
            return null
          })
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load contract details'
        setError(message)

        if (message.toLowerCase().includes('unauthorized')) {
          corporateTokenStorage.clear()
          router.replace('/corporate-portal/login')
          return
        }
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [hotelId, router])

  const contractData = useMemo(() => {
    return (latestContract?.contractData ?? {}) as Record<string, unknown>
  }, [latestContract])

  const latestContractStatusLabel = useMemo(() => {
    if (!latestContract) {
      return 'Not available'
    }

    if (latestContract.status === 'signed') {
      return 'Signed'
    }

    if (latestContract.status === 'sent') {
      return 'Sent for Signature'
    }

    return 'Draft'
  }, [latestContract])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
        <Sidebar title="TravelCorp" logoIcon="travel_explore" />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <Header />
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">Loading contract...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
      <Sidebar title="TravelCorp" logoIcon="travel_explore" />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="mx-auto max-w-7xl flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Link href="/corporate-portal" className="text-slate-500 hover:text-primary text-sm font-medium leading-normal">Partner Hotels</Link>
                <span className="text-slate-400 text-sm font-medium leading-normal">/</span>
                <Link href={`/corporate-portal/hotels/${hotelId}`} className="text-slate-500 hover:text-primary text-sm font-medium leading-normal">Reconciliation</Link>
                <span className="text-slate-400 text-sm font-medium leading-normal">/</span>
                <span className="text-slate-900 dark:text-slate-100 text-sm font-medium leading-normal">Contract</span>
              </div>
              <Link
                href={`/corporate-portal/hotels/${hotelId}`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back
              </Link>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{hotel?.name ?? 'Hotel Contract'}</h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Contract details for this hotel under your organization.</p>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="text-slate-600 dark:text-slate-400"><span className="font-semibold text-slate-800 dark:text-slate-200">Status:</span> {latestContractStatusLabel}</p>
                  <p className="text-slate-600 dark:text-slate-400"><span className="font-semibold text-slate-800 dark:text-slate-200">Signed Date:</span> {formatDate(latestContract?.signedAt ?? null)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Contract Parties</h2>
                <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <p><span className="font-semibold text-slate-800 dark:text-slate-200">Organization:</span> {resolveText(contractData.organizationName, hotel?.name ?? '-')}</p>
                  <p><span className="font-semibold text-slate-800 dark:text-slate-200">Contact Person:</span> {resolveText(contractData.contactPerson)}</p>
                  <p><span className="font-semibold text-slate-800 dark:text-slate-200">Email:</span> {resolveText(contractData.email)}</p>
                  <p><span className="font-semibold text-slate-800 dark:text-slate-200">GST:</span> {resolveText(contractData.gstNumber)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
              {contractPdfBlobUrl ? (
                <iframe
                  src={contractPdfBlobUrl}
                  title="Corporate hotel contract preview"
                  className="w-full min-h-[900px]"
                />
              ) : (
                <div className="p-8 text-sm text-slate-600 dark:text-slate-300">Contract PDF preview is not available yet.</div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Signed Contract History</h2>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Current Signed Contract</p>
                  {currentSignedContract ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{currentSignedContract.id}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Signed on {formatDate(currentSignedContract.signedAt)}</p>
                      </div>
                      <a
                        href={currentSignedContract.pdfUrl}
                        onClick={(event) => {
                          event.preventDefault()
                          void openContractPdfInNewTab(currentSignedContract.pdfUrl)
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        <span className="material-symbols-outlined text-[16px]">description</span>
                        View Contract
                      </a>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No signed contract available yet.</p>
                  )}
                </div>

                {previousSignedContracts.length > 0 ? (
                  previousSignedContracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{contract.id}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Signed on {formatDate(contract.signedAt)}</p>
                      </div>
                      <a
                        href={contract.pdfUrl}
                        onClick={(event) => {
                          event.preventDefault()
                          void openContractPdfInNewTab(contract.pdfUrl)
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        View
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">No previous signed contracts found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
