import api from '@/lib/api';
import axios from 'axios';
import type {
  FileAttachment,
  EntityFileAttachment,
  PaginatedResponse,
  PaginationParams,
  FileFilters,
  InitiateUploadInput,
  InitiateUploadResponse,
  ConfirmUploadInput,
  AttachFileInput,
  DetachFileInput,
  DownloadFileResponse,
  AttachableEntityType,
} from '@/types';

// Re-export types for convenience
export type { FileAttachment, EntityFileAttachment };

/**
 * Builds URLSearchParams from filters and pagination options.
 */
const buildQueryParams = (
  filters?: FileFilters,
  pagination?: PaginationParams
): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.entityType) {
      params.append('entityType', filters.entityType);
    }
    if (filters.entityId !== undefined) {
      params.append('entityId', String(filters.entityId));
    }
    if (filters.virusScanStatus) {
      params.append('virusScanStatus', filters.virusScanStatus);
    }
    if (filters.uploadedBy !== undefined) {
      params.append('uploadedBy', String(filters.uploadedBy));
    }
  }

  if (pagination) {
    if (pagination.page !== undefined) {
      params.append('page', String(pagination.page));
    }
    if (pagination.limit !== undefined) {
      params.append('limit', String(pagination.limit));
    }
  }

  return params;
};

/**
 * Calculates SHA-256 checksum for a file using Web Crypto API.
 */
export const calculateChecksum = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

/**
 * Initiates a file upload by requesting a presigned S3 URL.
 */
const initiateUpload = async (
  data: InitiateUploadInput
): Promise<InitiateUploadResponse> => {
  const response = await api.post<InitiateUploadResponse>(
    '/files/initiate-upload',
    data
  );
  return response.data;
};

/**
 * Uploads a file directly to S3 using the presigned URL.
 * This bypasses our API server for efficient large file uploads.
 */
const uploadToS3 = async (
  file: File,
  uploadUrl: string,
  onProgress?: (progress: number) => void
): Promise<void> => {
  await axios.put(uploadUrl, file, {
    headers: {
      'Content-Type': file.type,
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });
};

/**
 * Confirms that a file upload to S3 was successful.
 * This creates the FileAttachment record in our database.
 */
const confirmUpload = async (data: ConfirmUploadInput): Promise<FileAttachment> => {
  const response = await api.post<FileAttachment>('/files/confirm-upload', data);
  return response.data;
};

/**
 * Complete file upload flow: initiate → upload to S3 → confirm.
 * Returns the created FileAttachment record.
 */
export const uploadFile = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<FileAttachment> => {
  // Step 1: Calculate checksum
  const checksum = await calculateChecksum(file);

  // Step 2: Initiate upload (get presigned URL)
  const { uploadId, uploadUrl } = await initiateUpload({
    filename: file.name,
    mimeType: file.type,
    fileSize: file.size,
    checksum,
  });

  // Step 3: Upload to S3
  await uploadToS3(file, uploadUrl, onProgress);

  // Step 4: Confirm upload (create database record)
  const fileAttachment = await confirmUpload({ uploadId });

  return fileAttachment;
};

/**
 * Attaches an uploaded file to an entity (invoice, PO, etc.).
 */
const attachFile = async (data: AttachFileInput): Promise<EntityFileAttachment> => {
  const response = await api.post<EntityFileAttachment>('/files/attach', data);
  return response.data;
};

/**
 * Detaches a file from an entity.
 */
const detachFile = async (attachmentId: number): Promise<void> => {
  await api.delete(`/files/detach/${attachmentId}`);
};

/**
 * Gets a presigned download URL for a file.
 */
const getDownloadUrl = async (fileId: number): Promise<DownloadFileResponse> => {
  const response = await api.get<DownloadFileResponse>(`/files/${fileId}/download`);
  return response.data;
};

/**
 * Fetches all files attached to a specific entity.
 */
const getEntityFiles = async (
  entityType: AttachableEntityType,
  entityId: number
): Promise<EntityFileAttachment[]> => {
  const response = await api.get<EntityFileAttachment[]>(
    `/files/entity/${entityType}/${entityId}`
  );
  return response.data;
};

/**
 * Fetches a paginated list of files with optional filtering.
 */
const getFiles = async (
  filters?: FileFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<FileAttachment>> => {
  const params = buildQueryParams(filters, pagination);
  const queryString = params.toString();
  const url = queryString ? `/files?${queryString}` : '/files';

  const response = await api.get<PaginatedResponse<FileAttachment>>(url);
  return response.data;
};

/**
 * Fetches a single file by ID, including version history.
 */
const getFileById = async (id: number): Promise<FileAttachment> => {
  const response = await api.get<FileAttachment>(`/files/${id}`);
  return response.data;
};

/**
 * Gets all versions of a file.
 */
const getFileVersions = async (fileId: number): Promise<FileAttachment[]> => {
  const response = await api.get<FileAttachment[]>(`/files/${fileId}/versions`);
  return response.data;
};

/**
 * Uploads a new version of an existing file.
 */
export const uploadFileVersion = async (
  file: File,
  previousVersionId: number,
  onProgress?: (progress: number) => void
): Promise<FileAttachment> => {
  // Similar to uploadFile but with previousVersionId
  const checksum = await calculateChecksum(file);

  const { uploadId, uploadUrl } = await initiateUpload({
    filename: file.name,
    mimeType: file.type,
    fileSize: file.size,
    checksum,
  });

  await uploadToS3(file, uploadUrl, onProgress);

  // Include previousVersionId in confirmation
  const response = await api.post<FileAttachment>('/files/confirm-upload', {
    uploadId,
    previousVersionId,
  });

  return response.data;
};

export const fileAttachmentService = {
  initiateUpload,
  confirmUpload,
  uploadFile,
  uploadFileVersion,
  attachFile,
  detachFile,
  getDownloadUrl,
  getEntityFiles,
  getFiles,
  getFileById,
  getFileVersions,
  calculateChecksum,
};
