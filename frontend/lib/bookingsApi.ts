import { tokenStorage } from "@/lib/auth"

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000"

const parseErrorMessage = async (response: Response) => {
  try {
    const data = await response.json()
    return data?.error?.message ?? "Request failed"
  } catch {
    return "Request failed"
  }
}

const getAuthHeaders = () => {
  const token = tokenStorage.get()
  if (!token) {
    throw new Error("Unauthorized")
  }

  return {
    Authorization: `Bearer ${token}`
  }
}

const request = async <T>(path: string, options: RequestInit) => {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...getAuthHeaders(),
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {})
    }
  })

  if (!response.ok) {
    const message = await parseErrorMessage(response)
    throw new Error(message)
  }

  return (await response.json()) as T
}

export interface BookingOrganization {
  id: string
  name: string
  contactEmail: string | null
}

export interface BookingEmployee {
  id: string
  employeeCode: string
  fullName: string
  email: string | null
  department: string | null
  designation: string | null
}

export interface ContractRoomType {
  roomType: string
  nightlyRate: number
  inclusions: string | null
}

export interface BookingRecord {
  id: string
  bookingNumber: string
  organizationId: string
  organizationName: string
  organizationCreditPeriod?: string | null
  organizationEmail?: string | null
  employeeId: string
  employeeName: string
  employeeCode: string
  roomType: string
  checkInDate: string
  checkOutDate: string
  nights: number
  pricePerNight: number
  totalPrice: number
  gstApplicable: boolean
  status: "pending" | "confirmed" | "checked-in" | "checked-out"
  invoiceId?: string | null
  invoiceNumber?: string | null
  invoiceDate?: string | null
  invoiceDueDate?: string | null
  sentAt?: string | null
}

export interface BookingRequestRecord {
  id: string
  bookingNumber: string
  organizationId: string
  organizationName: string
  organizationEmail?: string | null
  employeeId: string
  employeeName: string
  employeeCode: string
  roomType: string
  checkInDate: string
  checkOutDate: string
  nights: number
  pricePerNight: number
  totalPrice: number
  gstApplicable: boolean
  status: 'pending' | 'accepted' | 'rejected'
  rejectionReason?: string | null
  requestedAt: string
  respondedAt?: string | null
  bookingId?: string | null
}

export interface BookingBill {
  id: string
  bookingId: string
  billCategory: string
  fileName: string
  hasFile?: boolean
  fileUrl?: string | null
  storageProvider?: "supabase" | "cloudinary" | "local" | "metadata"
  billAmount: number
  mimeType: string | null
  fileSize: number | null
  notes: string | null
  createdAt: string
}

export interface DashboardSummary {
  totalInvoiced: number
  totalCollected: number
  totalOutstanding: number
  overdueInvoices: number
}

export interface DashboardInvoiceVsCollectionPoint {
  label: string
  invoiced: number
  collected: number
}

export interface DashboardAgingBucket {
  label: string
  amount: number
  percentage: number
}

export interface DashboardAging {
  totalDue: number
  buckets: DashboardAgingBucket[]
}

export interface DashboardOrganizationOutstanding {
  name: string
  amount: number
}

export interface HotelFinanceDashboardResponse {
  summary: DashboardSummary
  invoiceVsCollection: DashboardInvoiceVsCollectionPoint[]
  aging: DashboardAging
  topOrganizationsOutstanding: DashboardOrganizationOutstanding[]
}

export const fetchBookingOrganizations = async () => {
  return request<{ organizations: BookingOrganization[] }>("/api/bookings/meta/organizations", {
    method: "GET"
  })
}

export const fetchHotelFinanceDashboardSummary = async () => {
  return request<HotelFinanceDashboardResponse>("/api/bookings/dashboard/summary", {
    method: "GET"
  })
}

export const fetchBookingEmployees = async (organizationId: string) => {
  return request<{ employees: BookingEmployee[] }>(`/api/bookings/meta/organizations/${organizationId}/employees`, {
    method: "GET"
  })
}

export const fetchBookingRoomTypes = async (organizationId: string) => {
  return request<{ contractId: string; roomTypes: ContractRoomType[] }>(
    `/api/bookings/meta/organizations/${organizationId}/room-types`,
    {
      method: "GET"
    }
  )
}

export const fetchBookings = async (params?: { status?: string; fromDate?: string; toDate?: string }) => {
  const searchParams = new URLSearchParams()
  if (params?.status && params.status !== "all") {
    searchParams.set("status", params.status)
  }
  if (params?.fromDate) {
    searchParams.set("fromDate", params.fromDate)
  }
  if (params?.toDate) {
    searchParams.set("toDate", params.toDate)
  }

  return request<{ bookings: BookingRecord[] }>(`/api/bookings${searchParams.toString() ? `?${searchParams.toString()}` : ""}`, {
    method: "GET"
  })
}

export const fetchBookingRequests = async (params?: { status?: string }) => {
  const searchParams = new URLSearchParams()
  if (params?.status && params.status !== 'all') {
    searchParams.set('status', params.status)
  }

  return request<{ requests: BookingRequestRecord[] }>(
    `/api/bookings/requests${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
    {
      method: 'GET'
    }
  )
}

export const decideBookingRequest = async (
  requestId: string,
  payload: { action: 'accept' | 'reject'; rejectionReason?: string }
) => {
  return request<{ ok: boolean; status: 'accepted' | 'rejected'; booking?: BookingRecord }>(
    `/api/bookings/requests/${requestId}/decision`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  )
}

export const createBooking = async (payload: {
  bookingNumber: string
  organizationId: string
  employeeId: string
  roomType: string
  checkInDate: string
  checkOutDate: string
  gstApplicable: boolean
  status?: "pending" | "confirmed" | "checked-in" | "checked-out"
}) => {
  return request<{ booking: BookingRecord }>("/api/bookings", {
    method: "POST",
    body: JSON.stringify(payload)
  })
}

export const fetchBookingById = async (bookingId: string) => {
  return request<{ booking: BookingRecord }>(`/api/bookings/${bookingId}`, {
    method: "GET"
  })
}

export const fetchBookingBills = async (bookingId: string) => {
  return request<{ bills: BookingBill[] }>(`/api/bookings/${bookingId}/bills`, {
    method: "GET"
  })
}

export const addBookingBill = async (
  bookingId: string,
  payload: {
    billCategory: string
    fileName?: string
    file?: File | null
    billAmount?: number
    mimeType?: string | null
    fileSize?: number | null
    notes?: string | null
  }
) => {
  if (payload.file) {
    const formData = new FormData()
    formData.set("billCategory", payload.billCategory)
    formData.set("billAmount", String(payload.billAmount ?? 0))
    formData.set("notes", payload.notes ?? "")
    formData.set("file", payload.file)

    return request<{ bill: BookingBill }>(`/api/bookings/${bookingId}/bills`, {
      method: "POST",
      body: formData
    })
  }

  return request<{ bill: BookingBill }>(`/api/bookings/${bookingId}/bills`, {
    method: "POST",
    body: JSON.stringify(payload)
  })
}

export const deleteBookingBill = async (bookingId: string, billId: string) => {
  return request<{ ok: boolean }>(`/api/bookings/${bookingId}/bills/${billId}`, {
    method: "DELETE"
  })
}

export const sendBookingInvoice = async (
  bookingId: string,
  payload: {
    recipientEmail?: string
    ccEmail?: string
    portalBaseUrl?: string
    bills?: Array<{ category: string; fileName: string }>
  }
) => {
  return request<{
    ok: boolean
    recipientEmail: string
    invoicesPortalLink: string
    invoice: {
      id: string
      invoiceNumber: string
      invoiceDate: string
      dueDate: string
      amount: number
      status: string
      sentAt: string
    }
  }>(`/api/bookings/${bookingId}/send`, {
    method: "POST",
    body: JSON.stringify(payload)
  })
}
