import { v2 as cloudinary } from "cloudinary";
import { config } from "../config.js";

if (config.cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
    secure: true
  });
}

export const isCloudinaryConfigured = () => config.cloudinaryEnabled;

export const uploadBillFileToCloudinary = async (params: {
  localPath: string;
  originalFileName: string;
  mimeType?: string | null;
}) => {
  if (!isCloudinaryConfigured()) {
    return null;
  }

  const resourceType = params.mimeType?.toLowerCase().startsWith("image/")
    ? "image"
    : "raw";

  const uploaded = await cloudinary.uploader.upload(params.localPath, {
    folder: config.cloudinaryFolder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    filename_override: params.originalFileName
  });

  return {
    url: uploaded.secure_url,
    publicId: uploaded.public_id
  };
};

export const deleteBillFileFromCloudinary = async (publicId?: string | null) => {
  if (!isCloudinaryConfigured() || !publicId) {
    return;
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: "raw"
  }).catch(async () => {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image"
    });
  });
};
