"use client"

import Header from '@/app/components/Header'
import Sidebar from '@/app/components/Sidebar'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ContractTemplate, { ContractData } from './ContractTemplate'

interface ContractClientProps {
  organizationId: string
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000'

interface OrganizationDetails {
  id: string
  name: string
  gst?: string | null
  contactPerson?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  registeredAddress?: string | null
  billingAddress?: string | null
  panCard?: string | null
}

interface ContractRecord {
  id: string
  status: 'draft' | 'sent' | 'signed'
  contractData: ContractData
  signedBy?: string | null
  signedDesignation?: string | null
  signatureDataUrl?: string | null
  signedAt?: string | null
}

const defaultContractData = (organizationId: string): ContractData => ({
  hotelName: 'Radisson Resort & Spa',
  hotelLocation: 'Kandla',
  organizationName: organizationId,
  contactPerson: '',
  companyAddress: '',
  billingAddress: '',
  mobile: '',
  email: '',
  gstNumber: '',
  panCard: '',
  validityFrom: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  validityTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  roomRates: [
    {
      roomType: 'Superior',
      inclusions: '• Buffet Breakfast at "Waves", our multi cuisine All Day Dining Coffee Shop • Complimentary Wi-Fi Internet in Guest Rooms • Complimentary Wireless Internet in all Public Areas • Exclusive usage of swimming pool & gymnasium',
      singleOccupancy: { ep: 5800, cp: 0, map: 0, ap: 0 },
      doubleOccupancy: { ep: 6300, cp: 0, map: 0, ap: 0 }
    },
    {
      roomType: 'Deluxe',
      inclusions: '• Buffet Breakfast at "Waves", our multi cuisine All Day Dining Coffee Shop • Complimentary Wi-Fi Internet in Guest Rooms • Complimentary Wireless Internet in all Public Areas • Exclusive usage of swimming pool & gymnasium',
      singleOccupancy: { ep: 6800, cp: 0, map: 0, ap: 0 },
      doubleOccupancy: { ep: 7300, cp: 0, map: 0, ap: 0 }
    },
    {
      roomType: 'Executive With Balcony',
      inclusions: '• Buffet Breakfast at "Waves", our multi cuisine All Day Dining Coffee Shop • Complimentary Wi-Fi Internet in Guest Rooms • Complimentary Wireless Internet in all Public Areas • Exclusive usage of swimming pool & gymnasium',
      singleOccupancy: { ep: 7800, cp: 0, map: 0, ap: 0 },
      doubleOccupancy: { ep: 8300, cp: 0, map: 0, ap: 0 }
    },
    {
      roomType: 'Villa King',
      inclusions: '• Buffet Breakfast at "Waves", our multi cuisine All Day Dining Coffee Shop • Complimentary Wi-Fi Internet in Guest Rooms • Complimentary Wireless Internet in all Public Areas • Exclusive usage of swimming pool & gymnasium',
      singleOccupancy: { ep: 5800, cp: 0, map: 0, ap: 0 },
      doubleOccupancy: { ep: 6300, cp: 0, map: 0, ap: 0 }
    },
    {
      roomType: 'Villa Garden',
      inclusions: '• Buffet Breakfast at "Waves", our multi cuisine All Day Dining Coffee Shop • Complimentary Wi-Fi Internet in Guest Rooms • Complimentary Wireless Internet in all Public Areas • Exclusive usage of swimming pool & gymnasium',
      singleOccupancy: { ep: 6800, cp: 0, map: 0, ap: 0 },
      doubleOccupancy: { ep: 7300, cp: 0, map: 0, ap: 0 }
    },
    {
      roomType: 'Villa Balcony',
      inclusions: '• Buffet Breakfast at "Waves", our multi cuisine All Day Dining Coffee Shop • Complimentary Wi-Fi Internet in Guest Rooms • Complimentary Wireless Internet in all Public Areas • Exclusive usage of swimming pool & gymnasium',
      singleOccupancy: { ep: 5800, cp: 0, map: 0, ap: 0 },
      doubleOccupancy: { ep: 6300, cp: 0, map: 0, ap: 0 }
    }
  ],
  extraBedCharge: 2500,
  lateCheckoutCharge: 2500,
  earlyCheckinCharge: 2500,
  extraPersonCharge: 1500,
  checkInTime: '1400 hours',
  checkOutTime: '1200 hours'
})

export default function ContractClient({ organizationId }: ContractClientProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isConfiguring, setIsConfiguring] = useState(true)
  const [contractData, setContractData] = useState<ContractData>(defaultContractData(organizationId))
  const [contractId, setContractId] = useState<string | null>(null)
  const [contractStatus, setContractStatus] = useState<'draft' | 'sent' | 'signed'>('draft')
  const [signedDetails, setSignedDetails] = useState<{
    acceptedBy?: string | null
    designation?: string | null
    signedAt?: string | null
    signatureDataUrl?: string | null
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSendingLink, setIsSendingLink] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [shareableLink, setShareableLink] = useState('')

  const signatureLabel = useMemo(() => {
    if (contractStatus === 'signed') return 'Signed'
    if (contractStatus === 'sent') return 'Pending'
    return 'Pending'
  }, [contractStatus])

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const orgResponse = await fetch(`${apiBaseUrl}/api/organizations/${organizationId}`, { credentials: 'include' })
        if (!orgResponse.ok) {
          throw new Error('Unable to load organization details')
        }

        const orgData = (await orgResponse.json()) as { organization: OrganizationDetails }
        const organization = orgData.organization

        setContractData((current) => ({
          ...current,
          organizationName: organization.name,
          contactPerson: organization.contactPerson ?? '',
          companyAddress: organization.registeredAddress ?? '',
          billingAddress: organization.billingAddress ?? organization.registeredAddress ?? '',
          mobile: organization.contactPhone ?? '',
          email: organization.contactEmail ?? '',
          gstNumber: organization.gst ?? '',
          panCard: organization.panCard ?? ''
        }))

        const latestResponse = await fetch(`${apiBaseUrl}/api/organizations/${organizationId}/contracts/latest`, { credentials: 'include' })
        if (latestResponse.ok) {
          const latestData = (await latestResponse.json()) as { contract: ContractRecord }
          setContractId(latestData.contract.id)
          setContractStatus(latestData.contract.status)
          setContractData(latestData.contract.contractData)
          setSignedDetails({
            acceptedBy: latestData.contract.signedBy,
            designation: latestData.contract.signedDesignation,
            signedAt: latestData.contract.signedAt,
            signatureDataUrl: latestData.contract.signatureDataUrl
          })
          setIsConfiguring(false)
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load contract data')
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [organizationId])

  const saveDraftContract = async () => {
    setIsSaving(true)
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const response = await fetch(`${apiBaseUrl}/api/organizations/${organizationId}/contracts`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contractData })
      })

      const data = (await response.json()) as {
        contract?: { id: string; status: 'draft' | 'sent' | 'signed' }
        error?: { message?: string }
      }

      if (!response.ok || !data.contract) {
        throw new Error(data.error?.message ?? 'Unable to generate contract')
      }

      setContractId(data.contract.id)
      setContractStatus(data.contract.status)
      setStatusMessage('Contract generated and saved. PDF preview is ready.')
      return data.contract.id
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to generate contract')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareableLink)
    setStatusMessage('Signing link copied to clipboard.')
  }

  const sendSignatureLink = async () => {
    setIsSendingLink(true)
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const currentContractId = contractId ?? (await saveDraftContract())
      if (!currentContractId) {
        return
      }

      const response = await fetch(`${apiBaseUrl}/api/organizations/${organizationId}/contracts/${currentContractId}/send-sign-link`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientEmail: contractData.email || undefined,
          portalBaseUrl: window.location.origin
        })
      })

      const data = (await response.json()) as {
        signLink?: string
        error?: { message?: string }
      }

      if (!response.ok || !data.signLink) {
        throw new Error(data.error?.message ?? 'Unable to send signing link')
      }

      setShareableLink(data.signLink)
      setContractStatus('sent')
      setStatusMessage(`Signing link sent to ${contractData.email || 'the recipient email'} successfully.`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send signing link')
    } finally {
      setIsSendingLink(false)
    }
  }

  const handleGenerateAndPreview = async () => {
    const generatedId = await saveDraftContract()
    if (generatedId) {
      setIsConfiguring(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
        <Sidebar title="Hotel Finance" logoIcon="domain" />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-slate-600 dark:text-slate-300">Loading contract data...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar title="Hotel Finance" logoIcon="domain" />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />
        
        {/* Configuration Form - Full Page */}
        {isConfiguring && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto p-6">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Configure Contract</h1>
                <p className="text-slate-600 dark:text-slate-400">Contract details are auto-filled from organization profile. You can edit before generating.</p>
              </div>

              {errorMessage && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  {errorMessage}
                </div>
              )}

              {/* Configuration Form Sections */}
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 space-y-6">
                {/* Hotel Information */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Hotel Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Hotel Name</label>
                      <input 
                        type="text" 
                        value={contractData.hotelName}
                        onChange={(e) => setContractData({...contractData, hotelName: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Location</label>
                      <input 
                        type="text" 
                        value={contractData.hotelLocation}
                        onChange={(e) => setContractData({...contractData, hotelLocation: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Contract Validity */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Contract Validity Period</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Valid From</label>
                      <input 
                        type="text" 
                        value={contractData.validityFrom}
                        onChange={(e) => setContractData({...contractData, validityFrom: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Valid To</label>
                      <input 
                        type="text" 
                        value={contractData.validityTo}
                        onChange={(e) => setContractData({...contractData, validityTo: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Charges */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Additional Charges</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Extra Bed (₹)</label>
                      <input 
                        type="number" 
                        value={contractData.extraBedCharge}
                        onChange={(e) => setContractData({...contractData, extraBedCharge: parseFloat(e.target.value)})}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Late Checkout (₹)</label>
                      <input 
                        type="number" 
                        value={contractData.lateCheckoutCharge}
                        onChange={(e) => setContractData({...contractData, lateCheckoutCharge: parseFloat(e.target.value)})}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Early Check-in (₹)</label>
                      <input 
                        type="number" 
                        value={contractData.earlyCheckinCharge}
                        onChange={(e) => setContractData({...contractData, earlyCheckinCharge: parseFloat(e.target.value)})}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Extra Person (₹)</label>
                      <input 
                        type="number" 
                        value={contractData.extraPersonCharge}
                        onChange={(e) => setContractData({...contractData, extraPersonCharge: parseFloat(e.target.value)})}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Check-in/Check-out Times */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Check-in/Check-out Times</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Check-in Time</label>
                      <input 
                        type="text" 
                        value={contractData.checkInTime}
                        onChange={(e) => setContractData({...contractData, checkInTime: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Check-out Time</label>
                      <input 
                        type="text" 
                        value={contractData.checkOutTime}
                        onChange={(e) => setContractData({...contractData, checkOutTime: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Room Rates Table */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Room Rates (EP Plan)</h3>
                  <div className="overflow-x-auto border border-slate-300 dark:border-slate-600 rounded-lg">
                    <table className="w-full">
                      <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 text-sm">Room Type</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300 text-sm">Single (EP)</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300 text-sm">Double (EP)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {contractData.roomRates.map((rate, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}>
                            <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{rate.roomType}</td>
                            <td className="px-4 py-3">
                              <input 
                                type="number" 
                                value={rate.singleOccupancy.ep || ''}
                                onChange={(e) => {
                                  const newRates = [...contractData.roomRates]
                                  newRates[index].singleOccupancy.ep = parseFloat(e.target.value) || 0
                                  setContractData({...contractData, roomRates: newRates})
                                }}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-center"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="number" 
                                value={rate.doubleOccupancy.ep || ''}
                                onChange={(e) => {
                                  const newRates = [...contractData.roomRates]
                                  newRates[index].doubleOccupancy.ep = parseFloat(e.target.value) || 0
                                  setContractData({...contractData, roomRates: newRates})
                                }}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-center"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button 
                    onClick={() => window.history.back()}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                    Cancel
                  </button>
                  <button 
                    onClick={handleGenerateAndPreview}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                  >
                    <span className="material-symbols-outlined">check_circle</span>
                    {isSaving ? 'Generating...' : 'Generate Contract'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isConfiguring && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <Link
                  href={`/hotel-finance/organizations/${organizationId}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  <span>Back</span>
                </Link>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Print</span>
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <ContractTemplate
                  data={contractData}
                  showSignature={true}
                  isPreview={false}
                  signedDetails={signedDetails ?? undefined}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
