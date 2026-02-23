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

export const isSupabaseStorageConfigured = () => Boolean(supabaseClient);

export const uploadBillFileToSupabase = async (params: {
  bookingId: string;
  originalFileName: string;
  mimeType: string;
  fileBuffer: Buffer;
}) => {
  if (!supabaseClient) {
    throw new Error("Supabase storage is not configured");
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const sanitizedName = params.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${params.bookingId}/${timestamp}-${randomSuffix}-${sanitizedName}`;

  const { error } = await supabaseClient.storage
    .from(config.supabaseStorageBucket)
    .upload(objectPath, params.fileBuffer, {
      contentType: params.mimeType || "application/octet-stream",
      upsert: false
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

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
  if (!supabaseClient) {
    throw new Error("Supabase storage is not configured");
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const sanitizedName = params.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `hotel-logos/${params.userId}/${timestamp}-${randomSuffix}-${sanitizedName}`;

  const { error } = await supabaseClient.storage
    .from(config.supabaseStorageBucket)
    .upload(objectPath, params.fileBuffer, {
      contentType: params.mimeType || "application/octet-stream",
      upsert: false
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

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
  if (!supabaseClient) {
    throw new Error("Supabase storage is not configured");
  }

  const objectPath = `contracts/${params.hotelUserId}/${params.organizationId}/${params.contractId}.pdf`;

  const { error } = await supabaseClient.storage
    .from(config.supabaseStorageBucket)
    .upload(objectPath, params.fileBuffer, {
      contentType: "application/pdf",
      upsert: true
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

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
