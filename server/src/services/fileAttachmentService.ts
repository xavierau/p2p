import { randomUUID } from 'crypto';
import {
  PrismaFileAttachmentRepository,
  PrismaFileAttachmentLinkRepository,
  PrismaFileVersionRepository,
  AWSS3StorageProvider,
} from '../infrastructure';
import { FileAttachment } from '../domain/files/entities/FileAttachment';
import { FileChecksum } from '../domain/files/value-objects/FileChecksum';
import { VirusScanStatus } from '../domain/files/value-objects/VirusScanStatus';
import { EntityType } from '../domain/files/repositories/IFileAttachmentLinkRepository';
import pubsub, { PubSubService } from './pubsub';
import {
  UploadUrlInput,
  ConfirmUploadInput,
  AttachFileInput,
  ReplaceFileInput,
  FileAttachmentFiltersInput,
} from '../schemas/fileAttachment.schema';
import { PaginationInput, parsePagination } from '../schemas';

/**
 * Service facade for FileAttachment operations.
 * Orchestrates domain logic, repository interactions, S3 storage, and event publishing.
 */

// Initialize repositories and storage provider
const fileAttachmentRepository = new PrismaFileAttachmentRepository();
const fileAttachmentLinkRepository = new PrismaFileAttachmentLinkRepository();
const fileVersionRepository = new PrismaFileVersionRepository();

// Initialize S3 storage provider
const s3Provider = new AWSS3StorageProvider({
  region: process.env.AWS_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET_NAME || 'payment-management-files',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  endpoint: process.env.S3_ENDPOINT, // For S3-compatible services like MinIO
});

/**
 * Generates a presigned URL for direct S3 upload.
 * Client will upload the file directly to S3 using this URL.
 */
export const getUploadUrl = async (
  input: UploadUrlInput,
  uploadedBy: string
): Promise<{ uploadUrl: string; fileId: string; s3Key: string }> => {
  // Generate unique file ID and S3 key
  const fileId = randomUUID();
  const prefix = `uploads/${new Date().getFullYear()}/${uploadedBy}`;
  const s3Key = `${prefix}/${fileId}/${input.filename}`;

  // Generate presigned upload URL (valid for 1 hour)
  const uploadUrl = await s3Provider.getPresignedUploadUrl(
    s3Key,
    input.contentType,
    3600 // 1 hour expiration
  );

  // NOTE: We return the upload URL but DON'T create the file attachment entity yet
  // It will be created when confirmUpload is called with the actual checksum

  return {
    uploadUrl,
    fileId,
    s3Key,
  };
};

/**
 * Confirms file upload after client successfully uploads to S3.
 * Creates the file attachment entity with the provided checksum.
 */
export const confirmUpload = async (
  fileId: string,
  s3Key: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
  input: ConfirmUploadInput,
  uploadedBy: string
): Promise<FileAttachment> => {
  // Create checksum value object
  const checksum = FileChecksum.fromString(input.checksum);

  // Extract prefix from s3Key
  const prefix = s3Key.substring(0, s3Key.lastIndexOf('/'));

  // Create file attachment entity
  const fileAttachment = FileAttachment.create({
    id: fileId,
    prefix,
    filename,
    mimeType: contentType,
    sizeBytes,
    checksum,
    uploadedBy,
  });

  // Save to database
  await fileAttachmentRepository.save(fileAttachment);

  // Publish event to trigger virus scan
  pubsub.publish(PubSubService.FILE_UPLOADED, {
    fileId: fileAttachment.id,
    s3Key: fileAttachment.s3Key.value,
    uploadedBy: fileAttachment.uploadedBy,
  });

  return fileAttachment;
};

/**
 * Attaches a file to an entity (DeliveryNote, Invoice, etc.).
 * @throws Error if file is infected or entity doesn't exist
 */
export const attachFileToEntity = async (
  fileId: string,
  input: AttachFileInput,
  attachedBy: string
): Promise<void> => {
  const fileAttachment = await fileAttachmentRepository.findById(fileId);
  if (!fileAttachment) {
    throw new Error(`File attachment ${fileId} not found`);
  }

  // Prevent attaching infected files
  if (fileAttachment.virusScanStatus.isInfected()) {
    throw new Error(`Cannot attach infected file ${fileId}`);
  }

  // Convert schema entity type to domain entity type
  const entityType = input.entityType as unknown as EntityType;

  // Create link
  await fileAttachmentLinkRepository.link(fileId, entityType, input.entityId, attachedBy);

  // Publish event
  pubsub.publish(PubSubService.FILE_ATTACHED, {
    fileId,
    entityType: input.entityType,
    entityId: input.entityId,
    attachedBy,
  });
};

/**
 * Detaches a file from an entity.
 */
export const detachFileFromEntity = async (
  fileId: string,
  entityType: string,
  entityId: string
): Promise<void> => {
  const domainEntityType = entityType as unknown as EntityType;
  await fileAttachmentLinkRepository.unlink(fileId, domainEntityType, entityId);

  // Publish event
  pubsub.publish(PubSubService.FILE_DETACHED, {
    fileId,
    entityType,
    entityId,
  });
};

/**
 * Lists files with filters and pagination.
 */
export const listFiles = async (
  filters: FileAttachmentFiltersInput,
  pagination: PaginationInput
) => {
  const { page: pageNum, limit: limitNum, skip } = parsePagination(pagination);

  let files: FileAttachment[] = [];

  // Apply filters
  if (filters.entityType && filters.entityId) {
    const domainEntityType = filters.entityType as unknown as EntityType;
    const fileIds = await fileAttachmentLinkRepository.findFileAttachmentIdsByEntity(
      domainEntityType,
      filters.entityId
    );

    for (const fileId of fileIds) {
      const file = await fileAttachmentRepository.findById(fileId);
      if (file) {
        files.push(file);
      }
    }
  } else if (filters.uploadedBy) {
    files = await fileAttachmentRepository.findByUploadedBy(filters.uploadedBy);
  } else if (filters.virusScanStatus) {
    const status = VirusScanStatus.fromString(filters.virusScanStatus);
    files = await fileAttachmentRepository.findByVirusScanStatus(status);
  } else if (filters.dateFrom || filters.dateTo) {
    const startDate = filters.dateFrom ? new Date(filters.dateFrom) : new Date(0);
    const endDate = filters.dateTo ? new Date(filters.dateTo) : new Date();
    files = await fileAttachmentRepository.findByUploadDateRange(startDate, endDate);
  }

  // Paginate
  const total = files.length;
  const paginatedFiles = files.slice(skip, skip + limitNum);
  const totalPages = Math.ceil(total / limitNum);

  return {
    data: paginatedFiles,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrevious: pageNum > 1,
    },
  };
};

/**
 * Gets a file attachment by ID.
 */
export const getFileById = async (fileId: string): Promise<FileAttachment | null> => {
  return fileAttachmentRepository.findById(fileId);
};

/**
 * Generates a presigned download URL.
 * Valid for 1 hour.
 */
export const getDownloadUrl = async (fileId: string): Promise<string> => {
  const fileAttachment = await fileAttachmentRepository.findById(fileId);
  if (!fileAttachment) {
    throw new Error(`File attachment ${fileId} not found`);
  }

  // Prevent downloading infected files
  if (fileAttachment.virusScanStatus.isInfected()) {
    throw new Error(`Cannot download infected file ${fileId}`);
  }

  return s3Provider.getPresignedDownloadUrl(fileAttachment.s3Key.value, 3600);
};

/**
 * Replaces a file with a new version.
 * Creates a new version record and generates upload URL.
 */
export const replaceFile = async (
  fileId: string,
  input: ReplaceFileInput,
  uploadedBy: string
): Promise<{ uploadUrl: string; s3Key: string }> => {
  const existingFile = await fileAttachmentRepository.findById(fileId);
  if (!existingFile) {
    throw new Error(`File attachment ${fileId} not found`);
  }

  // Archive current version
  await fileVersionRepository.archiveVersion(existingFile);

  // Generate new S3 key for new version
  const newVersion = existingFile.currentVersion + 1;
  const prefix = `uploads/${new Date().getFullYear()}/${uploadedBy}`;
  const s3Key = `${prefix}/${fileId}/v${newVersion}/${input.filename}`;

  // Generate presigned upload URL
  const uploadUrl = await s3Provider.getPresignedUploadUrl(s3Key, input.contentType, 3600);

  // NOTE: The actual file replacement will happen when the upload is confirmed
  // For now, just return the upload URL

  // Publish event
  pubsub.publish(PubSubService.FILE_REPLACED, {
    fileId,
    version: newVersion,
    uploadedBy,
  });

  return {
    uploadUrl,
    s3Key,
  };
};

/**
 * Gets version history for a file.
 */
export const getFileVersions = async (fileId: string) => {
  return fileVersionRepository.findVersionsByFileId(fileId);
};

/**
 * Deletes a file attachment and all its versions.
 * Also removes from S3 storage.
 */
export const deleteFile = async (fileId: string): Promise<void> => {
  const fileAttachment = await fileAttachmentRepository.findById(fileId);
  if (!fileAttachment) {
    throw new Error(`File attachment ${fileId} not found`);
  }

  // Delete from S3
  await s3Provider.delete(fileAttachment.s3Key.value);

  // Delete all versions from S3
  const versions = await fileVersionRepository.findVersionsByFileId(fileId);
  for (const version of versions) {
    await s3Provider.delete(version.s3Key);
  }

  // Delete from database (cascade will handle links and versions)
  await fileAttachmentRepository.delete(fileId);

  // Publish event
  pubsub.publish(PubSubService.FILE_DELETED, {
    fileId,
    s3Key: fileAttachment.s3Key.value,
  });
};
