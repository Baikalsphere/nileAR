"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000'

interface CorporateContractSignClientProps {
  token: string
}

interface SignableContract {
  id: string
  organizationId: string
  organizationName: string
  organizationGst?: string | null
  organizationCreditPeriod?: string | null
  organizationPaymentTerms?: string | null
  organizationRegistrationNumber?: string | null
  organizationRegisteredAddress?: string | null
  organizationContactEmail?: string | null
  organizationContactPhone?: string | null
  organizationContactPerson?: string | null
  organizationBillingAddress?: string | null
  organizationPanCard?: string | null
  status: 'draft' | 'sent' | 'signed'
  contractData: Record<string, unknown>
  pdfUrl?: string | null
  signedBy?: string | null
  signedDesignation?: string | null
  signatureDataUrl?: string | null
  signedAt?: string | null
}

export default function CorporateContractSignClient({ token }: CorporateContractSignClientProps) {
  const [contract, setContract] = useState<SignableContract | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [contractPdfBlobUrl, setContractPdfBlobUrl] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    acceptedBy: '',
    designation: ''
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  const loadContractPdfPreview = async (pdfUrl: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}${pdfUrl}`)
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load contract PDF')
    }
  }

  useEffect(() => {
    const loadContract = async () => {
      if (!token) {
        setErrorMessage('Invalid signing link.')
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/organizations/contracts/sign/${encodeURIComponent(token)}`)
        const data = (await response.json()) as {
          contract?: SignableContract
          error?: { message?: string }
        }

        if (!response.ok || !data.contract) {
          throw new Error(data.error?.message ?? 'Unable to load contract')
        }

        setContract(data.contract)
        if (data.contract.pdfUrl) {
          await loadContractPdfPreview(data.contract.pdfUrl)
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load contract')
      } finally {
        setIsLoading(false)
      }
    }

    void loadContract()
  }, [token])

  useEffect(() => {
    return () => {
      if (contractPdfBlobUrl) {
        URL.revokeObjectURL(contractPdfBlobUrl)
      }
    }
  }, [contractPdfBlobUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    context.strokeStyle = '#111827'
    context.lineWidth = 2
    context.lineCap = 'round'
  }, [])

  const getCursorPosition = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return { x: 0, y: 0 }
    }

    const rect = canvas.getBoundingClientRect()
    if ('touches' in event) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top
      }
    }

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }

    const position = getCursorPosition(event)
    context.beginPath()
    context.moveTo(position.x, position.y)
    setIsDrawing(true)
    setHasSignature(true)
  }

  const draw = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return
    }

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }

    const position = getCursorPosition(event)
    context.lineTo(position.x, position.y)
    context.stroke()
  }

  const stopDrawing = () => setIsDrawing(false)

  const clearSignature = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }

    context.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const submitSignature = async () => {
    if (!contract) {
      return
    }

    if (!formData.acceptedBy.trim() || !formData.designation.trim() || !accepted) {
      setErrorMessage('Fill all required fields and accept the declaration.')
      return
    }

    if (!hasSignature) {
      setErrorMessage('Please provide your signature.')
      return
    }

    const signatureDataUrl = canvasRef.current?.toDataURL('image/png')
    if (!signatureDataUrl) {
      setErrorMessage('Unable to capture signature.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`${apiBaseUrl}/api/organizations/contracts/sign/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          acceptedBy: formData.acceptedBy.trim(),
          designation: formData.designation.trim(),
          accepted: true,
          signatureDataUrl
        })
      })

      const data = (await response.json()) as { ok?: boolean; error?: { message?: string } }
      if (!response.ok || !data.ok) {
        throw new Error(data.error?.message ?? 'Unable to submit signature')
      }

      setIsSubmitted(true)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit signature')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Loading contract...</p>
      </div>
    )
  }

  if (errorMessage && !contract) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          <h1 className="text-lg font-semibold mb-2">Unable to open contract</h1>
          <p className="text-sm">{errorMessage}</p>
        </div>
      </div>
    )
  }

  if (!contract) {
    return null
  }

  if (isSubmitted || contract.status === 'signed') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-xl border border-slate-200 p-8 text-center">
          <span className="material-symbols-outlined text-green-600 text-5xl">check_circle</span>
          <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-2">Contract signed successfully</h1>
          <p className="text-sm text-slate-600 mb-6">Your digital signature has been recorded for {contract.organizationName}.</p>
          <Link
            href="/corporate-portal/login"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Open Corporate Portal
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h1 className="text-2xl font-bold text-slate-900">Corporate Contract Signature</h1>
          <p className="text-sm text-slate-600 mt-1">Review and digitally sign this contract to complete acceptance.</p>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {contractPdfBlobUrl ? (
            <iframe
              src={contractPdfBlobUrl}
              title="Contract PDF"
              className="w-full min-h-[760px]"
            />
          ) : (
            <div className="p-6 text-sm text-slate-600">
              Contract PDF is not available.
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Organization Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {contract.organizationName && (
              <div>
                <p className="text-slate-600 font-medium">Company Name</p>
                <p className="text-slate-900">{contract.organizationName}</p>
              </div>
            )}
            {contract.organizationContactPerson && (
              <div>
                <p className="text-slate-600 font-medium">Contact Person</p>
                <p className="text-slate-900">{contract.organizationContactPerson}</p>
              </div>
            )}
            {contract.organizationContactEmail && (
              <div>
                <p className="text-slate-600 font-medium">Email</p>
                <p className="text-slate-900">{contract.organizationContactEmail}</p>
              </div>
            )}
            {contract.organizationContactPhone && (
              <div>
                <p className="text-slate-600 font-medium">Phone</p>
                <p className="text-slate-900">{contract.organizationContactPhone}</p>
              </div>
            )}
            {contract.organizationGst && (
              <div>
                <p className="text-slate-600 font-medium">GST Number</p>
                <p className="text-slate-900">{contract.organizationGst}</p>
              </div>
            )}
            {contract.organizationPanCard && (
              <div>
                <p className="text-slate-600 font-medium">PAN Card</p>
                <p className="text-slate-900">{contract.organizationPanCard}</p>
              </div>
            )}
            {contract.organizationRegisteredAddress && (
              <div className="md:col-span-2">
                <p className="text-slate-600 font-medium">Registered Address</p>
                <p className="text-slate-900">{contract.organizationRegisteredAddress}</p>
              </div>
            )}
            {contract.organizationBillingAddress && (
              <div className="md:col-span-2">
                <p className="text-slate-600 font-medium">Billing Address</p>
                <p className="text-slate-900">{contract.organizationBillingAddress}</p>
              </div>
            )}
            {contract.organizationCreditPeriod && (
              <div>
                <p className="text-slate-600 font-medium">Credit Period</p>
                <p className="text-slate-900">{contract.organizationCreditPeriod}</p>
              </div>
            )}
            {contract.organizationPaymentTerms && (
              <div>
                <p className="text-slate-600 font-medium">Payment Terms</p>
                <p className="text-slate-900">{contract.organizationPaymentTerms}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-900">Record of Acceptance</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Accepted By *</label>
              <input
                type="text"
                value={formData.acceptedBy}
                onChange={(event) => setFormData((current) => ({ ...current, acceptedBy: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Designation *</label>
              <input
                type="text"
                value={formData.designation}
                onChange={(event) => setFormData((current) => ({ ...current, designation: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Designation"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Digital Signature *</label>
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
              <canvas
                ref={canvasRef}
                width={860}
                height={180}
                className="w-full h-44 bg-white rounded border border-slate-200 cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">Draw your signature in the box above.</span>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-slate-700">
              I confirm I have reviewed this agreement and I am authorized to sign on behalf of {contract.organizationName}.
            </span>
          </label>

          <button
            onClick={submitSignature}
            disabled={!accepted || isSubmitting}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 text-sm font-semibold"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Signed Contract'}
          </button>
        </div>
      </div>
    </div>
  )
}
