/**
 * Entity type that can have file attachments.
 * Extensible to support new entity types without modifying the domain layer.
 */
export type EntityType = 'INVOICE' | 'DELIVERY_NOTE' | 'PURCHASE_ORDER' | 'VENDOR';

/**
 * Link between a FileAttachment and an entity (Invoice, DeliveryNote, etc.).
 * Represents the polymorphic relationship in a type-safe manner.
 */
export interface FileAttachmentLink {
  fileAttachmentId: string;
  entityType: EntityType;
  entityId: string;
  attachedBy: string;
  attachedAt: Date;
}

/**
 * Repository interface for managing file attachment links.
 * Separated from FileAttachmentRepository to follow Interface Segregation Principle.
 * Supports polymorphic associations without tight coupling.
 */
export interface IFileAttachmentLinkRepository {
  /**
   * Creates a link between a file attachment and an entity.
   * @throws Error if link already exists
   */
  link(
    fileAttachmentId: string,
    entityType: EntityType,
    entityId: string,
    attachedBy: string
  ): Promise<void>;

  /**
   * Removes the link between a file attachment and an entity.
   * @throws Error if link does not exist
   */
  unlink(fileAttachmentId: string, entityType: EntityType, entityId: string): Promise<void>;

  /**
   * Finds all file attachment IDs linked to a specific entity.
   * @returns Array of file attachment IDs (empty if none found)
   */
  findFileAttachmentIdsByEntity(entityType: EntityType, entityId: string): Promise<string[]>;

  /**
   * Finds all entities linked to a specific file attachment.
   * @returns Array of entity references (empty if none found)
   */
  findEntitiesByFileAttachmentId(
    fileAttachmentId: string
  ): Promise<Array<{ entityType: EntityType; entityId: string }>>;

  /**
   * Checks if a link exists between a file attachment and an entity.
   * @returns true if link exists, false otherwise
   */
  exists(fileAttachmentId: string, entityType: EntityType, entityId: string): Promise<boolean>;

  /**
   * Gets all links for a specific entity.
   * @returns Array of FileAttachmentLink (empty if none found)
   */
  findLinksByEntity(entityType: EntityType, entityId: string): Promise<FileAttachmentLink[]>;

  /**
   * Gets all links for a specific file attachment.
   * @returns Array of FileAttachmentLink (empty if none found)
   */
  findLinksByFileAttachment(fileAttachmentId: string): Promise<FileAttachmentLink[]>;

  /**
   * Counts the number of attachments for a specific entity.
   * @returns Count of attachments
   */
  countByEntity(entityType: EntityType, entityId: string): Promise<number>;

  /**
   * Counts how many entities reference a specific file attachment.
   * @returns Count of entity references
   */
  countByFileAttachment(fileAttachmentId: string): Promise<number>;

  /**
   * Removes all links for a specific entity.
   * Useful when deleting an entity.
   */
  deleteByEntity(entityType: EntityType, entityId: string): Promise<void>;

  /**
   * Removes all links for a specific file attachment.
   * Useful when deleting a file attachment.
   */
  deleteByFileAttachment(fileAttachmentId: string): Promise<void>;

  /**
   * Finds orphaned file attachments (not linked to any entity).
   * Useful for cleanup operations.
   * @returns Array of file attachment IDs with no links
   */
  findOrphanedFileAttachments(): Promise<string[]>;
}
