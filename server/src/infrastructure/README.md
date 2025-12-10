# Infrastructure Layer

This directory contains the infrastructure layer implementation for the DeliveryNote and FileAttachment systems. The infrastructure layer implements the interfaces defined in the domain layer, providing concrete implementations for persistence, storage, and external services.

## Architecture Overview

The infrastructure layer follows Clean Architecture principles:
- **Domain Layer** defines interfaces (contracts)
- **Infrastructure Layer** implements those interfaces
- Domain logic remains independent of implementation details
- Easy to swap implementations (e.g., PostgreSQL → MongoDB, AWS S3 → MinIO)

## Directory Structure

```
infrastructure/
├── persistence/
│   ├── prisma/
│   │   ├── repositories/         # Prisma repository implementations
│   │   │   ├── PrismaDeliveryNoteRepository.ts
│   │   │   ├── PrismaInvoiceDeliveryLinkRepository.ts
│   │   │   ├── PrismaFileAttachmentRepository.ts
│   │   │   ├── PrismaFileAttachmentLinkRepository.ts
│   │   │   └── PrismaFileVersionRepository.ts
│   │   └── mappers/              # Domain ↔ Prisma model mappers
│   │       ├── DeliveryNoteMapper.ts
│   │       └── FileAttachmentMapper.ts
├── storage/                      # S3 storage implementation
│   ├── IS3StorageProvider.ts     # Storage provider interface
│   ├── AWSS3StorageProvider.ts   # AWS S3 implementation
│   └── S3Config.ts               # S3 configuration
└── events/
    └── subscribers/              # Event subscribers
        └── FileUploadedSubscriber.ts
```

## Components

### 1. Persistence Layer (Prisma)

#### Repositories

Repository implementations handle all database operations using Prisma:

- **PrismaDeliveryNoteRepository**: CRUD operations for delivery notes and items
- **PrismaInvoiceDeliveryLinkRepository**: Manages many-to-many relationships between invoices and delivery notes
- **PrismaFileAttachmentRepository**: CRUD operations for file attachments with virus scan status tracking
- **PrismaFileAttachmentLinkRepository**: Polymorphic associations between files and entities (invoices, delivery notes, etc.)
- **PrismaFileVersionRepository**: Version history tracking for file replacements

All repositories follow these principles:
- Implement domain repository interfaces
- Use mappers to convert between Prisma models and domain entities
- Handle all Prisma-specific error codes
- Return domain entities, never Prisma models
- Include proper error handling and transaction support

#### Mappers

Mappers implement the Data Mapper pattern to decouple domain entities from persistence models:

- **DeliveryNoteMapper**: Converts between `DeliveryNote` domain entity and Prisma models
  - `toDomain()`: Prisma → Domain entity
  - `toPersistenceCreate()`: Domain entity → Prisma create input
  - `toPersistenceUpdate()`: Domain entity → Prisma update input

- **FileAttachmentMapper**: Converts between `FileAttachment` domain entity and Prisma models
  - Handles value objects (S3ObjectKey, FileChecksum, VirusScanStatus, FileMetadata)
  - Maps file versions for audit trail

### 2. Storage Layer (S3)

#### IS3StorageProvider (Interface)

Defines the contract for S3-compatible storage providers:

```typescript
interface IS3StorageProvider {
  upload(key: string, buffer: Buffer, contentType: string): Promise<void>;
  download(key: string): Promise<Buffer>;
  getPresignedUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<string>;
  getPresignedDownloadUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<{ contentType: string; contentLength: number; lastModified: Date }>;
}
```

#### AWSS3StorageProvider

AWS S3 implementation using AWS SDK v3:
- Supports both AWS S3 and S3-compatible services (MinIO, DigitalOcean Spaces)
- Server-side encryption enabled (AES256)
- Presigned URL generation for direct client uploads/downloads
- Proper error handling for all S3 operations

#### S3Config

Configuration management for S3:
- Loads configuration from environment variables
- Validates all required settings
- Supports custom endpoints for S3-compatible services

**Required Environment Variables:**
```bash
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_ENDPOINT=https://s3.example.com  # Optional, for S3-compatible services
S3_FORCE_PATH_STYLE=true             # Optional, required for MinIO
```

### 3. Events Layer

#### FileUploadedSubscriber

Handles post-upload processing for file attachments:
- Subscribes to `FILE_UPLOADED` events from PubSub
- Triggers virus scanning (placeholder implementation)
- Handles scan results and quarantine

**Virus Scanning Integration (Placeholder):**

The current implementation is a placeholder. For production ClamAV integration:

1. Install ClamAV:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install clamav clamav-daemon

   # macOS
   brew install clamav
   ```

2. Install Node.js ClamAV client:
   ```bash
   npm install clamscan
   ```

3. Implement `IVirusScanningService`:
   - Download file from S3 to temp location
   - Scan with ClamAV daemon
   - Update FileAttachment virus scan status
   - Quarantine infected files
   - Publish `VIRUS_SCAN_COMPLETE` event

## Usage Examples

### Initialize Repositories

```typescript
import {
  PrismaDeliveryNoteRepository,
  PrismaFileAttachmentRepository,
  AWSS3StorageProvider,
  loadS3Config,
} from './infrastructure';

// Initialize repositories
const deliveryNoteRepo = new PrismaDeliveryNoteRepository();
const fileAttachmentRepo = new PrismaFileAttachmentRepository();

// Initialize S3 storage
const s3Config = loadS3Config();
const s3Storage = new AWSS3StorageProvider(s3Config);
```

### Save a Delivery Note

```typescript
import { DeliveryNote } from '../domain/delivery/entities/DeliveryNote';
import { DeliveryNoteItem } from '../domain/delivery/entities/DeliveryNoteItem';

const deliveryNote = DeliveryNote.create({
  id: '1',
  deliveryNoteNumber: 'DN-2025-001',
  purchaseOrderId: '123',
  vendorId: '456',
  receivedBy: 'John Doe',
  deliveryDate: new Date(),
  items: [
    DeliveryNoteItem.create({
      id: '1',
      deliveryNoteId: '1',
      purchaseOrderItemId: '789',
      itemId: '101',
      quantityDelivered: 50,
      orderedQuantity: 50,
    }),
  ],
});

await deliveryNoteRepo.save(deliveryNote);
```

### Upload a File

```typescript
import { FileAttachment } from '../domain/files/entities/FileAttachment';
import { FileChecksum } from '../domain/files/value-objects/FileChecksum';
import crypto from 'crypto';

// Calculate checksum
const buffer = await fs.readFile(filePath);
const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

// Create domain entity
const fileAttachment = FileAttachment.create({
  id: '1',
  prefix: 'invoices',
  filename: 'invoice-2025.pdf',
  mimeType: 'application/pdf',
  sizeBytes: buffer.length,
  checksum: FileChecksum.fromString(checksum),
  uploadedBy: userId,
});

// Save to database
await fileAttachmentRepo.save(fileAttachment);

// Upload to S3
await s3Storage.upload(
  fileAttachment.s3Key.toString(),
  buffer,
  fileAttachment.mimeType
);

// Publish event for virus scanning
FileUploadedSubscriber.publish(pubsub, {
  fileAttachmentId: fileAttachment.id,
  s3Key: fileAttachment.s3Key.toString(),
  filename: fileAttachment.filename,
  mimeType: fileAttachment.mimeType,
  sizeBytes: fileAttachment.sizeBytes,
  uploadedBy: fileAttachment.uploadedBy,
  uploadedAt: fileAttachment.uploadedAt,
});
```

### Subscribe to Events

```typescript
import { FileUploadedSubscriber } from './infrastructure';
import pubsub from './services/pubsub';

// Initialize and subscribe
const subscriber = new FileUploadedSubscriber(pubsub);
subscriber.subscribe();
```

## Error Handling

All repository and storage operations include comprehensive error handling:

1. **Prisma Errors**: Converted to domain-friendly error messages
   - `P2002`: Unique constraint violation
   - `P2025`: Record not found

2. **S3 Errors**: Proper error messages for all failure scenarios
   - `NoSuchKey`: File not found
   - Network errors, permission errors, etc.

3. **Domain Errors**: Preserved and propagated correctly
   - `ValidationError`: Invalid input
   - `ImmutableEntityError`: Attempt to modify immutable entity
   - `BusinessRuleViolationError`: Business rule violation

## Testing

### Unit Tests

Test repositories with mocked Prisma client:

```typescript
import { PrismaDeliveryNoteRepository } from './repositories';
import { DeliveryNote } from '../domain/delivery/entities/DeliveryNote';

describe('PrismaDeliveryNoteRepository', () => {
  it('should save delivery note', async () => {
    // Mock Prisma
    const mockPrisma = {
      deliveryNote: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };

    // Test repository
    const repo = new PrismaDeliveryNoteRepository();
    await repo.save(deliveryNote);

    expect(mockPrisma.deliveryNote.create).toHaveBeenCalled();
  });
});
```

### Integration Tests

Test against actual database (test container):

```typescript
import { PrismaDeliveryNoteRepository } from './repositories';
import prisma from '../prisma';

beforeAll(async () => {
  // Set up test database
  await prisma.$connect();
});

afterAll(async () => {
  // Clean up
  await prisma.$disconnect();
});

describe('PrismaDeliveryNoteRepository Integration', () => {
  it('should persist and retrieve delivery note', async () => {
    const repo = new PrismaDeliveryNoteRepository();
    await repo.save(deliveryNote);

    const retrieved = await repo.findById(deliveryNote.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(deliveryNote.id);
  });
});
```

## Performance Considerations

### N+1 Query Prevention

All repositories use proper Prisma includes to avoid N+1 queries:

```typescript
// Good: Single query with includes
const deliveryNote = await prisma.deliveryNote.findUnique({
  where: { id },
  include: { items: true }, // ✅ Eager loading
});

// Bad: N+1 queries
const deliveryNote = await prisma.deliveryNote.findUnique({ where: { id } });
const items = await prisma.deliveryNoteItem.findMany({
  where: { deliveryNoteId: id }
}); // ❌ Separate query
```

### Database Indexes

All repositories leverage Prisma schema indexes for optimal query performance:
- Foreign keys are indexed
- Frequently queried fields have indexes
- Composite indexes for common query patterns

### Transaction Support

Use Prisma transactions for operations requiring atomicity:

```typescript
await prisma.$transaction(async (tx) => {
  await tx.fileAttachment.delete({ where: { id } });
  await tx.fileAttachmentLink.deleteMany({ where: { fileAttachmentId: id } });
  await tx.fileVersion.deleteMany({ where: { originalFileId: id } });
});
```

## Security

### SQL Injection Prevention

All queries use Prisma's parameterized queries - no string concatenation.

### File Upload Security

1. **Virus Scanning**: All uploaded files are scanned before allowing access
2. **File Size Limits**: Enforced at domain layer (10MB max)
3. **MIME Type Validation**: Only allowed types can be uploaded
4. **Server-Side Encryption**: All S3 uploads use AES256 encryption
5. **Presigned URLs**: Time-limited access (default 1 hour)

### Access Control

File access should be controlled at the application layer:
- Verify user permissions before generating download URLs
- Log all file access for audit trail
- Implement rate limiting for file operations

## Maintenance

### Adding New Repositories

1. Define interface in domain layer
2. Create Prisma repository implementation
3. Create mapper if needed
4. Add exports to `index.ts`
5. Write unit and integration tests

### Adding S3 Providers

1. Implement `IS3StorageProvider` interface
2. Add provider-specific configuration
3. Export from `storage/index.ts`
4. Document configuration requirements

## Dependencies

- `@prisma/client`: Database ORM
- `@aws-sdk/client-s3`: AWS S3 SDK v3
- `@aws-sdk/s3-request-presigner`: Presigned URL generation

## Future Enhancements

1. **Virus Scanning**: Integrate ClamAV for production use
2. **File Compression**: Compress large files before uploading
3. **CDN Integration**: CloudFront for faster file delivery
4. **Caching Layer**: Redis for frequently accessed metadata
5. **Batch Operations**: Bulk upload/download support
6. **Monitoring**: Metrics for storage usage, scan times, etc.
