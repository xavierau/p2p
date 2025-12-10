# Domain Layer

This directory contains the **pure domain logic** for the SME Procurement-to-Payment Management system, following **Clean Architecture** and **Domain-Driven Design (DDD)** principles.

## Architecture Principles

### Clean Architecture
- **Framework Independence**: No dependencies on Express, Prisma, or any infrastructure concerns
- **Testability**: Pure business logic that can be tested in isolation
- **Dependency Rule**: Domain layer has zero dependencies on outer layers

### Domain-Driven Design (DDD)
- **Bounded Contexts**: Organized by business domains (Delivery, Files)
- **Entities**: Objects with unique identity (DeliveryNote, FileAttachment)
- **Value Objects**: Immutable objects defined by their values (DeliveryNoteStatus, FileChecksum)
- **Aggregates**: Consistency boundaries (DeliveryNote is an aggregate root)
- **Repository Interfaces**: Abstract persistence contracts
- **Domain Events**: Capture important business occurrences

## Directory Structure

```
domain/
├── shared/                          # Shared domain utilities
│   ├── DomainError.ts              # Base error classes
│   └── index.ts                    # Exports
│
├── delivery/                        # Delivery bounded context
│   ├── entities/                   # Domain entities
│   │   ├── DeliveryNote.ts        # Aggregate root
│   │   └── DeliveryNoteItem.ts    # Entity within aggregate
│   ├── value-objects/              # Immutable value objects
│   │   ├── DeliveryNoteStatus.ts  # Status with transitions
│   │   ├── ItemCondition.ts       # Physical condition
│   │   └── QuantityDiscrepancy.ts # Quantity tracking
│   ├── repositories/               # Persistence contracts
│   │   ├── IDeliveryNoteRepository.ts
│   │   └── IInvoiceDeliveryLinkRepository.ts
│   ├── events/                     # Domain events
│   │   ├── DeliveryNoteCreatedEvent.ts
│   │   └── DeliveryNoteConfirmedEvent.ts
│   └── index.ts                    # Bounded context exports
│
├── files/                           # Files bounded context
│   ├── entities/
│   │   ├── FileAttachment.ts       # Aggregate root
│   │   └── FileVersion.ts          # Historical versions
│   ├── value-objects/
│   │   ├── S3ObjectKey.ts          # S3 storage key
│   │   ├── FileChecksum.ts         # SHA-256 integrity
│   │   ├── VirusScanStatus.ts      # Scan state
│   │   └── FileMetadata.ts         # File properties
│   ├── repositories/
│   │   ├── IFileAttachmentRepository.ts
│   │   ├── IFileAttachmentLinkRepository.ts
│   │   └── IFileVersionRepository.ts
│   ├── events/
│   │   ├── FileUploadedEvent.ts
│   │   ├── FileScanCompleteEvent.ts
│   │   └── FileReplacedEvent.ts
│   └── index.ts
│
└── index.ts                         # Root domain exports
```

## Key Concepts

### Entities vs Value Objects

**Entities** have:
- Unique identity (ID)
- Mutable state (within business rules)
- Lifecycle
- Examples: `DeliveryNote`, `FileAttachment`

**Value Objects** have:
- No identity (defined by values)
- Immutable
- Replaceable
- Examples: `DeliveryNoteStatus`, `FileChecksum`

### Aggregate Roots

Aggregates enforce consistency boundaries:

- **DeliveryNote Aggregate**
  - Root: `DeliveryNote`
  - Child: `DeliveryNoteItem`
  - Rule: Items can only be modified through DeliveryNote
  - Rule: Must have at least one item
  - Rule: Immutable when CONFIRMED

- **FileAttachment Aggregate**
  - Root: `FileAttachment`
  - Related: `FileVersion` (separate entity, not child)
  - Rule: Max 10MB file size
  - Rule: Immutable after creation (except virus scan status)

### Business Rules Examples

**DeliveryNote**:
```typescript
// ✅ Valid - Creating with items
const deliveryNote = DeliveryNote.create({
  id: '123',
  items: [item1, item2],
  // ... other props
});

// ❌ Invalid - No items
const deliveryNote = DeliveryNote.create({
  id: '123',
  items: [],
  // ... throws BusinessRuleViolationError
});

// ❌ Invalid - Modifying when confirmed
deliveryNote.confirm();
deliveryNote.updateItem(item); // throws ImmutableEntityError
```

**FileAttachment**:
```typescript
// ✅ Valid - Within size limit
const file = FileAttachment.create({
  filename: 'invoice.pdf',
  sizeBytes: 5 * 1024 * 1024, // 5MB
  // ...
});

// ❌ Invalid - Exceeds 10MB limit
const file = FileAttachment.create({
  filename: 'large.pdf',
  sizeBytes: 15 * 1024 * 1024, // throws ValidationError
});
```

### State Transitions

**DeliveryNoteStatus**:
```
DRAFT ──→ CONFIRMED (terminal)
```

**VirusScanStatus**:
```
PENDING ──→ CLEAN (terminal)
        └──→ INFECTED (terminal)
```

## Usage Examples

### Creating a Delivery Note

```typescript
import {
  DeliveryNote,
  DeliveryNoteItem,
  ItemCondition,
  DeliveryNoteCreatedEvent,
} from '@/domain/delivery';

// Create items
const item = DeliveryNoteItem.create({
  id: 'item-1',
  deliveryNoteId: 'dn-1',
  purchaseOrderItemId: 'po-item-1',
  itemId: 'item-123',
  quantityDelivered: 100,
  orderedQuantity: 100,
  condition: ItemCondition.createGood(),
});

// Create delivery note
const deliveryNote = DeliveryNote.create({
  id: 'dn-1',
  deliveryNoteNumber: 'DN-2024-001',
  purchaseOrderId: 'po-1',
  vendorId: 'vendor-1',
  receivedBy: 'user-1',
  deliveryDate: new Date(),
  items: [item],
});

// Confirm delivery note (state transition)
deliveryNote.confirm();

// Emit domain event
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
```

### Creating a File Attachment

```typescript
import {
  FileAttachment,
  FileChecksum,
  FileUploadedEvent,
} from '@/domain/files';

// Create file attachment
const fileAttachment = FileAttachment.create({
  id: 'file-1',
  prefix: 'invoices',
  filename: 'invoice-2024-001.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024 * 1024, // 1MB
  checksum: FileChecksum.fromString('abc123...'),
  uploadedBy: 'user-1',
});

// File starts in PENDING scan status
console.log(fileAttachment.virusScanStatus.isPending()); // true

// Later, when scan completes
fileAttachment.markScanComplete('CLEAN');
console.log(fileAttachment.isReady()); // true
```

### Working with Value Objects

```typescript
import { QuantityDiscrepancy } from '@/domain/delivery';

// Create discrepancy
const discrepancy = QuantityDiscrepancy.create(100, 95);

// Check for issues
if (discrepancy.hasDiscrepancy()) {
  console.log(discrepancy.getDescription());
  // Output: "5 units under-delivered (5.00%)"
}

// Validate threshold
if (!discrepancy.isWithinThreshold(10)) {
  // Trigger alert - discrepancy exceeds 10%
}
```

## Repository Pattern

Repository interfaces define contracts for persistence:

```typescript
import { IDeliveryNoteRepository } from '@/domain/delivery';

// Infrastructure layer implements this interface
class PrismaDeliveryNoteRepository implements IDeliveryNoteRepository {
  async save(deliveryNote: DeliveryNote): Promise<void> {
    // Convert domain entity to Prisma model
    // Save to database
  }

  async findById(id: string): Promise<DeliveryNote | null> {
    // Load from database
    // Convert Prisma model to domain entity
  }
}
```

## Domain Events

Events capture important business occurrences:

```typescript
import { DeliveryNoteConfirmedEvent } from '@/domain/delivery';
import { pubsub } from '@/services/pubsub';

// In application service
const event = new DeliveryNoteConfirmedEvent(
  deliveryNote.id,
  deliveryNote.deliveryNoteNumber,
  deliveryNote.purchaseOrderId,
  deliveryNote.vendorId,
  deliveryNote.getTotalQuantityDelivered(),
  deliveryNote.getTotalEffectiveQuantity(),
  deliveryNote.hasAnyIssues(),
  userId,
  new Date()
);

// Publish event
pubsub.publish('delivery_note.confirmed', event.toJSON());
```

## Error Handling

Domain layer throws specific errors:

```typescript
import {
  ValidationError,
  BusinessRuleViolationError,
  ImmutableEntityError,
  InvalidStateTransitionError,
} from '@/domain/shared';

try {
  deliveryNote.confirm();
  deliveryNote.updateItem(item); // throws ImmutableEntityError
} catch (error) {
  if (error instanceof ImmutableEntityError) {
    // Handle immutability violation
  }
}
```

## Testing Domain Logic

Domain entities are framework-independent and easy to test:

```typescript
import { DeliveryNote, DeliveryNoteItem } from '@/domain/delivery';

describe('DeliveryNote', () => {
  it('should require at least one item', () => {
    expect(() => {
      DeliveryNote.create({
        id: '1',
        items: [],
        // ...
      });
    }).toThrow(BusinessRuleViolationError);
  });

  it('should be immutable when confirmed', () => {
    const deliveryNote = DeliveryNote.create({ /* ... */ });
    deliveryNote.confirm();

    expect(() => {
      deliveryNote.updateItem(item);
    }).toThrow(ImmutableEntityError);
  });
});
```

## Best Practices

1. **Never import from outer layers** - Domain layer should have zero dependencies on infrastructure
2. **Use factory methods** - All entities have `static create()` methods
3. **Validate in constructors** - Ensure invariants are always satisfied
4. **Freeze value objects** - Use `Object.freeze()` for immutability
5. **Throw domain errors** - Use specific error classes, not generic `Error`
6. **Document business rules** - Comments should explain WHY, not WHAT
7. **Keep aggregates small** - Only include what needs to be consistent together
8. **Use domain events** - Communicate between bounded contexts via events

## Integration with Application Layer

The application layer (services) orchestrates domain objects:

```typescript
// In application service
class DeliveryNoteService {
  constructor(
    private deliveryNoteRepo: IDeliveryNoteRepository,
    private pubsub: PubSub
  ) {}

  async createDeliveryNote(dto: CreateDeliveryNoteDTO): Promise<string> {
    // 1. Create domain entity
    const deliveryNote = DeliveryNote.create({
      id: generateId(),
      items: dto.items.map(itemDto => DeliveryNoteItem.create({
        // Map DTO to domain entity
      })),
      // ...
    });

    // 2. Persist via repository
    await this.deliveryNoteRepo.save(deliveryNote);

    // 3. Publish domain event
    const event = new DeliveryNoteCreatedEvent(/* ... */);
    this.pubsub.publish(event.eventName, event.toJSON());

    // 4. Return ID
    return deliveryNote.id;
  }
}
```

## Migration from Existing Code

When migrating existing services to use the domain layer:

1. **Identify business logic** - Extract from services into domain entities
2. **Create value objects** - Replace primitive obsession with value objects
3. **Define aggregates** - Identify consistency boundaries
4. **Move validation** - From Zod schemas to domain entity constructors
5. **Extract repository** - Define interface in domain, implement in infrastructure

## Further Reading

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Implementing Domain-Driven Design by Vaughn Vernon](https://vaughnvernon.com/)
