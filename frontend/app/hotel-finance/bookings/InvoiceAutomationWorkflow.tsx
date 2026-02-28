"use client"

import { useState } from 'react'
import Link from 'next/link'

interface WorkflowStep {
  id: number
  title: string
  description: string
  completed: boolean
}

interface InvoiceWorkflowData {
  bookingId: string
  invoiceNumber?: string
  signatureFile?: File
  supportingDocuments: File[]
  invoiceType: 'manual' | 'pos' | 'ar'
  gstNumber?: string
  gstin?: string
  arSettlementId?: string
  createEInvoice: boolean
  eInvoiceArn?: string
  coverLetter?: string
  clientId?: string
  fileSizeOptimized?: boolean
  pmsPostedDate?: string
  complianceStatus?: 'pending' | 'verified' | 'signed'
  gstPortalData?: {
    portRefId: string
    invoiceRefId: string
    taxableAmount: number
    gstAmount: number
  }
  arModuleData?: {
    arId: string
    settlementDate: string
    reference: string
  }
}

const formatInr = (value: number) => value.toLocaleString('en-IN')

export default function InvoiceAutomationWorkflow({ 
  bookingId, 
  customerName,
  corporationName,
  totalAmount,
  onClose 
}: {
  bookingId: string
  customerName: string
  corporationName: string
  totalAmount: number
  onClose: () => void
}) {
  const [currentStep, setCurrentStep] = useState(0)
  const [workflowData, setWorkflowData] = useState<InvoiceWorkflowData>({
    bookingId,
    signatureFile: undefined,
    supportingDocuments: [],
    invoiceType: 'pos',
    createEInvoice: false
  })

  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([
    {
      id: 1,
      title: 'Select Invoice Type',
      description: 'Choose between Manual, POS, or AR invoice',
      completed: false
    },
    {
      id: 2,
      title: 'Digital Signature',
      description: 'Upload digitally signed document',
      completed: false
    },
    {
      id: 3,
      title: 'Supporting Documents',
      description: 'Upload supporting documents and verification',
      completed: false
    },
    {
      id: 4,
      title: 'Create Supporting',
      description: 'Create supporting document for PMS invoice',
      completed: false
    },
    {
      id: 5,
      title: 'Verification',
      description: 'Verify invoice details before generating',
      completed: false
    },
    {
      id: 6,
      title: 'E-Invoice',
      description: 'Generate E-Invoice if GST applicable',
      completed: false
    },
    {
      id: 7,
      title: 'Send Cover Letter',
      description: 'Send automated email with cover letter to client',
      completed: false
    }
  ])

  const handleInvoiceTypeChange = (type: 'manual' | 'pos' | 'ar') => {
    setWorkflowData(prev => ({ ...prev, invoiceType: type }))
    markStepComplete(0)
  }

  const markStepComplete = (stepIndex: number) => {
    setWorkflowSteps(prev =>
      prev.map((step, idx) =>
        idx === stepIndex ? { ...step, completed: true } : step
      )
    )
  }

  const handleSignatureUpload = (file: File | null) => {
    if (file) {
      setWorkflowData(prev => ({ ...prev, signatureFile: file }))
      markStepComplete(1)
      setCurrentStep(2)
    }
  }

  const handleSupportingDocumentsUpload = (files: FileList | null) => {
    if (files) {
      setWorkflowData(prev => ({
        ...prev,
        supportingDocuments: [...prev.supportingDocuments, ...Array.from(files)]
      }))
      markStepComplete(2)
      setCurrentStep(3)
    }
  }

  const handleCreateSupporting = () => {
    markStepComplete(3)
    setCurrentStep(4)
  }

  const handleVerification = (hasGST: boolean = false, hasAR: boolean = false) => {
    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    
    // Set GST/AR data if applicable
    let updatedData: any = { invoiceNumber }
    
    if (hasGST) {
      // Mock GST data for demonstration
      updatedData.gstin = '22AAAAA1234A1Z5'
      updatedData.gstNumber = 'GST Settlement - ' + invoiceNumber
    }
    
    if (hasAR) {
      // Mock AR data for demonstration
      updatedData.arSettlementId = 'AR-' + invoiceNumber.slice(-8)
    }
    
    setWorkflowData(prev => ({ ...prev, ...updatedData }))
    markStepComplete(4)
    
    // Check if E-Invoice is needed (only if booking is GST supporting)
    if (hasGST) {
      setCurrentStep(5)
    } else {
      setCurrentStep(6)
    }
  }

  const handleEInvoiceGeneration = (gstNumber: string, gstin: string) => {
    // Simulate E-Invoice generation
    const arn = `ARN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    setWorkflowData(prev => ({ 
      ...prev, 
      createEInvoice: true,
      gstNumber,
      gstin,
      eInvoiceArn: arn
    }))
    markStepComplete(5)
    setCurrentStep(6)
  }

  const handleSendCoverLetter = () => {
    // Simulate sending cover letter and email
    markStepComplete(6)
    
    // Show completion message
    alert(`Invoice ${workflowData.invoiceNumber} has been processed and sent to client successfully!${workflowData.eInvoiceArn ? `\nE-Invoice ARN: ${workflowData.eInvoiceArn}` : ''}`)
    
    onClose()
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Select Invoice Type
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-text-main-light dark:text-text-main-dark">
                Select Invoice Type
              </h3>
              <p className="text-sm text-text-sub-light dark:text-text-sub-dark mb-6">
                Choose the invoice processing method for this booking.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Manual Invoice */}
              <button
                onClick={() => handleInvoiceTypeChange('manual')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  workflowData.invoiceType === 'manual'
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                }`}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <span className="material-symbols-outlined text-4xl text-primary">
                    upload_file
                  </span>
                  <h4 className="font-semibold text-text-main-light dark:text-text-main-dark">
                    Manual Invoice
                  </h4>
                  <p className="text-xs text-text-sub-light dark:text-text-sub-dark">
                    Upload and scan manually created invoices with file size optimization
                  </p>
                </div>
              </button>

              {/* POS Invoice */}
              <button
                onClick={() => handleInvoiceTypeChange('pos')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  workflowData.invoiceType === 'pos'
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                }`}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <span className="material-symbols-outlined text-4xl text-emerald-600">
                    point_of_sale
                  </span>
                  <h4 className="font-semibold text-text-main-light dark:text-text-main-dark">
                    POS Invoice
                  </h4>
                  <p className="text-xs text-text-sub-light dark:text-text-sub-dark">
                    Auto-post to PMS after settlement - no manual intervention needed
                  </p>
                </div>
              </button>

              {/* AR Settlement */}
              <button
                onClick={() => handleInvoiceTypeChange('ar')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  workflowData.invoiceType === 'ar'
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                }`}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <span className="material-symbols-outlined text-4xl text-orange-600">
                    account_balance
                  </span>
                  <h4 className="font-semibold text-text-main-light dark:text-text-main-dark">
                    AR Settlement
                  </h4>
                  <p className="text-xs text-text-sub-light dark:text-text-sub-dark">
                    Accounts Receivable invoice with E-Invoice eligibility
                  </p>
                </div>
              </button>
            </div>

            <button
              onClick={() => { markStepComplete(0); setCurrentStep(1); }}
              className="w-full mt-6 px-4 py-3 bg-primary hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              Continue with {workflowData.invoiceType.toUpperCase()}
            </button>
          </div>
        )

      case 1: // Digital Signature
        return (
          <SignatureUploadStep
            invoiceType={workflowData.invoiceType}
            onUpload={handleSignatureUpload}
            onBack={() => setCurrentStep(0)}
          />
        )

      case 2: // Supporting Documents
        return (
          <SupportingDocumentsStep
            invoiceType={workflowData.invoiceType}
            onUpload={handleSupportingDocumentsUpload}
            onBack={() => setCurrentStep(1)}
            documents={workflowData.supportingDocuments}
          />
        )

      case 3: // Create Supporting
        return (
          <CreateSupportingStep
            bookingId={bookingId}
            invoiceType={workflowData.invoiceType}
            onContinue={handleCreateSupporting}
            onBack={() => setCurrentStep(2)}
          />
        )

      case 4: // Verification
        return (
          <VerificationStep
            customerName={customerName}
            corporationName={corporationName}
            totalAmount={totalAmount}
            invoiceType={workflowData.invoiceType}
            documentCount={workflowData.supportingDocuments.length}
            hasSig={!!workflowData.signatureFile}
            onContinue={handleVerification}
            onBack={() => setCurrentStep(3)}
          />
        )

      case 5: // E-Invoice
        return (
          <EInvoiceStep
            invoiceNumber={workflowData.invoiceNumber || ''}
            totalAmount={totalAmount}
            onGenerate={handleEInvoiceGeneration}
            onSkip={() => { markStepComplete(5); setCurrentStep(6); }}
            onBack={() => setCurrentStep(4)}
          />
        )

      case 6: // Send Cover Letter
        return (
          <CoverLetterStep
            invoiceNumber={workflowData.invoiceNumber || ''}
            customerName={customerName}
            corporationName={corporationName}
            totalAmount={totalAmount}
            eInvoiceArn={workflowData.eInvoiceArn}
            gstData={workflowData.gstin ? { gstin: workflowData.gstin, gstNumber: workflowData.gstNumber } : null}
            arData={workflowData.arSettlementId ? { arId: workflowData.arSettlementId } : null}
            onSend={handleSendCoverLetter}
            onBack={() => setCurrentStep(5)}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary to-blue-700 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Invoice Automation Workflow</h2>
            <p className="text-blue-100 text-sm mt-1">Booking: {bookingId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {workflowSteps.map((step, idx) => (
              <div
                key={step.id}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  workflowSteps[currentStep].id === step.id
                    ? 'bg-primary text-white'
                    : step.completed
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {step.completed && <span className="material-symbols-outlined text-[18px]">check</span>}
                {!step.completed && <span>{step.id}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {renderStepContent()}
        </div>
      </div>
    </div>
  )
}

// Sub-components

function SignatureUploadStep({ onUpload, onBack, invoiceType }: any) {
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [sizeOptimizationStatus, setSizeOptimizationStatus] = useState<'pending' | 'optimizing' | 'optimized' | null>(null)

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
  const FILE_SIZE_LIMIT_MANUAL = 5 * 1024 * 1024 // 5 MB for manual with optimization

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const optimizeFile = (file: File) => {
    setSizeOptimizationStatus('optimizing')
    // Simulate file optimization/compression
    setTimeout(() => {
      setSizeOptimizationStatus('optimized')
      setUploadedFile(file)
      setTimeout(() => {
        onUpload(file)
      }, 800)
    }, 1500)
  }

  const validateAndUploadFile = (file: File) => {
    if (invoiceType === 'manual' && file.size > FILE_SIZE_LIMIT_MANUAL) {
      alert(`File exceeds limit for manual invoices. Max: 5 MB. Your file: ${(file.size / 1024 / 1024).toFixed(2)} MB\n\nInitiating compression...`)
      optimizeFile(file)
    } else if (file.size > MAX_FILE_SIZE) {
      alert('File exceeds maximum size of 10 MB')
    } else {
      setUploadedFile(file)
      onUpload(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndUploadFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndUploadFile(e.target.files[0])
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-text-main-light dark:text-text-main-dark">
          Digital Signature - Security & Compliance
        </h3>
        <p className="text-sm text-text-sub-light dark:text-text-sub-dark">
          All invoices must be digitally signed for legal validity and security. Upload your digitally signed document.
        </p>
      </div>

      {/* Compliance Requirements */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 flex-shrink-0 pt-1">
            verified_user
          </span>
          <div>
            <p className="font-medium text-purple-900 dark:text-purple-300 text-sm mb-2">
              Digital Signature Requirements:
            </p>
            <ul className="text-xs text-purple-800 dark:text-purple-400 space-y-1 list-disc list-inside">
              <li>Document must be digitally signed for legal validity</li>
              <li>Signature will be verified for authenticity</li>
              {invoiceType === 'manual' && <li>File will be automatically optimized/compressed for storage efficiency</li>}
              <li>Maximum file size: {invoiceType === 'manual' ? '5 MB (with optimization)' : '10 MB'}</li>
              <li>Supported formats: PDF, DOC, DOCX</li>
            </ul>
          </div>
        </div>
      </div>

      {sizeOptimizationStatus && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-blue-600 dark:text-blue-400 ${sizeOptimizationStatus === 'optimizing' ? 'animate-spin' : ''}`}>
              {sizeOptimizationStatus === 'optimizing' ? 'progress_activity' : 'check_circle'}
            </span>
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-300 text-sm">
                {sizeOptimizationStatus === 'optimizing' ? 'Optimizing file size...' : 'File optimized successfully'}
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-400 mt-1">
                Original: {uploadedFile ? (uploadedFile.size / 1024 / 1024).toFixed(2) : '0'} MB
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        <div className="space-y-3">
          <span className="material-symbols-outlined text-5xl text-primary inline-block">
            lock
          </span>
          <div>
            <p className="font-semibold text-text-main-light dark:text-text-main-dark mb-1">
              Drag and drop your digitally signed document
            </p>
            <p className="text-sm text-text-sub-light dark:text-text-sub-dark mb-4">
              or
            </p>
          </div>
          <label className="inline-block">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleChange}
              disabled={sizeOptimizationStatus === 'optimizing'}
              className="hidden"
            />
            <span className="px-4 py-2 bg-primary hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold cursor-pointer transition-colors inline-block">
              Browse Files
            </span>
          </label>
          <p className="text-xs text-text-sub-light dark:text-text-sub-dark">
            PDF, DOC, DOCX • Max {invoiceType === 'manual' ? '5 MB' : '10 MB'}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-text-main-light dark:text-text-main-dark rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  )
}

function SupportingDocumentsStep({ invoiceType, onUpload, onBack, documents }: any) {
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files) {
      onUpload(e.dataTransfer.files)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onUpload(e.target.files)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-text-main-light dark:text-text-main-dark">
          Supporting Documents & Invoice Trail
        </h3>
        <p className="text-sm text-text-sub-light dark:text-text-sub-dark">
          {invoiceType === 'manual'
            ? 'Upload scanned documents with optimized file sizes. All supporting documents are retained for audit trail and storage efficiency.'
            : invoiceType === 'pos'
            ? 'POS invoices auto-post to PMS. Upload additional supporting documents for verification and audit purposes.'
            : 'Upload supporting documents for AR settlement verification. These will be linked to the AR module for compliance.'}
        </p>
      </div>

      {/* Invoice Trail Information */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex gap-3 mb-3">
          <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 flex-shrink-0">
            description
          </span>
          <div className="flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-300 text-sm mb-2">
              Supporting Document Trail
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-400">
              {invoiceType === 'pos' && 'POS receipts and transaction records are automatically linked to this invoice for verification and future reference.'}
              {invoiceType === 'manual' && 'Scanned documents with optimized file sizes ensure efficient storage while maintaining audit trail compliance.'}
              {invoiceType === 'ar' && 'All documents linked to AR settlement ID for complete traceability and compliance verification.'}
            </p>
          </div>
        </div>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        <div className="space-y-3">
          <span className="material-symbols-outlined text-5xl text-primary inline-block">
            cloud_upload
          </span>
          <div>
            <p className="font-semibold text-text-main-light dark:text-text-main-dark mb-1">
              Upload supporting documentation
            </p>
            <p className="text-sm text-text-sub-light dark:text-text-sub-dark mb-4">
              Drop files or browse — all documents retained for audit trail
            </p>
          </div>
          <label className="inline-block">
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx"
              onChange={handleChange}
              className="hidden"
            />
            <span className="px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer transition-colors inline-block">
              Browse Files
            </span>
          </label>
          <p className="text-xs text-text-sub-light dark:text-text-sub-dark">
            PDF, JPG, PNG, DOC, DOCX, XLSX (Max 50 MB total)
          </p>
        </div>
      </div>

      {documents.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
          <h4 className="font-semibold text-sm mb-3 text-text-main-light dark:text-text-main-dark">
            <span className="material-symbols-outlined text-sm align-middle mr-2 text-emerald-600">check_circle</span>
            Document Trail ({documents.length})
          </h4>
          <div className="space-y-2">
            {documents.map((doc: File, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">attachment</span>
                <div className="flex-1">
                  <p className="text-text-main-light dark:text-text-main-dark font-medium">{doc.name}</p>
                  <p className="text-xs text-text-sub-light dark:text-text-sub-dark">
                    {(doc.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded">
                  Linked
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-sub-light dark:text-text-sub-dark mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            All documents are retained for audit trail and compliance verification
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-text-main-light dark:text-text-main-dark rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => onUpload(new DataTransfer().items)}
          className="flex-1 px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

function CreateSupportingStep({ bookingId, invoiceType, onContinue, onBack }: any) {
  const [isCreating, setIsCreating] = useState(false)
  const [pmsPostingStatus, setPmsPostingStatus] = useState<'pending' | 'posting' | 'posted' | null>(null)

  const handleCreate = () => {
    setIsCreating(true)
    if (invoiceType === 'pos') {
      setPmsPostingStatus('posting')
      // Simulate POS to PMS auto-posting
      setTimeout(() => {
        setPmsPostingStatus('posted')
        setTimeout(() => {
          setIsCreating(false)
          onContinue()
        }, 1000)
      }, 2000)
    } else {
      // For manual and AR
      setTimeout(() => {
        setIsCreating(false)
        onContinue()
      }, 1500)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-text-main-light dark:text-text-main-dark">
          Create Supporting Document
        </h3>
        <p className="text-sm text-text-sub-light dark:text-text-sub-dark">
          Link this invoice to the PMS record as a supporting document. {invoiceType === 'pos' && 'POS invoices will automatically post to PMS after settlement.'}
        </p>
      </div>

      {/* POS Auto-Posting Information */}
      {invoiceType === 'pos' && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 space-y-3">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 flex-shrink-0">
              sync_alt
            </span>
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-300 text-sm mb-2">
                POS to PMS Auto-Integration
              </p>
              <p className="text-xs text-emerald-800 dark:text-emerald-400">
                POS invoices automatically post to PMS data post-settlement. This creates a live link visible in back office for verification and audit purposes.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 flex-shrink-0">
          verified
        </span>
        <div>
          <p className="font-medium text-blue-900 dark:text-blue-300 text-sm">
            Creates an officially linked supporting document in PMS
          </p>
          <p className="text-xs text-blue-800 dark:text-blue-400 mt-1">
            Booking ID: {bookingId} • Type: {invoiceType.toUpperCase()} • Status: Ready to Link
          </p>
        </div>
      </div>

      {/* Document Details */}
      <div className="space-y-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold text-sm mb-4 text-text-main-light dark:text-text-main-dark">
            Supporting Document Configuration
          </h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-text-sub-light dark:text-text-sub-dark">Document Type:</span>
              <span className="font-medium text-text-main-light dark:text-text-main-dark">PMS Supporting Invoice</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-sub-light dark:text-text-sub-dark">Invoice Type:</span>
              <span className="font-medium text-text-main-light dark:text-text-main-dark uppercase">{invoiceType}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-sub-light dark:text-text-sub-dark">Audit Trail:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Enabled</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-sub-light dark:text-text-sub-dark">Compliance Status:</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">Pending Linkage</span>
            </div>
            {invoiceType === 'pos' && (
              <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700">
                <span className="text-text-sub-light dark:text-text-sub-dark">PMS Posting:</span>
                <span className={`font-medium ${pmsPostingStatus === 'posted' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {pmsPostingStatus === 'posting' && '⟳ Processing...'}
                  {pmsPostingStatus === 'posted' && '✓ Auto-Posted'}
                  {!pmsPostingStatus && 'Ready to Auto-Post'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-text-main-light dark:text-text-main-dark rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="flex-1 px-4 py-2 bg-primary hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {isCreating && <span className="material-symbols-outlined animate-spin">progress_activity</span>}
          <span className="material-symbols-outlined">link</span>
          <span>CREATE SUPPORTING</span>
        </button>
      </div>
    </div>
  )
}

function VerificationStep({ customerName, corporationName, totalAmount, invoiceType, documentCount, hasSig, onContinue, onBack }: any) {
  const [hasGST, setHasGST] = useState(false)
  const [hasARSettlement, setHasARSettlement] = useState(false)

  const handleContinue = () => {
    onContinue(hasGST, hasARSettlement)
  }

  // AR invoices should default to AR settlement
  const defaultARSettlement = invoiceType === 'ar'

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-text-main-light dark:text-text-main-dark">
          Verify Invoice Details & E-Invoicing Eligibility
        </h3>
        <p className="text-sm text-text-sub-light dark:text-text-sub-dark">
          Review all details and indicate if this invoice requires GST compliance or AR settlement processing.
        </p>
      </div>

      <div className="space-y-4">
        {/* Invoice Summary */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold text-sm mb-4 text-text-main-light dark:text-text-main-dark">
            Invoice Summary
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-sub-light dark:text-text-sub-dark uppercase tracking-wide mb-1">
                Customer Name
              </p>
              <p className="font-medium text-text-main-light dark:text-text-main-dark">{customerName}</p>
            </div>
            <div>
              <p className="text-xs text-text-sub-light dark:text-text-sub-dark uppercase tracking-wide mb-1">
                Corporation
              </p>
              <p className="font-medium text-text-main-light dark:text-text-main-dark">{corporationName}</p>
            </div>
            <div>
              <p className="text-xs text-text-sub-light dark:text-text-sub-dark uppercase tracking-wide mb-1">
                Total Amount
              </p>
              <p className="font-bold text-lg text-primary">₹{formatInr(totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-text-sub-light dark:text-text-sub-dark uppercase tracking-wide mb-1">
                Invoice Type
              </p>
              <p className="font-medium text-text-main-light dark:text-text-main-dark uppercase">{invoiceType}</p>
            </div>
          </div>
        </div>

        {/* GST & AR Settlement Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* GST Option */}
          <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            hasGST 
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' 
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
          }`}
            onClick={() => setHasGST(!hasGST)}
          >
            <div className="flex items-start gap-3">
              <input 
                type="checkbox" 
                checked={hasGST} 
                onChange={(e) => setHasGST(e.target.checked)}
                className="w-4 h-4 mt-1 cursor-pointer"
              />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-300 text-sm mb-1">
                  GST Applicable
                </h4>
                <p className="text-xs text-blue-800 dark:text-blue-400 mb-3">
                  Invoice includes GST and requires E-Invoicing (will generate ARN from GST portal)
                </p>
                {hasGST && (
                  <div className="flex items-center gap-2 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 p-2 rounded">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>E-Invoice will be generated with ARN</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AR Settlement Option */}
          <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
            hasARSettlement 
              ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700' 
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700'
          }`}
            onClick={() => setHasARSettlement(!hasARSettlement)}
          >
            <div className="flex items-start gap-3">
              <input 
                type="checkbox" 
                checked={hasARSettlement || defaultARSettlement} 
                onChange={(e) => setHasARSettlement(e.target.checked)}
                className="w-4 h-4 mt-1 cursor-pointer"
                disabled={defaultARSettlement}
              />
              <div className="flex-1">
                <h4 className="font-semibold text-purple-900 dark:text-purple-300 text-sm mb-1">
                  AR Settlement {defaultARSettlement && <span className="text-xs font-normal">(Auto-enabled)</span>}
                </h4>
                <p className="text-xs text-purple-800 dark:text-purple-400 mb-3">
                  Invoice is part of Accounts Receivable settlement - will be linked to AR module
                </p>
                {(hasARSettlement || defaultARSettlement) && (
                  <div className="flex items-center gap-2 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 p-2 rounded">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>AR settlement processing enabled</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pre-Checkout Verification */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold text-sm mb-4 text-text-main-light dark:text-text-main-dark">
            Pre-Checkout Verification
          </h4>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={hasSig} readOnly className="w-4 h-4" />
              <span className="text-sm text-text-main-light dark:text-text-main-dark">
                Digital signature verified
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={documentCount > 0} readOnly className="w-4 h-4" />
              <span className="text-sm text-text-main-light dark:text-text-main-dark">
                Supporting documents uploaded ({documentCount})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-sm text-text-main-light dark:text-text-main-dark">
                PMS supporting document created
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-sm text-text-main-light dark:text-text-main-dark">
                All details verified and correct
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-text-main-light dark:text-text-main-dark rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <span>Generate Invoice & Continue</span>
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>
  )
}

function EInvoiceStep({ invoiceNumber, totalAmount, onGenerate, onSkip, onBack }: any) {
  const [showForm, setShowForm] = useState(false)
  const [gstNumber, setGstNumber] = useState('')
  const [gstin, setGstin] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = () => {
    if (gstNumber && gstin) {
      setIsGenerating(true)
      setTimeout(() => {
        setIsGenerating(false)
        onGenerate(gstNumber, gstin)
      }, 2000)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-text-main-light dark:text-text-main-dark">
          E-Invoice Generation & GST Portal Integration
        </h3>
        <p className="text-sm text-text-sub-light dark:text-text-sub-dark">
          Generate E-Invoice for GST compliance. Upon generation, an ARN (Acknowledgment Receipt Number) will be issued by the GST portal.
        </p>
      </div>

      {/* GST Portal Integration Info */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 space-y-3">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-orange-600 dark:text-orange-400 flex-shrink-0 text-2xl">
            verified_user
          </span>
          <div>
            <p className="font-bold text-orange-900 dark:text-orange-300 text-sm mb-2">
              GST Portal Integration
            </p>
            <p className="text-xs text-orange-800 dark:text-orange-400 leading-relaxed mb-3">
              E-Invoice generation requires valid GST registration. The system will communicate with the GST portal to generate and receive ARN (Acknowledgment Receipt Number) for compliance tracking.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs bg-orange-200 dark:bg-orange-900/40 text-orange-900 dark:text-orange-300 px-2 py-1 rounded">
                GSTN Portal Connected
              </span>
              <span className="text-xs bg-orange-200 dark:bg-orange-900/40 text-orange-900 dark:text-orange-300 px-2 py-1 rounded">
                Real-time ARN Generation
              </span>
              <span className="text-xs bg-orange-200 dark:bg-orange-900/40 text-orange-900 dark:text-orange-300 px-2 py-1 rounded">
                Compliance Verified
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <h4 className="font-semibold text-sm mb-3 text-text-main-light dark:text-text-main-dark">
          Invoice Details for E-Invoicing
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-sub-light dark:text-text-sub-dark">Invoice #:</span>
            <span className="font-medium text-text-main-light dark:text-text-main-dark">{invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-sub-light dark:text-text-sub-dark">Gross Amount:</span>
            <span className="font-bold text-text-main-light dark:text-text-main-dark">₹{formatInr(totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-sub-light dark:text-text-sub-dark">GST Status:</span>
            <span className="font-medium text-amber-600 dark:text-amber-400">Pending Registration</span>
          </div>
        </div>
      </div>

      {!showForm ? (
        <div className="flex gap-3 flex-col">
          <button
            onClick={() => setShowForm(true)}
            className="w-full px-4 py-3 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 border border-emerald-300 dark:border-emerald-700"
          >
            <span className="material-symbols-outlined">verified</span>
            <span>CREATE E-INVOICE</span>
          </button>
          <button
            onClick={onSkip}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 text-text-main-light dark:text-text-main-dark rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Skip E-Invoice (Non-GST Invoice)
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-800 dark:text-blue-400">
              <span className="font-semibold">Note:</span> Once E-Invoice is generated, the system will receive ARN from GST portal. This will trigger automated email to client with complete invoice trail and supporting documentation.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main-light dark:text-text-main-dark mb-2">
              GSTIN (15-digit GST Identification Number)
            </label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="22AAAAA1234A1Z5"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-text-main-light dark:text-text-main-dark placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
            />
            <p className="text-xs text-text-sub-light dark:text-text-sub-dark mt-1 font-medium">
              Format: State Code (2) + PAN Prefix (10) + Entity Type (1) + Reserve (1) + Checksum (1)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main-light dark:text-text-main-dark mb-2">
              Additional GST Details / References
            </label>
            <textarea
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="AR Settlement ID, PAN, or other GST registration references..."
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-text-main-light dark:text-text-main-dark placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-text-main-light dark:text-text-main-dark rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={!gstin || isGenerating}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating && <span className="material-symbols-outlined animate-spin">progress_activity</span>}
              {isGenerating ? 'Connecting to GST Portal...' : 'Generate & Get ARN'}
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-text-main-light dark:text-text-main-dark rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Back
          </button>
        </div>
      )}
    </div>
  )
}

function CoverLetterStep({ invoiceNumber, customerName, corporationName, totalAmount, eInvoiceArn, gstData, arData, onSend, onBack }: any) {
  const [isSending, setIsSending] = useState(false)
  const [showForwardingInstructions, setShowForwardingInstructions] = useState(false)

  const handleSend = () => {
    setIsSending(true)
    setTimeout(() => {
      setIsSending(false)
      onSend()
    }, 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-text-main-light dark:text-text-main-dark">
          Send Cover Letter & Invoice to Client
        </h3>
        <p className="text-sm text-text-sub-light dark:text-text-sub-dark">
          Final step: Send automated cover letter with complete invoice and supporting documentation trail to client.
        </p>
      </div>

      {/* Data Sources Integration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GST Portal Data */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-2 mb-3">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl flex-shrink-0">
              verified_user
            </span>
            <h4 className="font-semibold text-blue-900 dark:text-blue-300 text-sm">GST Portal Data</h4>
          </div>
          <div className="space-y-2 text-xs text-blue-800 dark:text-blue-400">
            {gstData && eInvoiceArn ? (
              <>
                <div className="flex justify-between">
                  <span>GSTIN:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{gstData.gstin}</span>
                </div>
                <div className="flex justify-between">
                  <span>ARN Status:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Generated</span>
                </div>
                <div className="flex justify-between">
                  <span>ARN Number:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{eInvoiceArn}</span>
                </div>
                <div className="flex justify-between">
                  <span>Compliance:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Verified</span>
                </div>
                <div className="flex justify-between">
                  <span>Portal Status:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Connected</span>
                </div>
              </>
            ) : (
              <div className="py-2">
                <p className="text-blue-700 dark:text-blue-300 font-medium mb-2">ℹ️ Non-GST Invoice</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  This invoice is not GST-compliant and will not be processed through the GST portal.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* AR Module Data */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-start gap-2 mb-3">
            <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-xl flex-shrink-0">
              account_balance
            </span>
            <h4 className="font-semibold text-purple-900 dark:text-purple-300 text-sm">AR Module Data</h4>
          </div>
          <div className="space-y-2 text-xs text-purple-800 dark:text-purple-400">
            {arData ? (
              <>
                <div className="flex justify-between">
                  <span>Settlement ID:</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">{arData.arId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Invoice Linked:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Yes</span>
                </div>
                <div className="flex justify-between">
                  <span>Audit Trail:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Complete</span>
                </div>
                <div className="flex justify-between">
                  <span>Module Status:</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">Integrated</span>
                </div>
              </>
            ) : (
              <div className="py-2">
                <p className="text-purple-700 dark:text-purple-300 font-medium mb-2">ℹ️ Standard Invoice</p>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  This invoice is not linked to AR settlement processing.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cover Letter Preview */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 max-h-96 overflow-y-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div className="space-y-4 text-sm text-text-main-light dark:text-text-main-dark font-family-serif">
            <p className="text-right text-xs">
              <strong>Date:</strong> {new Date().toLocaleDateString()}
            </p>
            <p className="mb-4">
              <strong>To:</strong> {customerName} <br />
              <strong>Organization:</strong> {corporationName}
            </p>
            <hr className="border-slate-300 dark:border-slate-600 my-3" />
            <p>
              <strong>Subject: Submission of Invoices with Statement of Accounts</strong>
            </p>
            <p>Dear Sir/Madam,</p>
            <p>
              Greetings from our side.
            </p>
            <p>
              Please find below the Statement of Accounts for your reference, reflecting the transactions recorded in our books up to date. As per our records, an outstanding balance of <strong>₹{formatInr(totalAmount)}</strong> is currently due for payment. We request you to kindly review the statement and arrange for payment at the earliest.
            </p>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-4 rounded text-xs my-4">
              <p className="font-bold mb-2 text-emerald-900 dark:text-emerald-300">Invoice Details:</p>
              <div className="space-y-1 text-emerald-800 dark:text-emerald-400">
                <div><strong>Invoice Number:</strong> {invoiceNumber}</div>
                <div><strong>Amount:</strong> ₹{formatInr(totalAmount)}</div>
                {eInvoiceArn && <div><strong>E-Invoice ARN:</strong> {eInvoiceArn}</div>}
                <div><strong>Generated:</strong> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
                <div><strong>Supporting Documents:</strong> Attached (POS receipts, verifications, audit trail)</div>
              </div>
            </div>
            <p>
              In case of any discrepancy, kindly inform us within 48 hours, so that we can reconcile the same promptly. Your timely support in clearing the dues will be highly appreciated and will help us maintain smooth business operations.
            </p>
            <p>
              Yours truly,
            </p>
            <p className="pt-4">
              <strong>Finance Team</strong> <br />
              Hotel Kandla <br />
              Radisson Hotel Group
            </p>
          </div>
        </div>
      </div>

      {/* Forwarding Instructions */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg">
        <button
          onClick={() => setShowForwardingInstructions(!showForwardingInstructions)}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between items-center transition-colors"
        >
          <span className="font-semibold text-text-main-light dark:text-text-main-dark text-sm">
            📋 Final Delivery & Forwarding Instructions
          </span>
          <span className="material-symbols-outlined">
            {showForwardingInstructions ? 'expand_less' : 'expand_more'}
          </span>
        </button>
        {showForwardingInstructions && (
          <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-700 space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-text-main-light dark:text-text-main-dark mb-2">
                📦 Package Contents
              </h4>
              <ul className="list-disc list-inside space-y-1 text-text-sub-light dark:text-text-sub-dark text-xs">
                <li>Final Invoice (Digitally Signed)</li>
                <li>Cover Letter (This communication)</li>
                <li>Supporting Documentation Trail</li>
                <li>POS Receipts (if applicable)</li>
                <li>Verification Records</li>
                {eInvoiceArn && <li>E-Invoice with ARN from GST Portal</li>}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-text-main-light dark:text-text-main-dark mb-2">
                ✉️ Predefined Forwarding Instructions
              </h4>
              <p className="text-text-sub-light dark:text-text-sub-dark text-xs mb-2">
                This invoice package will be forwarded to client portal with the following instructions:
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded text-xs text-blue-900 dark:text-blue-300 space-y-1">
                <p><strong>1. STORAGE:</strong> Maintain this invoice and all supporting documents as per compliance requirements (minimum 5 years for GST, 7 years for accounting).</p>
                <p><strong>2. VERIFICATION:</strong> Cross-check all line items, dates, and amounts match your records. Report discrepancies within 48 hours.</p>
                <p><strong>3. PAYMENT:</strong> Process payment as per the stipulated terms and due date indicated in the invoice.</p>
                {eInvoiceArn && <p><strong>4. E-INVOICE:</strong> This invoice is GST compliant with ARN: {eInvoiceArn}. Can be cross-verified on GST portal.</p>}
                <p><strong>5. INQUIRY:</strong> Contact Finance Team at finance@hotelkandla.com for any clarifications.</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-text-main-light dark:text-text-main-dark mb-2">
                🔐 Compliance & Traceability
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded">
                  <p className="text-emerald-900 dark:text-emerald-300 font-semibold">Digital Signature</p>
                  <p className="text-emerald-800 dark:text-emerald-400">✓ Verified</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                  <p className="text-blue-900 dark:text-blue-300 font-semibold">Audit Trail</p>
                  <p className="text-blue-800 dark:text-blue-400">✓ Complete</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                  <p className="text-purple-900 dark:text-purple-300 font-semibold">GST Compliance</p>
                  <p className="text-purple-800 dark:text-purple-400">{eInvoiceArn ? '✓ E-invoice' : '✓ Non-GST'}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                  <p className="text-orange-900 dark:text-orange-300 font-semibold">Minimal Manual Work</p>
                  <p className="text-orange-800 dark:text-orange-400">✓ Automated</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-text-main-light dark:text-text-main-dark rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSend}
          disabled={isSending}
          className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {isSending && <span className="material-symbols-outlined animate-spin">progress_activity</span>}
          <span className="material-symbols-outlined">mail</span>
          <span>SEND & DELIVER</span>
        </button>
      </div>
    </div>
  )
}
