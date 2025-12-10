/**
 * Domain Layer Usage Examples
 *
 * This file demonstrates how to use the domain entities, value objects,
 * and patterns in real-world scenarios. These examples can serve as
 * reference implementations for application services.
 *
 * NOTE: This file is for documentation purposes only.
 * Do not run this directly - it contains example code snippets.
 */

// ============================================================================
// DELIVERY NOTE EXAMPLES
// ============================================================================

import {
  DeliveryNote,
  DeliveryNoteItem,
  DeliveryNoteStatus,
  ItemCondition,
  QuantityDiscrepancy,
  DeliveryNoteCreatedEvent,
  DeliveryNoteConfirmedEvent,
  IDeliveryNoteRepository,
} from './delivery';

// Example 1: Creating a new delivery note with items
export function createDeliveryNoteExample() {
  // Create delivery note items
  const item1 = DeliveryNoteItem.create({
    id: 'dni-001',
    deliveryNoteId: 'dn-001',
    purchaseOrderItemId: 'poi-001',
    itemId: 'item-001',
    quantityDelivered: 100,
    orderedQuantity: 100,
    condition: ItemCondition.createGood(),
    notes: null,
  });

  const item2 = DeliveryNoteItem.create({
    id: 'dni-002',
    deliveryNoteId: 'dn-001',
    purchaseOrderItemId: 'poi-002',
    itemId: 'item-002',
    quantityDelivered: 45, // Under-delivered: ordered 50, got 45
    orderedQuantity: 50,
    condition: ItemCondition.createPartial(),
    notes: 'Partial delivery - remaining 5 units expected next week',
  });

  // Create delivery note
  const deliveryNote = DeliveryNote.create({
    id: 'dn-001',
    deliveryNoteNumber: 'DN-2024-001',
    purchaseOrderId: 'po-001',
    vendorId: 'vendor-001',
    receivedBy: 'user-001',
    deliveryDate: new Date('2024-01-15'),
    notes: 'First delivery from new vendor',
    items: [item1, item2],
  });

  console.log(`Created delivery note: ${deliveryNote.deliveryNoteNumber}`);
  console.log(`Total quantity delivered: ${deliveryNote.getTotalQuantityDelivered()}`);
  console.log(`Has issues: ${deliveryNote.hasAnyIssues()}`);

  return deliveryNote;
}

// Example 2: Confirming a delivery note (state transition)
export function confirmDeliveryNoteExample(deliveryNote: DeliveryNote) {
  // Check if can be confirmed
  if (!deliveryNote.canBeConfirmed()) {
    throw new Error('Delivery note cannot be confirmed');
  }

  // Confirm (transitions from DRAFT to CONFIRMED)
  deliveryNote.confirm();

  // Create domain event
  const event = new DeliveryNoteConfirmedEvent(
    deliveryNote.id,
    deliveryNote.deliveryNoteNumber,
    deliveryNote.purchaseOrderId,
    deliveryNote.vendorId,
    deliveryNote.getTotalQuantityDelivered(),
    deliveryNote.getTotalEffectiveQuantity(),
    deliveryNote.hasAnyIssues(),
    'user-001', // confirmedBy
    new Date()
  );

  console.log('Delivery note confirmed');
  console.log('Event:', event.toJSON());

  // After confirmation, the delivery note is immutable
  // This will throw ImmutableEntityError:
  // deliveryNote.updateItem(someItem);

  return event;
}

// Example 3: Working with quantity discrepancies
export function handleQuantityDiscrepancyExample() {
  const discrepancy = QuantityDiscrepancy.create(100, 95);

  if (discrepancy.hasDiscrepancy()) {
    console.log(discrepancy.getDescription());
    // Output: "5 units under-delivered (5.00%)"

    if (discrepancy.isUnderDelivery()) {
      console.log('Under-delivery detected');
    }

    // Check if within acceptable threshold (e.g., 10%)
    if (!discrepancy.isWithinThreshold(10)) {
      console.log('WARNING: Discrepancy exceeds acceptable threshold!');
      // Trigger alert or escalation
    }
  }

  return discrepancy;
}

// Example 4: Application service using repository
export async function createAndSaveDeliveryNote(
  repository: IDeliveryNoteRepository,
  userId: string
) {
  // 1. Create domain entities
  const items = [
    DeliveryNoteItem.create({
      id: 'dni-001',
      deliveryNoteId: 'dn-001',
      purchaseOrderItemId: 'poi-001',
      itemId: 'item-001',
      quantityDelivered: 100,
      orderedQuantity: 100,
    }),
  ];

  const deliveryNote = DeliveryNote.create({
    id: 'dn-001',
    deliveryNoteNumber: 'DN-2024-001',
    purchaseOrderId: 'po-001',
    vendorId: 'vendor-001',
    receivedBy: userId,
    deliveryDate: new Date(),
    items,
  });

  // 2. Validate business rules (done automatically in create())

  // 3. Persist via repository
  await repository.save(deliveryNote);

  // 4. Create and publish domain event
  const event = new DeliveryNoteCreatedEvent(
    deliveryNote.id,
    deliveryNote.deliveryNoteNumber,
    deliveryNote.purchaseOrderId,
    deliveryNote.vendorId,
    deliveryNote.receivedBy,
    deliveryNote.deliveryDate,
    deliveryNote.getTotalQuantityDelivered(),
    deliveryNote.itemCount
  );

  // Publish event (using your event bus/pubsub)
  // await eventBus.publish(event);

  return deliveryNote.id;
}

// ============================================================================
// FILE ATTACHMENT EXAMPLES
// ============================================================================

import {
  FileAttachment,
  FileVersion,
  S3ObjectKey,
  FileChecksum,
  VirusScanStatus,
  FileMetadata,
  FileUploadedEvent,
  FileScanCompleteEvent,
  FileReplacedEvent,
  IFileAttachmentRepository,
} from './files';

// Example 5: Creating a new file attachment
export function createFileAttachmentExample() {
  // Calculate checksum (would normally be done during upload)
  const checksum = FileChecksum.fromString(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );

  // Create file attachment
  const fileAttachment = FileAttachment.create({
    id: 'file-001',
    prefix: 'invoices',
    filename: 'invoice-2024-001.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 1024, // 1MB
    checksum,
    uploadedBy: 'user-001',
  });

  console.log(`File uploaded: ${fileAttachment.filename}`);
  console.log(`S3 Key: ${fileAttachment.s3Key.toString()}`);
  console.log(`Size: ${fileAttachment.getHumanReadableSize()}`);
  console.log(`Scan Status: ${fileAttachment.virusScanStatus.toString()}`);
  console.log(`Is pending scan: ${fileAttachment.isPendingScan()}`);

  // File starts in PENDING scan status
  // S3 key is auto-generated with UUID for uniqueness

  return fileAttachment;
}

// Example 6: Handling virus scan results
export function handleVirusScanResultExample(fileAttachment: FileAttachment) {
  // Simulate scan completion
  const scanResult: 'CLEAN' | 'INFECTED' = 'CLEAN';

  // Update scan status (only allowed mutation after creation)
  fileAttachment.markScanComplete(scanResult);

  console.log(`Scan complete: ${scanResult}`);
  console.log(`Is safe: ${fileAttachment.isSafe()}`);
  console.log(`Is ready: ${fileAttachment.isReady()}`);

  // Create domain event
  const event = new FileScanCompleteEvent(
    fileAttachment.id,
    fileAttachment.filename,
    scanResult,
    fileAttachment.s3Key.toString(),
    new Date()
  );

  console.log('Event:', event.toJSON());

  // If infected, file would be quarantined
  if (fileAttachment.isQuarantined()) {
    console.log('WARNING: File is infected and quarantined!');
  }

  return event;
}

// Example 7: Working with file metadata
export function validateFileMetadataExample() {
  try {
    // This will throw ValidationError - file too large
    const metadata = FileMetadata.create(
      'huge-file.pdf',
      'application/pdf',
      15 * 1024 * 1024 // 15MB - exceeds 10MB limit
    );
  } catch (error) {
    console.log('File rejected:', error.message);
    // Output: "File size exceeds maximum allowed size of 10MB"
  }

  // Valid file
  const metadata = FileMetadata.create(
    'invoice.pdf',
    'application/pdf',
    5 * 1024 * 1024 // 5MB
  );

  console.log(`Filename: ${metadata.filename}`);
  console.log(`MIME Type: ${metadata.mimeType}`);
  console.log(`Size: ${metadata.getHumanReadableSize()}`);
  console.log(`Is PDF: ${metadata.isPDF()}`);
  console.log(`Extension: ${metadata.getFileExtension()}`);

  // Check if near size limit
  if (metadata.isNearSizeLimit(90)) {
    console.log('WARNING: File is near the size limit');
  }

  return metadata;
}

// Example 8: File versioning (replacing a file)
export function replaceFileExample(
  currentFile: FileAttachment,
  newChecksum: FileChecksum
) {
  // Create a version record for the old file
  const oldVersion = FileVersion.create({
    id: 'version-001',
    fileAttachmentId: currentFile.id,
    versionNumber: currentFile.currentVersion,
    s3Key: currentFile.s3Key,
    checksum: currentFile.checksum,
    sizeBytes: currentFile.sizeBytes,
    replacedBy: 'user-001',
    replacementReason: 'Updated invoice with corrected amounts',
  });

  // Create new file attachment (version 2)
  const newFile = FileAttachment.create({
    id: currentFile.id, // Same ID, new version
    prefix: currentFile.s3Key.getPrefix(),
    filename: currentFile.filename,
    mimeType: currentFile.mimeType,
    sizeBytes: 2 * 1024 * 1024, // New file size
    checksum: newChecksum,
    uploadedBy: 'user-001',
  });

  // Create domain event
  const event = new FileReplacedEvent(
    currentFile.id,
    currentFile.filename,
    currentFile.currentVersion,
    newFile.currentVersion,
    currentFile.s3Key.toString(),
    newFile.s3Key.toString(),
    currentFile.checksum.toString(),
    newFile.checksum.toString(),
    'user-001',
    new Date(),
    'Updated invoice with corrected amounts'
  );

  console.log('File replaced');
  console.log('Old version:', oldVersion.getDisplayInfo());
  console.log('Event:', event.toJSON());

  return { oldVersion, newFile, event };
}

// Example 9: Application service for file upload
export async function uploadFileService(
  repository: IFileAttachmentRepository,
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  },
  userId: string
) {
  // 1. Calculate checksum
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(file.buffer);
  const checksumString = hash.digest('hex');
  const checksum = FileChecksum.fromString(checksumString);

  // 2. Create domain entity (validates size, etc.)
  const fileAttachment = FileAttachment.create({
    id: crypto.randomUUID(),
    prefix: 'invoices',
    filename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    checksum,
    uploadedBy: userId,
  });

  // 3. Upload to S3 (infrastructure concern)
  // await s3Client.upload({
  //   Key: fileAttachment.s3Key.toString(),
  //   Body: file.buffer,
  // });

  // 4. Persist to database
  await repository.save(fileAttachment);

  // 5. Create and publish domain event
  const event = new FileUploadedEvent(
    fileAttachment.id,
    fileAttachment.filename,
    fileAttachment.mimeType,
    fileAttachment.sizeBytes,
    fileAttachment.s3Key.toString(),
    fileAttachment.uploadedBy,
    fileAttachment.uploadedAt
  );

  // Publish event to trigger virus scanning
  // await eventBus.publish(event);

  console.log('File uploaded successfully');
  console.log('S3 Key:', fileAttachment.s3Key.toString());

  return fileAttachment.id;
}

// Example 10: Working with S3ObjectKey
export function s3ObjectKeyExample() {
  // Generate new S3 key with UUID
  const s3Key = S3ObjectKey.generate('invoices', 'invoice-2024-001.pdf');

  console.log('Full key:', s3Key.toString());
  // Output: "invoices/550e8400-e29b-41d4-a716-446655440000/invoice-2024-001.pdf"

  console.log('Prefix:', s3Key.getPrefix()); // "invoices"
  console.log('UUID:', s3Key.getUUID()); // "550e8400-e29b-41d4-a716-446655440000"
  console.log('Filename:', s3Key.getFilename()); // "invoice-2024-001.pdf"

  // Reconstitute from stored string
  const storedKey = 'invoices/550e8400-e29b-41d4-a716-446655440000/invoice.pdf';
  const reconstructed = S3ObjectKey.fromString(storedKey);

  console.log('Reconstructed:', reconstructed.toString());

  return s3Key;
}

// ============================================================================
// ERROR HANDLING EXAMPLES
// ============================================================================

import {
  ValidationError,
  BusinessRuleViolationError,
  ImmutableEntityError,
  InvalidStateTransitionError,
} from './shared';

// Example 11: Comprehensive error handling
export function errorHandlingExample() {
  try {
    // Attempt to create delivery note without items
    const deliveryNote = DeliveryNote.create({
      id: 'dn-001',
      deliveryNoteNumber: 'DN-2024-001',
      purchaseOrderId: 'po-001',
      vendorId: 'vendor-001',
      receivedBy: 'user-001',
      deliveryDate: new Date(),
      items: [], // Empty - will throw
    });
  } catch (error) {
    if (error instanceof BusinessRuleViolationError) {
      console.log('Business rule violated:', error.message);
      // Handle: Return 400 with business rule explanation
    }
  }

  try {
    // Attempt to modify confirmed delivery note
    const deliveryNote = createDeliveryNoteExample();
    deliveryNote.confirm();

    const item = DeliveryNoteItem.create({
      id: 'dni-003',
      deliveryNoteId: deliveryNote.id,
      purchaseOrderItemId: 'poi-003',
      itemId: 'item-003',
      quantityDelivered: 10,
      orderedQuantity: 10,
    });

    deliveryNote.updateItem(item); // Will throw
  } catch (error) {
    if (error instanceof ImmutableEntityError) {
      console.log('Immutability violation:', error.message);
      // Handle: Return 409 Conflict
    }
  }

  try {
    // Attempt invalid state transition
    const status = DeliveryNoteStatus.createConfirmed();
    const draftStatus = DeliveryNoteStatus.createDraft();

    status.transitionTo(draftStatus); // Will throw - cannot go backwards
  } catch (error) {
    if (error instanceof InvalidStateTransitionError) {
      console.log('Invalid state transition:', error.message);
      // Handle: Return 422 Unprocessable Entity
    }
  }

  try {
    // Attempt to create file with invalid checksum
    const checksum = FileChecksum.fromString('invalid'); // Will throw
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('Validation failed:', error.message);
      // Handle: Return 400 Bad Request
    }
  }
}

// ============================================================================
// REPOSITORY PATTERN EXAMPLES
// ============================================================================

// Example 12: Implementing a repository (infrastructure layer)
export class PrismaDeliveryNoteRepository implements IDeliveryNoteRepository {
  constructor(private prisma: any) {} // Prisma client

  async save(deliveryNote: DeliveryNote): Promise<void> {
    // Convert domain entity to Prisma model
    await this.prisma.deliveryNote.create({
      data: {
        id: deliveryNote.id,
        deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
        purchaseOrderId: deliveryNote.purchaseOrderId,
        vendorId: deliveryNote.vendorId,
        receivedBy: deliveryNote.receivedBy,
        deliveryDate: deliveryNote.deliveryDate,
        status: deliveryNote.status.toString(),
        notes: deliveryNote.notes,
        createdAt: deliveryNote.createdAt,
        updatedAt: deliveryNote.updatedAt,
        items: {
          create: deliveryNote.getItems().map(item => ({
            id: item.id,
            purchaseOrderItemId: item.purchaseOrderItemId,
            itemId: item.itemId,
            quantityDelivered: item.quantityDelivered,
            orderedQuantity: item.orderedQuantity,
            condition: item.condition.toString(),
            notes: item.notes,
          })),
        },
      },
    });
  }

  async findById(id: string): Promise<DeliveryNote | null> {
    const record = await this.prisma.deliveryNote.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!record) return null;

    // Convert Prisma model to domain entity
    const items = record.items.map((item: any) =>
      DeliveryNoteItem.create({
        id: item.id,
        deliveryNoteId: record.id,
        purchaseOrderItemId: item.purchaseOrderItemId,
        itemId: item.itemId,
        quantityDelivered: item.quantityDelivered,
        orderedQuantity: item.orderedQuantity,
        condition: ItemCondition.fromString(item.condition),
        notes: item.notes,
      })
    );

    return DeliveryNote.reconstitute({
      id: record.id,
      deliveryNoteNumber: record.deliveryNoteNumber,
      purchaseOrderId: record.purchaseOrderId,
      vendorId: record.vendorId,
      receivedBy: record.receivedBy,
      deliveryDate: record.deliveryDate,
      status: DeliveryNoteStatus.fromString(record.status),
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      items,
    });
  }

  async update(deliveryNote: DeliveryNote): Promise<void> {
    // Implementation similar to save
    throw new Error('Not implemented');
  }

  async findByDeliveryNoteNumber(deliveryNoteNumber: string): Promise<DeliveryNote | null> {
    throw new Error('Not implemented');
  }

  async findByPurchaseOrderId(purchaseOrderId: string): Promise<DeliveryNote[]> {
    throw new Error('Not implemented');
  }

  async findByVendorId(vendorId: string): Promise<DeliveryNote[]> {
    throw new Error('Not implemented');
  }

  async findByStatus(status: DeliveryNoteStatus): Promise<DeliveryNote[]> {
    throw new Error('Not implemented');
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<DeliveryNote[]> {
    throw new Error('Not implemented');
  }

  async findWithIssues(): Promise<DeliveryNote[]> {
    throw new Error('Not implemented');
  }

  async existsByDeliveryNoteNumber(deliveryNoteNumber: string): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented');
  }
}

// ============================================================================
// END OF EXAMPLES
// ============================================================================
