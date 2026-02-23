export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface HotelProfile {
  hotelName: string | null;
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

const apiBaseUrl =
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
    return `${apiBaseUrl}${value}`;
  }

  return value;
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
