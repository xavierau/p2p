import prisma from '../../../../prisma';
import { IFileVersionRepository } from '../../../../domain/files/repositories/IFileVersionRepository';
import { FileVersion } from '../../../../domain/files/entities/FileVersion';
import { FileAttachmentMapper } from '../mappers/FileAttachmentMapper';

/**
 * Prisma implementation of IFileVersionRepository.
 * Manages historical versions of file attachments for audit trail.
 */
export class PrismaFileVersionRepository implements IFileVersionRepository {
  /**
   * Persists a new file version.
   * @throws Error if file version with same ID already exists
   */
  async save(fileVersion: FileVersion): Promise<void> {
    try {
      const data = FileAttachmentMapper.fileVersionToPersistenceCreate(fileVersion);

      await prisma.fileVersion.create({
        data,
      });
    } catch (error) {
      if ((error as any).code === 'P2002') {
        throw new Error(`File version with ID ${fileVersion.id} already exists`);
      }
      throw new Error(`Failed to save file version: ${(error as Error).message}`);
    }
  }

  /**
   * Finds a file version by its ID.
   * @returns FileVersion if found, null otherwise
   */
  async findById(id: string): Promise<FileVersion | null> {
    try {
      const fileVersion = await prisma.fileVersion.findUnique({
        where: { id: parseInt(id) },
      });

      if (!fileVersion) {
        return null;
      }

      return FileAttachmentMapper.fileVersionToDomain(fileVersion);
    } catch (error) {
      throw new Error(`Failed to find file version by ID: ${(error as Error).message}`);
    }
  }

  /**
   * Finds all versions for a specific file attachment.
   * Ordered by version number descending (newest first).
   * @returns Array of file versions (empty if none found)
   */
  async findByFileAttachmentId(fileAttachmentId: string): Promise<FileVersion[]> {
    try {
      const fileVersions = await prisma.fileVersion.findMany({
        where: { originalFileId: parseInt(fileAttachmentId) },
        orderBy: { versionNumber: 'desc' },
      });

      return fileVersions.map(FileAttachmentMapper.fileVersionToDomain);
    } catch (error) {
      throw new Error(
        `Failed to find file versions by file attachment ID: ${(error as Error).message}`
      );
    }
  }

  /**
   * Finds a specific version number for a file attachment.
   * @returns FileVersion if found, null otherwise
   */
  async findByFileAttachmentIdAndVersion(
    fileAttachmentId: string,
    versionNumber: number
  ): Promise<FileVersion | null> {
    try {
      const fileVersion = await prisma.fileVersion.findUnique({
        where: {
          originalFileId_versionNumber: {
            originalFileId: parseInt(fileAttachmentId),
            versionNumber,
          },
        },
      });

      if (!fileVersion) {
        return null;
      }

      return FileAttachmentMapper.fileVersionToDomain(fileVersion);
    } catch (error) {
      throw new Error(
        `Failed to find file version by ID and version number: ${(error as Error).message}`
      );
    }
  }

  /**
   * Finds the latest version for a file attachment.
   * @returns FileVersion if found, null otherwise
   */
  async findLatestByFileAttachmentId(fileAttachmentId: string): Promise<FileVersion | null> {
    try {
      const fileVersion = await prisma.fileVersion.findFirst({
        where: { originalFileId: parseInt(fileAttachmentId) },
        orderBy: { versionNumber: 'desc' },
      });

      if (!fileVersion) {
        return null;
      }

      return FileAttachmentMapper.fileVersionToDomain(fileVersion);
    } catch (error) {
      throw new Error(
        `Failed to find latest file version: ${(error as Error).message}`
      );
    }
  }

  /**
   * Finds all versions replaced by a specific user.
   * @returns Array of file versions (empty if none found)
   */
  async findByReplacedBy(userId: string): Promise<FileVersion[]> {
    try {
      const fileVersions = await prisma.fileVersion.findMany({
        where: { replacedBy: parseInt(userId) },
        orderBy: { replacedAt: 'desc' },
      });

      return fileVersions.map(FileAttachmentMapper.fileVersionToDomain);
    } catch (error) {
      throw new Error(
        `Failed to find file versions by replaced by: ${(error as Error).message}`
      );
    }
  }

  /**
   * Finds versions within a date range.
   * @returns Array of file versions (empty if none found)
   */
  async findByReplacementDateRange(startDate: Date, endDate: Date): Promise<FileVersion[]> {
    try {
      const fileVersions = await prisma.fileVersion.findMany({
        where: {
          replacedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { replacedAt: 'desc' },
      });

      return fileVersions.map(FileAttachmentMapper.fileVersionToDomain);
    } catch (error) {
      throw new Error(
        `Failed to find file versions by date range: ${(error as Error).message}`
      );
    }
  }

  /**
   * Gets the version count for a specific file attachment.
   * @returns Count of versions
   */
  async countByFileAttachmentId(fileAttachmentId: string): Promise<number> {
    try {
      return await prisma.fileVersion.count({
        where: { originalFileId: parseInt(fileAttachmentId) },
      });
    } catch (error) {
      throw new Error(
        `Failed to count file versions: ${(error as Error).message}`
      );
    }
  }

  /**
   * Checks if a file attachment has any versions.
   * @returns true if versions exist, false otherwise
   */
  async hasVersions(fileAttachmentId: string): Promise<boolean> {
    try {
      const count = await this.countByFileAttachmentId(fileAttachmentId);
      return count > 0;
    } catch (error) {
      throw new Error(
        `Failed to check if file has versions: ${(error as Error).message}`
      );
    }
  }

  /**
   * Deletes all versions for a specific file attachment.
   * Should be called when deleting the file attachment.
   * @returns Count of deleted versions
   */
  async deleteByFileAttachmentId(fileAttachmentId: string): Promise<number> {
    try {
      const result = await prisma.fileVersion.deleteMany({
        where: {
          OR: [
            { originalFileId: parseInt(fileAttachmentId) },
            { newFileId: parseInt(fileAttachmentId) },
          ],
        },
      });

      return result.count;
    } catch (error) {
      throw new Error(
        `Failed to delete file versions: ${(error as Error).message}`
      );
    }
  }

  /**
   * Deletes a specific version.
   * Should only be used for cleanup/maintenance, not normal operations.
   * @throws Error if version not found
   */
  async delete(id: string): Promise<void> {
    try {
      await prisma.fileVersion.delete({
        where: { id: parseInt(id) },
      });
    } catch (error) {
      if ((error as any).code === 'P2025') {
        throw new Error(`File version with ID ${id} not found`);
      }
      throw new Error(`Failed to delete file version: ${(error as Error).message}`);
    }
  }

  /**
   * Gets the total storage used by versions in bytes.
   * @returns Total size in bytes
   */
  async getTotalStorageUsed(): Promise<number> {
    try {
      // Get all unique newFileIds
      const versions = await prisma.fileVersion.findMany({
        select: { newFileId: true },
      });

      const fileIds = [...new Set(versions.map(v => v.newFileId))];

      if (fileIds.length === 0) {
        return 0;
      }

      const result = await prisma.fileAttachment.aggregate({
        where: {
          id: { in: fileIds },
        },
        _sum: {
          sizeBytes: true,
        },
      });

      return result._sum.sizeBytes || 0;
    } catch (error) {
      throw new Error(
        `Failed to calculate total storage used by versions: ${(error as Error).message}`
      );
    }
  }

  /**
   * Gets the total storage used by versions for a specific file attachment.
   * @returns Total size in bytes
   */
  async getTotalStorageUsedByFileAttachment(fileAttachmentId: string): Promise<number> {
    try {
      const versions = await prisma.fileVersion.findMany({
        where: { originalFileId: parseInt(fileAttachmentId) },
        select: { newFileId: true },
      });

      const fileIds = versions.map(v => v.newFileId);

      if (fileIds.length === 0) {
        return 0;
      }

      const result = await prisma.fileAttachment.aggregate({
        where: {
          id: { in: fileIds },
        },
        _sum: {
          sizeBytes: true,
        },
      });

      return result._sum.sizeBytes || 0;
    } catch (error) {
      throw new Error(
        `Failed to calculate storage used by file versions: ${(error as Error).message}`
      );
    }
  }
}
