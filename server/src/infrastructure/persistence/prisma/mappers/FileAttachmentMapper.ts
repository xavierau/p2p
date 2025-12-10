import { FileAttachment as PrismaFileAttachment, FileVersion as PrismaFileVersion } from '@prisma/client';
import { FileAttachment } from '../../../../domain/files/entities/FileAttachment';
import { FileVersion } from '../../../../domain/files/entities/FileVersion';
import { S3ObjectKey } from '../../../../domain/files/value-objects/S3ObjectKey';
import { FileChecksum } from '../../../../domain/files/value-objects/FileChecksum';
import { VirusScanStatus } from '../../../../domain/files/value-objects/VirusScanStatus';
import { FileMetadata } from '../../../../domain/files/value-objects/FileMetadata';

/**
 * Mapper to convert between Prisma models and FileAttachment domain entities.
 * Implements the Data Mapper pattern to decouple domain layer from persistence.
 */
export class FileAttachmentMapper {
  /**
   * Converts a Prisma FileAttachment to a domain FileAttachment entity.
   * @param prismaFileAttachment - Prisma model
   * @returns Domain FileAttachment entity
   */
  static toDomain(prismaFileAttachment: PrismaFileAttachment): FileAttachment {
    const s3Key = S3ObjectKey.fromString(prismaFileAttachment.s3Key);
    const checksum = FileChecksum.fromString(prismaFileAttachment.checksum);
    const virusScanStatus = VirusScanStatus.fromString(prismaFileAttachment.virusScanStatus);
    const metadata = FileMetadata.create(
      prismaFileAttachment.filename,
      prismaFileAttachment.contentType,
      prismaFileAttachment.sizeBytes
    );

    return FileAttachment.reconstitute({
      id: prismaFileAttachment.id.toString(),
      s3Key,
      metadata,
      checksum,
      virusScanStatus,
      uploadedBy: prismaFileAttachment.uploadedBy.toString(),
      uploadedAt: prismaFileAttachment.uploadedAt,
      currentVersion: 1, // Default to version 1 for now
    });
  }

  /**
   * Converts a domain FileAttachment entity to Prisma create data.
   * @param fileAttachment - Domain entity
   * @returns Prisma create input
   */
  static toPersistenceCreate(fileAttachment: FileAttachment): {
    filename: string;
    s3Key: string;
    contentType: string;
    sizeBytes: number;
    checksum: string;
    virusScanStatus: string;
    uploadedBy: number;
    uploadedAt: Date;
  } {
    return {
      filename: fileAttachment.filename,
      s3Key: fileAttachment.s3Key.toString(),
      contentType: fileAttachment.mimeType,
      sizeBytes: fileAttachment.sizeBytes,
      checksum: fileAttachment.checksum.toString(),
      virusScanStatus: fileAttachment.virusScanStatus.toString(),
      uploadedBy: parseInt(fileAttachment.uploadedBy),
      uploadedAt: fileAttachment.uploadedAt,
    };
  }

  /**
   * Converts a domain FileAttachment entity to Prisma update data.
   * Typically only virus scan status is updated.
   * @param fileAttachment - Domain entity
   * @returns Prisma update input
   */
  static toPersistenceUpdate(fileAttachment: FileAttachment): {
    virusScanStatus: string;
    virusScanResult: string | null;
  } {
    return {
      virusScanStatus: fileAttachment.virusScanStatus.toString(),
      virusScanResult: fileAttachment.virusScanStatus.isInfected()
        ? 'Virus detected'
        : null,
    };
  }

  /**
   * Converts a Prisma FileVersion to a domain FileVersion entity.
   * @param prismaFileVersion - Prisma model
   * @returns Domain FileVersion entity
   */
  static fileVersionToDomain(prismaFileVersion: PrismaFileVersion): FileVersion {
    const s3Key = S3ObjectKey.fromString(''); // TODO: Need to fetch from FileAttachment
    const checksum = FileChecksum.fromString('0'.repeat(64)); // TODO: Need to fetch from FileAttachment

    return FileVersion.reconstitute({
      id: prismaFileVersion.id.toString(),
      fileAttachmentId: prismaFileVersion.originalFileId.toString(),
      versionNumber: prismaFileVersion.versionNumber,
      s3Key,
      checksum,
      sizeBytes: 0, // TODO: Need to fetch from FileAttachment
      replacedBy: prismaFileVersion.replacedBy.toString(),
      replacedAt: prismaFileVersion.replacedAt,
      replacementReason: null,
    });
  }

  /**
   * Converts a domain FileVersion entity to Prisma create data.
   * @param fileVersion - Domain entity
   * @returns Prisma create input
   */
  static fileVersionToPersistenceCreate(fileVersion: FileVersion): {
    originalFileId: number;
    newFileId: number;
    previousVersionId: number | null;
    versionNumber: number;
    replacedBy: number;
    replacedAt: Date;
  } {
    return {
      originalFileId: parseInt(fileVersion.fileAttachmentId),
      newFileId: parseInt(fileVersion.id), // This will need adjustment based on actual implementation
      previousVersionId: null, // TODO: Handle version chain
      versionNumber: fileVersion.versionNumber,
      replacedBy: parseInt(fileVersion.replacedBy),
      replacedAt: fileVersion.replacedAt,
    };
  }
}
