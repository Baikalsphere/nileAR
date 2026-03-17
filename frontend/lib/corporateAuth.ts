export interface CorporateAuthUser {
  id: string;
  userId: string;
  name: string;
  role: string;
  isSubUser?: boolean;
  portalUserId?: string;
  fullName?: string;
  allowedPages?: string[];
}

export interface CorporateProfile {
  name: string;
  registrationNumber: string | null;
  address: string | null;
  contactEmail: string | null;
  phone: string | null;
}

export interface CorporateAuthResponse {
  user: CorporateAuthUser;
  mustSetPassword?: boolean;
  accessToken: string;
}

export interface CorporateProfileResponse {
  user: CorporateAuthUser;
  profile: CorporateProfile;
  mustSetPassword: boolean;
}

export interface CorporateEmployee {
  id: string;
  organizationId: string;
  fullName: string;
  employeeCode: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  costCenter: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface CorporateEmployeePayload {
  fullName: string;
  employeeCode: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  costCenter?: string | null;
  status?: "active" | "inactive";
}

export interface CorporateInvoice {
  id: string;
  hotelId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  status: "overdue" | "unpaid" | "paid";
  employeeName: string;
  employeeCode: string;
  propertyName: string | null;
  senderHotelName: string | null;
  senderHotelLogoUrl: string | null;
  senderHotelLocation: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface CorporateHotelSummary {
  id: string;
  name: string;
  location: string;
  logoUrl: string | null;
  totalStays: number;
  activeStays: number;
  totalSpent: number;
  outstanding: number;
  pendingInvoices: number;
  lastStayDate: string | null;
  status: "active" | "settled";
}

export interface CorporateHotelLatestContract {
  id: string;
  status: "draft" | "sent" | "signed";
  contractData?: Record<string, unknown> | null;
  signedAt: string | null;
  signedBy: string | null;
  signedDesignation: string | null;
  createdAt: string;
  updatedAt: string;
  pdfUrl: string;
}

export interface CorporateHotelSignedContractHistoryItem {
  id: string;
  status: "signed";
  signedAt: string;
  signedBy: string | null;
  signedDesignation: string | null;
  createdAt: string;
  updatedAt: string;
  pdfUrl: string;
}

export interface CorporateInvoiceDetail {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  status: "overdue" | "unpaid" | "paid";
  bookingNumber: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  pricePerNight: number;
  roomCharges: number;
  employeeName: string;
  employeeCode: string;
  propertyName: string | null;
  senderHotelName: string | null;
  senderHotelLogoUrl: string | null;
  senderHotelLocation: string | null;
  sentAt: string | null;
  createdAt: string;
  bills: Array<{
    id: string;
    billCategory: string;
    fileName: string;
    hasFile: boolean;
    fileUrl: string | null;
    billAmount: number;
    mimeType: string | null;
    fileSize: number | null;
    notes: string | null;
    createdAt: string;
  }>;
}

export interface CorporateEmployeeStay {
  id: string;
  bookingId: string;
  employeeName: string;
  employeeCode: string;
  department: string | null;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalAmount: number;
  status: "pending_invoice" | "invoiced" | "paid";
  invoiceId: string | null;
  invoiceNumber: string | null;
  createdAt: string;
}

export interface CorporateBookingRequestEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string | null;
  department: string | null;
  designation: string | null;
}

export interface CorporateBookingRequestRoomType {
  roomType: string;
  nightlyRate: number;
  inclusions: string | null;
}

export interface CorporateBookingRequestMeta {
  hotel: {
    id: string;
    name: string;
    email: string | null;
  };
  contractId: string;
  employees: CorporateBookingRequestEmployee[];
  roomTypes: CorporateBookingRequestRoomType[];
}

export interface CorporateBookingRequestRecord {
  id: string;
  bookingNumber: string;
  hotelId?: string;
  hotelName?: string;
  employeeName?: string;
  employeeCode?: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  pricePerNight: number;
  totalPrice: number;
  gstApplicable: boolean;
  status: "pending" | "accepted" | "rejected";
  requestedAt: string;
}

export const corporateApiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

const toAbsoluteApiUrl = (value?: string | null) => {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${corporateApiBaseUrl}${value}`;
  }

  return value;
};
const corporateTokenKey = "cp_access_token";

const parseErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    const fieldErrors = data?.error?.details?.fieldErrors;
    if (fieldErrors && typeof fieldErrors === "object") {
      const firstField = Object.keys(fieldErrors).find((key) => Array.isArray(fieldErrors[key]) && fieldErrors[key].length > 0);
      if (firstField) {
        return fieldErrors[firstField][0] as string;
      }
    }

    const formErrors = data?.error?.details?.formErrors;
    if (Array.isArray(formErrors) && formErrors.length > 0) {
      return formErrors[0] as string;
    }

    return data?.error?.message ?? "Request failed";
  } catch {
    return "Request failed";
  }
};

export const corporateTokenStorage = {
  get: () => (typeof window !== "undefined" ? window.sessionStorage.getItem(corporateTokenKey) : null),
  set: (token: string) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(corporateTokenKey, token);
    }
  },
  clear: () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(corporateTokenKey);
    }
  }
};

const getCorporateAuthHeaders = () => {
  const token = corporateTokenStorage.get();
  if (!token) {
    throw new Error("Unauthorized");
  }

  return {
    Authorization: `Bearer ${token}`
  };
};

export const loginCorporate = async (username: string, password: string) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  const data = (await response.json()) as CorporateAuthResponse;
  corporateTokenStorage.set(data.accessToken);
  setCorporateUserRoleInStorage({
    role: data.user.role || "admin",
    isSubUser: data.user.isSubUser || false,
    allowedPages: data.user.allowedPages || []
  });
  return data;
};

export const fetchCorporateProfile = async () => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/me`, {
    method: "GET",
    credentials: "include",
    headers: {
      ...getCorporateAuthHeaders()
    }
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as CorporateProfileResponse;
};

export const updateCorporateProfile = async (payload: {
  name: string;
  registrationNumber?: string;
  address?: string;
  contactEmail?: string;
  phone?: string;
}) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/profile`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getCorporateAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as CorporateProfileResponse;
};

export const setCorporatePassword = async (newPassword: string, confirmPassword: string) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/set-password`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getCorporateAuthHeaders()
    },
    body: JSON.stringify({ newPassword, confirmPassword })
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as { ok: boolean; mustSetPassword: boolean };
};

export const logoutCorporate = async () => {
  try {
    await fetch(`${corporateApiBaseUrl}/api/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
  } finally {
    corporateTokenStorage.clear();
  }
};

export const fetchCorporateEmployees = async (search?: string) => {
  const params = new URLSearchParams();
  if (search && search.trim().length > 0) {
    params.set("search", search.trim());
  }

  const response = await fetch(
    `${corporateApiBaseUrl}/api/auth/corporate/employees${params.toString() ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        ...getCorporateAuthHeaders()
      }
    }
  );

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as { employees: CorporateEmployee[] };
};

export const createCorporateEmployee = async (payload: CorporateEmployeePayload) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/employees`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getCorporateAuthHeaders()
    },
    body: JSON.stringify({ ...payload, status: payload.status ?? "active" })
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as { employee: CorporateEmployee };
};

export const updateCorporateEmployee = async (employeeId: string, payload: CorporateEmployeePayload) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/employees/${employeeId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getCorporateAuthHeaders()
    },
    body: JSON.stringify({ ...payload, status: payload.status ?? "active" })
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as { employee: CorporateEmployee };
};

export const fetchCorporateInvoices = async () => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/invoices`, {
    method: "GET",
    credentials: "include",
    headers: {
      ...getCorporateAuthHeaders()
    }
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  const data = (await response.json()) as { invoices: CorporateInvoice[] };
  return {
    invoices: data.invoices.map((invoice) => ({
      ...invoice,
      senderHotelLogoUrl: toAbsoluteApiUrl(invoice.senderHotelLogoUrl)
    }))
  };
};

export const fetchCorporateHotels = async () => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/hotels`, {
    method: "GET",
    credentials: "include",
    headers: {
      ...getCorporateAuthHeaders()
    }
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  const data = (await response.json()) as { hotels: CorporateHotelSummary[] };
  return {
    hotels: data.hotels.map((hotel) => ({
      ...hotel,
      logoUrl: toAbsoluteApiUrl(hotel.logoUrl)
    }))
  };
};

export const fetchCorporateHotelLatestContract = async (hotelId: string) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/hotels/${hotelId}/contracts/latest`, {
    method: "GET",
    credentials: "include",
    headers: {
      ...getCorporateAuthHeaders()
    }
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  const data = (await response.json()) as { contract: CorporateHotelLatestContract | null };

  return {
    contract: data.contract
      ? {
          ...data.contract,
        pdfUrl: toAbsoluteApiUrl(data.contract.pdfUrl) ?? data.contract.pdfUrl
        }
      : null
  };
};

export const fetchCorporateHotelSignedContractHistory = async (hotelId: string) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/hotels/${hotelId}/contracts/signed-history`, {
    method: "GET",
    credentials: "include",
    headers: {
      ...getCorporateAuthHeaders()
    }
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  const data = (await response.json()) as {
    currentSignedContract: CorporateHotelSignedContractHistoryItem | null;
    previousSignedContracts: CorporateHotelSignedContractHistoryItem[];
  };

  const withResolvedUrl = (contract: CorporateHotelSignedContractHistoryItem) => ({
    ...contract,
    pdfUrl: toAbsoluteApiUrl(contract.pdfUrl) ?? contract.pdfUrl
  });

  return {
    currentSignedContract: data.currentSignedContract ? withResolvedUrl(data.currentSignedContract) : null,
    previousSignedContracts: (data.previousSignedContracts ?? []).map(withResolvedUrl)
  };
};

export const fetchCorporateInvoiceDetail = async (invoiceId: string) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/invoices/${invoiceId}`, {
    method: "GET",
    credentials: "include",
    headers: {
      ...getCorporateAuthHeaders()
    }
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  const data = (await response.json()) as { invoice: CorporateInvoiceDetail };
  return {
    invoice: {
      ...data.invoice,
      senderHotelLogoUrl: toAbsoluteApiUrl(data.invoice.senderHotelLogoUrl)
    }
  };
};

export const fetchCorporateEmployeeStays = async () => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/employee-stays`, {
    method: "GET",
    credentials: "include",
    headers: {
      ...getCorporateAuthHeaders()
    }
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as { stays: CorporateEmployeeStay[] };
};

export const fetchCorporateBookingRequestMeta = async (hotelId: string) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/hotels/${hotelId}/booking-request-meta`, {
    method: "GET",
    credentials: "include",
    headers: {
      ...getCorporateAuthHeaders()
    }
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as CorporateBookingRequestMeta;
};

export const createCorporateBookingRequest = async (payload: {
  hotelId: string;
  bookingNumber: string;
  employeeId: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  gstApplicable: boolean;
}) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/booking-requests`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getCorporateAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as { request: CorporateBookingRequestRecord };
};

export const fetchCorporateBookingRequests = async (params?: {
  status?: "all" | "pending" | "accepted" | "rejected";
}) => {
  const searchParams = new URLSearchParams();
  if (params?.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }

  const response = await fetch(
    `${corporateApiBaseUrl}/api/auth/corporate/booking-requests${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        ...getCorporateAuthHeaders()
      }
    }
  );

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as { requests: CorporateBookingRequestRecord[] };
};

// ══════════════════════════════════════════════════════════════
// Portal User Management (Corporate)
// ══════════════════════════════════════════════════════════════

export interface CorporatePortalUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  allowed_pages: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CorporatePortalUserPayload {
  fullName: string;
  email: string;
  role: "admin" | "user";
  allowedPages: string[];
}

export interface CorporatePortalUserUpdatePayload {
  fullName?: string;
  role?: "admin" | "user";
  allowedPages?: string[];
  isActive?: boolean;
}

export const fetchCorporateUsers = async () => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/users`, {
    method: "GET",
    credentials: "include",
    headers: { ...getCorporateAuthHeaders() }
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as { users: CorporatePortalUser[] };
};

export const createCorporateUser = async (payload: CorporatePortalUserPayload) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/users`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getCorporateAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as { user: CorporatePortalUser };
};

export const updateCorporateUser = async (userId: string, payload: CorporatePortalUserUpdatePayload) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/users/${userId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getCorporateAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as { user: CorporatePortalUser };
};

export const deleteCorporateUser = async (userId: string) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/users/${userId}`, {
    method: "DELETE",
    credentials: "include",
    headers: { ...getCorporateAuthHeaders() }
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as { ok: boolean };
};

export const changeCorporateUserPassword = async (payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) => {
  const response = await fetch(`${corporateApiBaseUrl}/api/auth/corporate/user/change-password`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getCorporateAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as { ok: boolean };
};

export const getCorporateUserRoleFromStorage = (): { role: string; isSubUser: boolean; allowedPages: string[] } => {
  if (typeof window === "undefined") return { role: "admin", isSubUser: false, allowedPages: [] };
  const data = window.sessionStorage.getItem("cp_user_meta");
  if (!data) return { role: "admin", isSubUser: false, allowedPages: [] };
  try {
    return JSON.parse(data);
  } catch {
    return { role: "admin", isSubUser: false, allowedPages: [] };
  }
};

export const setCorporateUserRoleInStorage = (meta: { role: string; isSubUser: boolean; allowedPages: string[] }) => {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem("cp_user_meta", JSON.stringify(meta));
  }
};