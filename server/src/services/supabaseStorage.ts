import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

const supabaseClient = config.supabaseStorageEnabled
  ? createClient(config.supabaseUrl as string, config.supabaseServiceRoleKey as string, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

const sleep = async (durationMs: number) => {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
};

const getErrorMessage = (error: unknown) => {
  if (!error) {
    return "Unknown error";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && "message" in error) {
    const value = (error as { message?: unknown }).message;
    return typeof value === "string" ? value : String(value);
  }

  return String(error);
};

const isRetryableUploadError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("fetch failed")
    || message.includes("network")
    || message.includes("timeout")
    || message.includes("econnreset")
    || message.includes("etimedout")
    || message.includes("enotfound")
    || message.includes("eai_again")
    || message.includes("socket hang up");
};

const uploadToSupabaseWithRetry = async (params: {
  objectPath: string;
  fileBuffer: Buffer;
  mimeType: string;
  upsert: boolean;
}) => {
  if (!supabaseClient) {
    throw new Error("Supabase storage is not configured");
  }

  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { error } = await supabaseClient.storage
        .from(config.supabaseStorageBucket)
        .upload(params.objectPath, params.fileBuffer, {
          contentType: params.mimeType || "application/octet-stream",
          upsert: params.upsert
        });

      if (!error) {
        return;
      }

      lastError = new Error(`Supabase upload failed: ${error.message}`);

      if (!isRetryableUploadError(error) || attempt === maxAttempts) {
        throw lastError;
      }
    } catch (error) {
      const wrappedError = new Error(`Supabase upload failed: ${getErrorMessage(error)}`);
      lastError = wrappedError;

      if (!isRetryableUploadError(error) || attempt === maxAttempts) {
        throw wrappedError;
      }
    }

    await sleep(250 * attempt);
  }

  throw lastError ?? new Error("Supabase upload failed: Unknown upload error");
};

export const isSupabaseStorageConfigured = () => Boolean(supabaseClient);

export const uploadBillFileToSupabase = async (params: {
  bookingId: string;
  originalFileName: string;
  mimeType: string;
  fileBuffer: Buffer;
}) => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const sanitizedName = params.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${params.bookingId}/${timestamp}-${randomSuffix}-${sanitizedName}`;

  await uploadToSupabaseWithRetry({
    objectPath,
    fileBuffer: params.fileBuffer,
    mimeType: params.mimeType,
    upsert: false
  });

  return {
    objectPath
  };
};

export const uploadHotelLogoToSupabase = async (params: {
  userId: string;
  originalFileName: string;
  mimeType: string;
  fileBuffer: Buffer;
}) => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const sanitizedName = params.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `hotel-logos/${params.userId}/${timestamp}-${randomSuffix}-${sanitizedName}`;

  await uploadToSupabaseWithRetry({
    objectPath,
    fileBuffer: params.fileBuffer,
    mimeType: params.mimeType,
    upsert: false
  });

  return {
    objectPath
  };
};

export const createBillSignedUrl = async (objectPath: string, expiresInSeconds = 60) => {
  if (!supabaseClient) {
    throw new Error("Supabase storage is not configured");
  }

  const { data, error } = await supabaseClient.storage
    .from(config.supabaseStorageBucket)
    .createSignedUrl(objectPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to create signed url");
  }

  return data.signedUrl;
};

export const deleteBillFromSupabase = async (objectPath?: string | null) => {
  if (!supabaseClient || !objectPath) {
    return;
  }

  const { error } = await supabaseClient.storage
    .from(config.supabaseStorageBucket)
    .remove([objectPath]);

  if (error) {
    throw new Error(error.message);
  }
};

export const uploadContractPdfToSupabase = async (params: {
  hotelUserId: string;
  organizationId: string;
  contractId: string;
  fileBuffer: Buffer;
}) => {
  const objectPath = `contracts/${params.hotelUserId}/${params.organizationId}/${params.contractId}.pdf`;

  await uploadToSupabaseWithRetry({
    objectPath,
    fileBuffer: params.fileBuffer,
    mimeType: "application/pdf",
    upsert: true
  });

  return {
    objectPath
  };
};

export const createContractPdfSignedUrl = async (objectPath: string, expiresInSeconds = 120) => {
  if (!supabaseClient) {
    throw new Error("Supabase storage is not configured");
  }

  const { data, error } = await supabaseClient.storage
    .from(config.supabaseStorageBucket)
    .createSignedUrl(objectPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to create signed url");
  }

  return data.signedUrl;
};

export const deleteContractPdfFromSupabase = async (objectPath?: string | null) => {
  if (!supabaseClient || !objectPath) {
    return;
  }

  const { error } = await supabaseClient.storage
    .from(config.supabaseStorageBucket)
    .remove([objectPath]);

  if (error) {
    throw new Error(error.message);
  }
};
