import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { Permission } from '../constants/permissions';
import { AuthRequest } from '../types/auth';
import * as fileAttachmentService from '../services/fileAttachmentService';
import logger from '../utils/logger';
import {
  UploadUrlSchema,
  ConfirmUploadSchema,
  AttachFileSchema,
  DetachFileSchema,
  ReplaceFileSchema,
  FileAttachmentFiltersSchema,
} from '../schemas/fileAttachment.schema';
import { PaginationSchema } from '../schemas';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/files/upload-url
 * Generate presigned URL for direct S3 upload
 */
router.post(
  '/upload-url',
  authorize(Permission.FILE_UPLOAD),
  async (req: AuthRequest, res) => {
    try {
      const validatedInput = UploadUrlSchema.parse(req.body);
      const uploadedBy = req.user?.userId.toString();

      if (!uploadedBy) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const result = await fileAttachmentService.getUploadUrl(validatedInput, uploadedBy);

      res.status(200).json({
        uploadUrl: result.uploadUrl,
        fileId: result.fileId,
        s3Key: result.s3Key,
        expiresIn: 3600, // 1 hour
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to generate upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  }
);

/**
 * POST /api/files/:fileId/confirm
 * Confirm successful upload and provide checksum
 */
router.post(
  '/:fileId/confirm',
  authorize(Permission.FILE_UPLOAD),
  async (req: AuthRequest, res) => {
    const { fileId } = req.params;

    try {
      const validatedInput = ConfirmUploadSchema.parse(req.body);
      const uploadedBy = req.user?.userId.toString();

      if (!uploadedBy) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      // These should come from query params or be stored with the upload URL
      const { s3Key, filename, contentType, sizeBytes } = req.body;

      if (!s3Key || !filename || !contentType || !sizeBytes) {
        return res.status(400).json({
          error: 'Missing required fields: s3Key, filename, contentType, sizeBytes',
        });
      }

      const fileAttachment = await fileAttachmentService.confirmUpload(
        fileId,
        s3Key,
        filename,
        contentType,
        sizeBytes,
        validatedInput,
        uploadedBy
      );

      res.json({
        id: fileAttachment.id,
        filename: fileAttachment.metadata.filename,
        contentType: fileAttachment.metadata.mimeType,
        sizeBytes: fileAttachment.metadata.sizeBytes,
        checksum: fileAttachment.checksum.value,
        virusScanStatus: fileAttachment.virusScanStatus.value,
        uploadedBy: fileAttachment.uploadedBy,
        uploadedAt: fileAttachment.uploadedAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      logger.error({ err: error, fileId }, 'Failed to confirm upload');
      res.status(500).json({ error: 'Failed to confirm upload' });
    }
  }
);

/**
 * POST /api/files/:fileId/attach
 * Attach file to an entity (DeliveryNote, Invoice, etc.)
 */
router.post(
  '/:fileId/attach',
  authorize(Permission.FILE_ATTACH),
  async (req: AuthRequest, res) => {
    const { fileId } = req.params;

    try {
      const validatedInput = AttachFileSchema.parse(req.body);
      const attachedBy = req.user?.userId.toString();

      if (!attachedBy) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      await fileAttachmentService.attachFileToEntity(fileId, validatedInput, attachedBy);

      res.status(200).json({
        message: 'File attached successfully',
        fileId,
        entityType: validatedInput.entityType,
        entityId: validatedInput.entityId,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('infected')) {
          return res.status(403).json({ error: error.message });
        }
      }
      logger.error({ err: error, fileId }, 'Failed to attach file');
      res.status(500).json({ error: 'Failed to attach file' });
    }
  }
);

/**
 * DELETE /api/files/:fileId/detach
 * Detach file from an entity
 */
router.delete(
  '/:fileId/detach',
  authorize(Permission.FILE_DETACH),
  async (req, res) => {
    const { fileId } = req.params;

    try {
      const validatedInput = DetachFileSchema.parse(req.query);

      if (!validatedInput.entityType || !validatedInput.entityId) {
        return res.status(400).json({
          error: 'Both entityType and entityId query parameters are required',
        });
      }

      await fileAttachmentService.detachFileFromEntity(
        fileId,
        validatedInput.entityType,
        validatedInput.entityId
      );

      res.status(200).json({
        message: 'File detached successfully',
        fileId,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      logger.error({ err: error, fileId }, 'Failed to detach file');
      res.status(500).json({ error: 'Failed to detach file' });
    }
  }
);

/**
 * GET /api/files
 * List files with filters and pagination
 */
router.get(
  '/',
  authorize(Permission.FILE_READ),
  async (req, res) => {
    try {
      const filters = FileAttachmentFiltersSchema.parse({
        entityType: req.query.entityType,
        entityId: req.query.entityId,
        uploadedBy: req.query.uploadedBy,
        virusScanStatus: req.query.virusScanStatus,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
      });

      const pagination = PaginationSchema.parse({
        page: req.query.page || '1',
        limit: req.query.limit || '10',
      });

      const result = await fileAttachmentService.listFiles(filters, pagination);

      res.json({
        data: result.data.map(file => ({
          id: file.id,
          filename: file.metadata.filename,
          contentType: file.metadata.mimeType,
          sizeBytes: file.metadata.sizeBytes,
          checksum: file.checksum.value,
          virusScanStatus: file.virusScanStatus.value,
          uploadedBy: file.uploadedBy,
          uploadedAt: file.uploadedAt.toISOString(),
          currentVersion: file.currentVersion,
        })),
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to list files');
      res.status(500).json({ error: 'Failed to retrieve files' });
    }
  }
);

/**
 * GET /api/files/:fileId
 * Get file details by ID
 */
router.get(
  '/:fileId',
  authorize(Permission.FILE_READ),
  async (req, res) => {
    const { fileId } = req.params;

    try {
      const fileAttachment = await fileAttachmentService.getFileById(fileId);

      if (!fileAttachment) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json({
        id: fileAttachment.id,
        s3Key: fileAttachment.s3Key.value,
        filename: fileAttachment.metadata.filename,
        contentType: fileAttachment.metadata.mimeType,
        sizeBytes: fileAttachment.metadata.sizeBytes,
        checksum: fileAttachment.checksum.value,
        virusScanStatus: fileAttachment.virusScanStatus.value,
        uploadedBy: fileAttachment.uploadedBy,
        uploadedAt: fileAttachment.uploadedAt.toISOString(),
        currentVersion: fileAttachment.currentVersion,
      });
    } catch (error) {
      logger.error({ err: error, fileId }, 'Failed to get file');
      res.status(500).json({ error: 'Failed to retrieve file' });
    }
  }
);

/**
 * GET /api/files/:fileId/download-url
 * Generate presigned download URL
 */
router.get(
  '/:fileId/download-url',
  authorize(Permission.FILE_READ),
  async (req, res) => {
    const { fileId } = req.params;

    try {
      const downloadUrl = await fileAttachmentService.getDownloadUrl(fileId);

      res.json({
        downloadUrl,
        fileId,
        expiresIn: 3600, // 1 hour
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('infected')) {
          return res.status(403).json({ error: error.message });
        }
      }
      logger.error({ err: error, fileId }, 'Failed to generate download URL');
      res.status(500).json({ error: 'Failed to generate download URL' });
    }
  }
);

/**
 * POST /api/files/:fileId/replace
 * Replace file with a new version
 */
router.post(
  '/:fileId/replace',
  authorize(Permission.FILE_UPLOAD),
  async (req: AuthRequest, res) => {
    const { fileId } = req.params;

    try {
      const validatedInput = ReplaceFileSchema.parse(req.body);
      const uploadedBy = req.user?.userId.toString();

      if (!uploadedBy) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const result = await fileAttachmentService.replaceFile(
        fileId,
        validatedInput,
        uploadedBy
      );

      res.status(200).json({
        uploadUrl: result.uploadUrl,
        fileId,
        s3Key: result.s3Key,
        message: 'Upload the new version to the provided URL',
        expiresIn: 3600, // 1 hour
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      logger.error({ err: error, fileId }, 'Failed to replace file');
      res.status(500).json({ error: 'Failed to replace file' });
    }
  }
);

/**
 * GET /api/files/:fileId/versions
 * Get version history for a file
 */
router.get(
  '/:fileId/versions',
  authorize(Permission.FILE_READ),
  async (req, res) => {
    const { fileId } = req.params;

    try {
      const versions = await fileAttachmentService.getFileVersions(fileId);

      res.json({
        fileId,
        versions: versions.map(version => ({
          versionNumber: version.versionNumber,
          filename: version.filename,
          sizeBytes: version.sizeBytes,
          checksum: version.checksum,
          s3Key: version.s3Key,
          archivedAt: version.archivedAt.toISOString(),
        })),
      });
    } catch (error) {
      logger.error({ err: error, fileId }, 'Failed to get file versions');
      res.status(500).json({ error: 'Failed to retrieve file versions' });
    }
  }
);

/**
 * DELETE /api/files/:fileId
 * Delete a file and all its versions
 * (Admin/Manager only - sensitive operation)
 */
router.delete(
  '/:fileId',
  authorize(Permission.FILE_DELETE),
  async (req, res) => {
    const { fileId } = req.params;

    try {
      await fileAttachmentService.deleteFile(fileId);

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      logger.error({ err: error, fileId }, 'Failed to delete file');
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }
);

export default router;
