export interface AuthUser {
  id: string;
  email: string;
  role: string;
  isSubUser?: boolean;
  portalUserId?: string;
  fullName?: string;
  allowedPages?: string[];
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface HotelProfile {
  hotelName: string | null;
  entityName: string | null;
  gst: string | null;
  location: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
}

export interface HotelProfileResponse {
  user: AuthUser;
  profile: HotelProfile;
}

export interface AdminCreatedHotelAccount {
  id: string;
  email: string;
  role: string;
  hotelName: string;
  baikalsphereUserId?: string;
}

export interface AdminCreateHotelAccountResponse {
  account: AdminCreatedHotelAccount;
  message: string;
}

const configuredApiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL;

const resolveApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    const { origin, protocol, hostname } = window.location;

    if (!configuredApiBaseUrl) {
      return origin;
    }

    try {
      const parsed = new URL(configuredApiBaseUrl);
      const isSameHost = parsed.hostname === hostname;
      if (protocol === "https:" && parsed.protocol === "http:" && isSameHost) {
        parsed.protocol = "https:";
        return parsed.toString().replace(/\/$/, "");
      }
      return parsed.toString().replace(/\/$/, "");
    } catch {
      if (configuredApiBaseUrl.startsWith("/")) {
        return origin;
      }
      return configuredApiBaseUrl.replace(/\/$/, "");
    }
  }

  return configuredApiBaseUrl ?? "http://localhost:4000";
};

const apiBaseUrl = resolveApiBaseUrl();

const toAbsoluteApiUrl = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const resolveLocalDevHostname = (url: string) => {
    if (typeof window === "undefined") {
      return url;
    }

    try {
      const parsed = new URL(url);
      const isLocalApiHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      const browserHost = window.location.hostname;
      const isLocalBrowserHost = browserHost === "localhost" || browserHost === "127.0.0.1";

      if (isLocalApiHost && isLocalBrowserHost && parsed.hostname !== browserHost) {
        parsed.hostname = browserHost;
        return parsed.toString();
      }

      return url;
    } catch {
      return url;
    }
  };

  const withLogoCacheBuster = (url: string) => {
    if (!url.includes("/api/auth/hotel/logo/")) {
      return resolveLocalDevHostname(url);
    }

    const joiner = url.includes("?") ? "&" : "?";
    return resolveLocalDevHostname(`${url}${joiner}v=${Date.now()}`);
  };

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return withLogoCacheBuster(value);
  }

  if (value.startsWith("/")) {
    return withLogoCacheBuster(`${apiBaseUrl}${value}`);
  }

  return withLogoCacheBuster(value);
};

const parseErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    return data?.error?.message ?? "Request failed";
  } catch {
    return "Request failed";
  }
};

const withAlternateLocalhost = (url: string) => {
  if (url.includes("localhost")) {
    return url.replace("localhost", "127.0.0.1");
  }

  if (url.includes("127.0.0.1")) {
    return url.replace("127.0.0.1", "localhost");
  }

  return null;
};

const request = async <T>(path: string, options: RequestInit) => {
  const requestUrl = `${apiBaseUrl}${path}`;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const fetchOptions: RequestInit = {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {})
    }
  };

  let response: Response;

  try {
    response = await fetch(requestUrl, fetchOptions);
  } catch (error) {
    const alternateUrl = withAlternateLocalhost(requestUrl);
    if (!(error instanceof TypeError) || !alternateUrl) {
      throw error;
    }

    response = await fetch(alternateUrl, fetchOptions);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as T;
};

const tokenKey = "hf_access_token";

export const tokenStorage = {
  get: () => (typeof window !== "undefined" ? window.sessionStorage.getItem(tokenKey) : null),
  set: (token: string) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(tokenKey, token);
    }
  },
  clear: () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(tokenKey);
    }
  }
};

export const login = async (email: string, password: string) => {
  const result = await request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  tokenStorage.set(result.accessToken);
  setUserRoleInStorage({
    role: result.user.role || "admin",
    isSubUser: result.user.isSubUser || false,
    allowedPages: result.user.allowedPages || []
  });
  return result;
};

export const register = async (email: string, password: string, fullName?: string) => {
  const result = await request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName })
  });

  tokenStorage.set(result.accessToken);
  return result;
};

export const logout = async () => {
  await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  tokenStorage.clear();
};

const getAuthHeaders = () => {
  const token = tokenStorage.get();
  if (!token) {
    throw new Error("Unauthorized");
  }

  return {
    Authorization: `Bearer ${token}`
  };
};

export const fetchHotelProfile = async () => {
  const response = await request<HotelProfileResponse>("/api/auth/hotel/me", {
    method: "GET",
    headers: {
      ...getAuthHeaders()
    }
  });

  // Keep user meta in sync on every profile fetch
  if (response.user) {
    setUserRoleInStorage({
      role: response.user.role || "admin",
      isSubUser: response.user.isSubUser || false,
      allowedPages: response.user.allowedPages || []
    });
  }

  return {
    ...response,
    profile: {
      ...response.profile,
      logoUrl: toAbsoluteApiUrl(response.profile.logoUrl)
    }
  };
};

export const updateHotelProfile = async (payload: {
  hotelName: string;
  entityName?: string | null;
  gst?: string | null;
  location?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
}) => {
  const response = await request<HotelProfileResponse>("/api/auth/hotel/profile", {
    method: "PUT",
    headers: {
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  return {
    ...response,
    profile: {
      ...response.profile,
      logoUrl: toAbsoluteApiUrl(response.profile.logoUrl)
    }
  };
};

export const uploadHotelLogo = async (file: File) => {
  const formData = new FormData();
  formData.set("file", file);

  const response = await request<HotelProfileResponse>("/api/auth/hotel/profile/logo", {
    method: "POST",
    headers: {
      ...getAuthHeaders()
    },
    body: formData
  });

  return {
    ...response,
    profile: {
      ...response.profile,
      logoUrl: toAbsoluteApiUrl(response.profile.logoUrl)
    }
  };
};

export const changeHotelPassword = async (payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) => {
  return request<{ ok: boolean }>("/api/auth/hotel/change-password", {
    method: "POST",
    headers: {
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });
};

export const createHotelAccountByAdmin = async (payload: {
  email: string;
  hotelName: string;
  fullName?: string;
}) => {
  return request<AdminCreateHotelAccountResponse>("/api/auth/admin/hotel-accounts", {
    method: "POST",
    headers: {
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });
};

export const createHotelAccountBySecret = async (
  payload: {
    email: string;
    hotelName: string;
    fullName?: string;
  }
) => {
  return request<AdminCreateHotelAccountResponse>("/api/auth/admin/hotel-accounts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export interface HotelActivityAccount {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  failed_login_attempts: number;
  locked_until: string | null;
  hotel_name: string | null;
  location: string | null;
  active_sessions: number;
  total_sessions: number;
  total_minutes: number;
}

export interface OrgActivityEntry {
  id: string;
  name: string;
  corporate_user_id: string;
  contact_email: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  status: string;
}

export interface DailyActivityEntry {
  user_id: string;
  hotel_name: string;
  email: string;
  location: string | null;
  day: string;
  sessions: number;
  minutes: number;
}

export const fetchHotelActivity = async () => {
  return request<{ accounts: HotelActivityAccount[]; organizations: OrgActivityEntry[]; daily: DailyActivityEntry[] }>("/api/auth/admin/hotel-activity", {
    method: "GET"
  });
};

// ══════════════════════════════════════════════════════════════
// Portal User Management
// ══════════════════════════════════════════════════════════════

export interface PortalUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  allowed_pages: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortalUserPayload {
  fullName: string;
  email: string;
  role: "admin" | "user";
  allowedPages: string[];
}

export interface PortalUserUpdatePayload {
  fullName?: string;
  role?: "admin" | "user";
  allowedPages?: string[];
  isActive?: boolean;
}

export const fetchHotelUsers = async () => {
  return request<{ users: PortalUser[] }>("/api/auth/hotel/users", {
    method: "GET",
    headers: { ...getAuthHeaders() }
  });
};

export const createHotelUser = async (payload: PortalUserPayload) => {
  return request<{ user: PortalUser }>("/api/auth/hotel/users", {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: JSON.stringify(payload)
  });
};

export const updateHotelUser = async (userId: string, payload: PortalUserUpdatePayload) => {
  return request<{ user: PortalUser }>(`/api/auth/hotel/users/${userId}`, {
    method: "PUT",
    headers: { ...getAuthHeaders() },
    body: JSON.stringify(payload)
  });
};

export const deleteHotelUser = async (userId: string) => {
  return request<{ ok: boolean }>(`/api/auth/hotel/users/${userId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() }
  });
};

export const changePortalUserPassword = async (payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) => {
  return request<{ ok: boolean }>("/api/auth/hotel/user/change-password", {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: JSON.stringify(payload)
  });
};

export const getUserRoleFromStorage = (): { role: string; isSubUser: boolean; allowedPages: string[] } => {
  if (typeof window === "undefined") return { role: "admin", isSubUser: false, allowedPages: [] };
  const data = window.sessionStorage.getItem("hf_user_meta");
  if (!data) return { role: "admin", isSubUser: false, allowedPages: [] };
  try {
    return JSON.parse(data);
  } catch {
    return { role: "admin", isSubUser: false, allowedPages: [] };
  }
};

export const setUserRoleInStorage = (meta: { role: string; isSubUser: boolean; allowedPages: string[] }) => {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem("hf_user_meta", JSON.stringify(meta));
  }
};
