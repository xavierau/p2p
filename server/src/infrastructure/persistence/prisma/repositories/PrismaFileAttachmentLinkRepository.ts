import prisma from '../../../../prisma';
import {
  IFileAttachmentLinkRepository,
  FileAttachmentLink,
  EntityType,
} from '../../../../domain/files/repositories/IFileAttachmentLinkRepository';

/**
 * Prisma implementation of IFileAttachmentLinkRepository.
 * Manages polymorphic associations between file attachments and various entities.
 */
export class PrismaFileAttachmentLinkRepository implements IFileAttachmentLinkRepository {
  /**
   * Converts domain EntityType to Prisma AttachableEntityType.
   */
  private toPrismaEntityType(entityType: EntityType): string {
    // Direct mapping since the enums match
    return entityType;
  }

  /**
   * Converts Prisma AttachableEntityType to domain EntityType.
   */
  private toDomainEntityType(prismaType: string): EntityType {
    return prismaType as EntityType;
  }

  /**
   * Creates a link between a file attachment and an entity.
   * @throws Error if link already exists
   */
  async link(
    fileAttachmentId: string,
    entityType: EntityType,
    entityId: string,
    attachedBy: string
  ): Promise<void> {
    try {
      await prisma.fileAttachmentLink.create({
        data: {
          fileAttachmentId: parseInt(fileAttachmentId),
          entityType: this.toPrismaEntityType(entityType) as any,
          entityId: parseInt(entityId),
          attachedBy: parseInt(attachedBy),
          isActive: true,
        },
      });
    } catch (error) {
      if ((error as any).code === 'P2002') {
        throw new Error(
          `Link already exists between file ${fileAttachmentId} and ${entityType} ${entityId}`
        );
      }
      throw new Error(`Failed to create file attachment link: ${(error as Error).message}`);
    }
  }

  /**
   * Removes the link between a file attachment and an entity.
   * Uses soft delete by setting isActive to false.
   * @throws Error if link does not exist
   */
  async unlink(fileAttachmentId: string, entityType: EntityType, entityId: string): Promise<void> {
    try {
      const result = await prisma.fileAttachmentLink.updateMany({
        where: {
          fileAttachmentId: parseInt(fileAttachmentId),
          entityType: this.toPrismaEntityType(entityType) as any,
          entityId: parseInt(entityId),
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      if (result.count === 0) {
        throw new Error(
          `Link does not exist between file ${fileAttachmentId} and ${entityType} ${entityId}`
        );
      }
    } catch (error) {
      throw new Error(`Failed to remove file attachment link: ${(error as Error).message}`);
    }
  }

  /**
   * Finds all file attachment IDs linked to a specific entity.
   * @returns Array of file attachment IDs (empty if none found)
   */
  async findFileAttachmentIdsByEntity(
    entityType: EntityType,
    entityId: string
  ): Promise<string[]> {
    try {
      const links = await prisma.fileAttachmentLink.findMany({
        where: {
          entityType: this.toPrismaEntityType(entityType) as any,
          entityId: parseInt(entityId),
          isActive: true,
        },
        select: { fileAttachmentId: true },
      });

      return links.map(link => link.fileAttachmentId.toString());
    } catch (error) {
      throw new Error(
        `Failed to find file attachments by entity: ${(error as Error).message}`
      );
    }
  }

  /**
   * Finds all entities linked to a specific file attachment.
   * @returns Array of entity references (empty if none found)
   */
  async findEntitiesByFileAttachmentId(
    fileAttachmentId: string
  ): Promise<Array<{ entityType: EntityType; entityId: string }>> {
    try {
      const links = await prisma.fileAttachmentLink.findMany({
        where: {
          fileAttachmentId: parseInt(fileAttachmentId),
          isActive: true,
        },
        select: {
          entityType: true,
          entityId: true,
        },
      });

      return links.map(link => ({
        entityType: this.toDomainEntityType(link.entityType),
        entityId: link.entityId.toString(),
      }));
    } catch (error) {
      throw new Error(
        `Failed to find entities by file attachment: ${(error as Error).message}`
      );
    }
  }

  /**
   * Checks if a link exists between a file attachment and an entity.
   * @returns true if link exists, false otherwise
   */
  async exists(
    fileAttachmentId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<boolean> {
    try {
      const count = await prisma.fileAttachmentLink.count({
        where: {
          fileAttachmentId: parseInt(fileAttachmentId),
          entityType: this.toPrismaEntityType(entityType) as any,
          entityId: parseInt(entityId),
          isActive: true,
        },
      });

      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check file attachment link existence: ${(error as Error).message}`);
    }
  }

  /**
   * Gets all links for a specific entity.
   * @returns Array of FileAttachmentLink (empty if none found)
   */
  async findLinksByEntity(entityType: EntityType, entityId: string): Promise<FileAttachmentLink[]> {
    try {
      const links = await prisma.fileAttachmentLink.findMany({
        where: {
          entityType: this.toPrismaEntityType(entityType) as any,
          entityId: parseInt(entityId),
          isActive: true,
        },
        orderBy: { attachedAt: 'desc' },
      });

      return links.map(link => ({
        fileAttachmentId: link.fileAttachmentId.toString(),
        entityType: this.toDomainEntityType(link.entityType),
        entityId: link.entityId.toString(),
        attachedBy: link.attachedBy.toString(),
        attachedAt: link.attachedAt,
      }));
    } catch (error) {
      throw new Error(`Failed to find links by entity: ${(error as Error).message}`);
    }
  }

  /**
   * Gets all links for a specific file attachment.
   * @returns Array of FileAttachmentLink (empty if none found)
   */
  async findLinksByFileAttachment(fileAttachmentId: string): Promise<FileAttachmentLink[]> {
    try {
      const links = await prisma.fileAttachmentLink.findMany({
        where: {
          fileAttachmentId: parseInt(fileAttachmentId),
          isActive: true,
        },
        orderBy: { attachedAt: 'desc' },
      });

      return links.map(link => ({
        fileAttachmentId: link.fileAttachmentId.toString(),
        entityType: this.toDomainEntityType(link.entityType),
        entityId: link.entityId.toString(),
        attachedBy: link.attachedBy.toString(),
        attachedAt: link.attachedAt,
      }));
    } catch (error) {
      throw new Error(`Failed to find links by file attachment: ${(error as Error).message}`);
    }
  }

  /**
   * Counts the number of attachments for a specific entity.
   * @returns Count of attachments
   */
  async countByEntity(entityType: EntityType, entityId: string): Promise<number> {
    try {
      return await prisma.fileAttachmentLink.count({
        where: {
          entityType: this.toPrismaEntityType(entityType) as any,
          entityId: parseInt(entityId),
          isActive: true,
        },
      });
    } catch (error) {
      throw new Error(`Failed to count attachments by entity: ${(error as Error).message}`);
    }
  }

  /**
   * Counts how many entities reference a specific file attachment.
   * @returns Count of entity references
   */
  async countByFileAttachment(fileAttachmentId: string): Promise<number> {
    try {
      return await prisma.fileAttachmentLink.count({
        where: {
          fileAttachmentId: parseInt(fileAttachmentId),
          isActive: true,
        },
      });
    } catch (error) {
      throw new Error(`Failed to count entities by file attachment: ${(error as Error).message}`);
    }
  }

  /**
   * Removes all links for a specific entity.
   * Uses soft delete by setting isActive to false.
   * Useful when deleting an entity.
   */
  async deleteByEntity(entityType: EntityType, entityId: string): Promise<void> {
    try {
      await prisma.fileAttachmentLink.updateMany({
        where: {
          entityType: this.toPrismaEntityType(entityType) as any,
          entityId: parseInt(entityId),
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    } catch (error) {
      throw new Error(`Failed to delete links by entity: ${(error as Error).message}`);
    }
  }

  /**
   * Removes all links for a specific file attachment.
   * Uses soft delete by setting isActive to false.
   * Useful when deleting a file attachment.
   */
  async deleteByFileAttachment(fileAttachmentId: string): Promise<void> {
    try {
      await prisma.fileAttachmentLink.updateMany({
        where: {
          fileAttachmentId: parseInt(fileAttachmentId),
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    } catch (error) {
      throw new Error(`Failed to delete links by file attachment: ${(error as Error).message}`);
    }
  }

  /**
   * Finds orphaned file attachments (not linked to any entity).
   * Useful for cleanup operations.
   * @returns Array of file attachment IDs with no links
   */
  async findOrphanedFileAttachments(): Promise<string[]> {
    try {
      const allFiles = await prisma.fileAttachment.findMany({
        select: { id: true },
      });

      const orphanedIds: string[] = [];

      for (const file of allFiles) {
        const linkCount = await prisma.fileAttachmentLink.count({
          where: {
            fileAttachmentId: file.id,
            isActive: true,
          },
        });

        if (linkCount === 0) {
          orphanedIds.push(file.id.toString());
        }
      }

      return orphanedIds;
    } catch (error) {
      throw new Error(`Failed to find orphaned file attachments: ${(error as Error).message}`);
    }
  }
}
