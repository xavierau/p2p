import { DeliveryNote } from '../entities/DeliveryNote';
import { DeliveryNoteStatus } from '../value-objects/DeliveryNoteStatus';

/**
 * Repository interface for DeliveryNote aggregate.
 * Defines contract for persistence operations without coupling to implementation details.
 * Infrastructure layer will provide concrete implementation (e.g., PrismaDeliveryNoteRepository).
 */
export interface IDeliveryNoteRepository {
  /**
   * Persists a new delivery note.
   * @throws Error if delivery note with same ID already exists
   */
  save(deliveryNote: DeliveryNote): Promise<void>;

  /**
   * Updates an existing delivery note.
   * @throws Error if delivery note not found
   */
  update(deliveryNote: DeliveryNote): Promise<void>;

  /**
   * Finds a delivery note by its ID.
   * @returns DeliveryNote if found, null otherwise
   */
  findById(id: string): Promise<DeliveryNote | null>;

  /**
   * Finds a delivery note by its unique delivery note number.
   * @returns DeliveryNote if found, null otherwise
   */
  findByDeliveryNoteNumber(deliveryNoteNumber: string): Promise<DeliveryNote | null>;

  /**
   * Finds all delivery notes for a specific purchase order.
   * @returns Array of delivery notes (empty if none found)
   */
  findByPurchaseOrderId(purchaseOrderId: string): Promise<DeliveryNote[]>;

  /**
   * Finds all delivery notes for a specific vendor.
   * @returns Array of delivery notes (empty if none found)
   */
  findByVendorId(vendorId: string): Promise<DeliveryNote[]>;

  /**
   * Finds all delivery notes with a specific status.
   * @returns Array of delivery notes (empty if none found)
   */
  findByStatus(status: DeliveryNoteStatus): Promise<DeliveryNote[]>;

  /**
   * Finds delivery notes within a date range.
   * @returns Array of delivery notes (empty if none found)
   */
  findByDateRange(startDate: Date, endDate: Date): Promise<DeliveryNote[]>;

  /**
   * Finds delivery notes with issues (damaged, partial, rejected items, or quantity discrepancies).
   * @returns Array of delivery notes with issues (empty if none found)
   */
  findWithIssues(): Promise<DeliveryNote[]>;

  /**
   * Checks if a delivery note number is already in use.
   * @returns true if the number exists, false otherwise
   */
  existsByDeliveryNoteNumber(deliveryNoteNumber: string): Promise<boolean>;

  /**
   * Deletes a delivery note by ID.
   * Should only be allowed for DRAFT status in most business scenarios.
   * @throws Error if delivery note not found
   */
  delete(id: string): Promise<void>;
}
