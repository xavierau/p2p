import prisma from '../../../../prisma';
import { IFileAttachmentRepository } from '../../../../domain/files/repositories/IFileAttachmentRepository';
import { FileAttachment } from '../../../../domain/files/entities/FileAttachment';
import { VirusScanStatus } from '../../../../domain/files/value-objects/VirusScanStatus';
import { FileAttachmentMapper } from '../mappers/FileAttachmentMapper';

/**
 * Prisma implementation of IFileAttachmentRepository.
 * Handles all persistence operations for FileAttachment aggregate.
 */
export class PrismaFileAttachmentRepository implements IFileAttachmentRepository {
  /**
   * Persists a new file attachment.
   * @throws Error if file attachment with same ID already exists
   */
  async save(fileAttachment: FileAttachment): Promise<void> {
    try {
      const data = FileAttachmentMapper.toPersistenceCreate(fileAttachment);

      await prisma.fileAttachment.create({
        data: {
          ...data,
          virusScanStatus: data.virusScanStatus as any,
        },
      });
    } catch (error) {
      if ((error as any).code === 'P2002') {
        throw new Error(`File attachment with ID ${fileAttachment.id} already exists`);
      }
      throw new Error(`Failed to save file attachment: ${(error as Error).message}`);
    }
  }

  /**
   * Updates an existing file attachment.
   * Typically used only for virus scan status updates.
   * @throws Error if file attachment not found
   */
  async update(fileAttachment: FileAttachment): Promise<void> {
    try {
      const data = FileAttachmentMapper.toPersistenceUpdate(fileAttachment);
      const id = parseInt(fileAttachment.id);

      const updated = await prisma.fileAttachment.update({
        where: { id },
        data: {
          ...data,
          virusScanStatus: data.virusScanStatus as any,
        },
      });

      if (!updated) {
        throw new Error(`File attachment with ID ${fileAttachment.id} not found`);
      }
    } catch (error) {
      if ((error as any).code === 'P2025') {
        throw new Error(`File attachment with ID ${fileAttachment.id} not found`);
      }
      throw new Error(`Failed to update file attachment: ${(error as Error).message}`);
    }
  }

  /**
   * Finds a file attachment by its ID.
   * @returns FileAttachment if found, null otherwise
   */
  async findById(id: string): Promise<FileAttachment | null> {
    try {
      const fileAttachment = await prisma.fileAttachment.findUnique({
        where: { id: parseInt(id) },
      });

      if (!fileAttachment) {
        return null;
      }

      return FileAttachmentMapper.toDomain(fileAttachment);
    } catch (error) {
      throw new Error(`Failed to find file attachment by ID: ${(error as Error).message}`);
    }
  }

  /**
   * Finds a file attachment by its S3 key.
   * @returns FileAttachment if found, null otherwise
   */
  async findByS3Key(s3Key: string): Promise<FileAttachment | null> {
    try {
      const fileAttachment = await prisma.fileAttachment.findUnique({
        where: { s3Key },
      });

      if (!fileAttachment) {
        return null;
      }

      return FileAttachmentMapper.toDomain(fileAttachment);
    } catch (error) {
      throw new Error(`Failed to find file attachment by S3 key: ${(error as Error).message}`);
    }
  }

  /**
   * Finds all file attachments with a specific virus scan status.
   * @returns Array of file attachments (empty if none found)
   */
  async findByVirusScanStatus(status: VirusScanStatus): Promise<FileAttachment[]> {
    try {
      const fileAttachments = await prisma.fileAttachment.findMany({
        where: { virusScanStatus: status.toString() as any },
        orderBy: { uploadedAt: 'desc' },
      });

      return fileAttachments.map(FileAttachmentMapper.toDomain);
    } catch (error) {
      throw new Error(
        `Failed to find file attachments by virus scan status: ${(error as Error).message}`
      );
    }
  }

  /**
   * Finds all file attachments uploaded by a specific user.
   * @returns Array of file attachments (empty if none found)
   */
  async findByUploadedBy(userId: string): Promise<FileAttachment[]> {
    try {
      const fileAttachments = await prisma.fileAttachment.findMany({
        where: { uploadedBy: parseInt(userId) },
        orderBy: { uploadedAt: 'desc' },
      });

      return fileAttachments.map(FileAttachmentMapper.toDomain);
    } catch (error) {
      throw new Error(
        `Failed to find file attachments by uploader: ${(error as Error).message}`
      );
    }
  }

  /**
   * Finds file attachments within a date range.
   * @returns Array of file attachments (empty if none found)
   */
  async findByUploadDateRange(startDate: Date, endDate: Date): Promise<FileAttachment[]> {
    try {
      const fileAttachments = await prisma.fileAttachment.findMany({
        where: {
          uploadedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { uploadedAt: 'desc' },
      });

      return fileAttachments.map(FileAttachmentMapper.toDomain);
    } catch (error) {
      throw new Error(
        `Failed to find file attachments by date range: ${(error as Error).message}`
      );
    }
  }

  /**
   * Finds all pending virus scans (status = PENDING).
   * Useful for batch processing or monitoring.
   * @returns Array of file attachments pending scan (empty if none found)
   */
  async findPendingScans(): Promise<FileAttachment[]> {
    try {
      const fileAttachments = await prisma.fileAttachment.findMany({
        where: { virusScanStatus: 'PENDING' },
        orderBy: { uploadedAt: 'asc' },
      });

      return fileAttachments.map(FileAttachmentMapper.toDomain);
    } catch (error) {
      throw new Error(`Failed to find pending virus scans: ${(error as Error).message}`);
    }
  }

  /**
   * Finds all infected files (status = INFECTED).
   * Useful for quarantine management.
   * @returns Array of infected file attachments (empty if none found)
   */
  async findInfectedFiles(): Promise<FileAttachment[]> {
    try {
      const fileAttachments = await prisma.fileAttachment.findMany({
        where: { virusScanStatus: 'INFECTED' },
        orderBy: { uploadedAt: 'desc' },
      });

      return fileAttachments.map(FileAttachmentMapper.toDomain);
    } catch (error) {
      throw new Error(`Failed to find infected files: ${(error as Error).message}`);
    }
  }

  /**
   * Checks if a file attachment exists by ID.
   * @returns true if exists, false otherwise
   */
  async exists(id: string): Promise<boolean> {
    try {
      const count = await prisma.fileAttachment.count({
        where: { id: parseInt(id) },
      });

      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check file attachment existence: ${(error as Error).message}`);
    }
  }

  /**
   * Deletes a file attachment by ID.
   * Should also handle cleanup of associated records (links, versions).
   * @throws Error if file attachment not found
   */
  async delete(id: string): Promise<void> {
    try {
      // Delete in transaction to ensure consistency
      await prisma.$transaction(async (tx) => {
        // Delete file attachment links first
        await tx.fileAttachmentLink.deleteMany({
          where: { fileAttachmentId: parseInt(id) },
        });

        // Delete file versions
        await tx.fileVersion.deleteMany({
          where: {
            OR: [
              { originalFileId: parseInt(id) },
              { newFileId: parseInt(id) },
            ],
          },
        });

        // Delete the file attachment
        await tx.fileAttachment.delete({
          where: { id: parseInt(id) },
        });
      });
    } catch (error) {
      if ((error as any).code === 'P2025') {
        throw new Error(`File attachment with ID ${id} not found`);
      }
      throw new Error(`Failed to delete file attachment: ${(error as Error).message}`);
    }
  }

  /**
   * Gets the total count of file attachments.
   * @returns Total count
   */
  async count(): Promise<number> {
    try {
      return await prisma.fileAttachment.count();
    } catch (error) {
      throw new Error(`Failed to count file attachments: ${(error as Error).message}`);
    }
  }

  /**
   * Gets the total storage used in bytes.
   * @returns Total size in bytes
   */
  async getTotalStorageUsed(): Promise<number> {
    try {
      const result = await prisma.fileAttachment.aggregate({
        _sum: {
          sizeBytes: true,
        },
      });

      return result._sum.sizeBytes || 0;
    } catch (error) {
      throw new Error(`Failed to calculate total storage used: ${(error as Error).message}`);
    }
  }
}
