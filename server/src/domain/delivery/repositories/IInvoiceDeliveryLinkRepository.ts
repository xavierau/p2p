/**
 * Link between Invoice and DeliveryNote (many-to-many relationship).
 * Represents the domain concept that invoices can reference multiple delivery notes
 * and delivery notes can be referenced by multiple invoices.
 */
export interface InvoiceDeliveryLink {
  invoiceId: string;
  deliveryNoteId: string;
  linkedAt: Date;
}

/**
 * Repository interface for managing invoice-delivery note relationships.
 * Separated from DeliveryNoteRepository to follow Interface Segregation Principle.
 */
export interface IInvoiceDeliveryLinkRepository {
  /**
   * Creates a link between an invoice and a delivery note.
   * @throws Error if link already exists
   */
  link(invoiceId: string, deliveryNoteId: string): Promise<void>;

  /**
   * Removes the link between an invoice and a delivery note.
   * @throws Error if link does not exist
   */
  unlink(invoiceId: string, deliveryNoteId: string): Promise<void>;

  /**
   * Finds all delivery note IDs linked to a specific invoice.
   * @returns Array of delivery note IDs (empty if none found)
   */
  findDeliveryNoteIdsByInvoiceId(invoiceId: string): Promise<string[]>;

  /**
   * Finds all invoice IDs linked to a specific delivery note.
   * @returns Array of invoice IDs (empty if none found)
   */
  findInvoiceIdsByDeliveryNoteId(deliveryNoteId: string): Promise<string[]>;

  /**
   * Checks if a link exists between an invoice and a delivery note.
   * @returns true if link exists, false otherwise
   */
  exists(invoiceId: string, deliveryNoteId: string): Promise<boolean>;

  /**
   * Gets all links for a specific invoice.
   * @returns Array of InvoiceDeliveryLink (empty if none found)
   */
  findLinksByInvoiceId(invoiceId: string): Promise<InvoiceDeliveryLink[]>;

  /**
   * Gets all links for a specific delivery note.
   * @returns Array of InvoiceDeliveryLink (empty if none found)
   */
  findLinksByDeliveryNoteId(deliveryNoteId: string): Promise<InvoiceDeliveryLink[]>;

  /**
   * Removes all links for a specific invoice.
   * Useful when deleting an invoice.
   */
  deleteByInvoiceId(invoiceId: string): Promise<void>;

  /**
   * Removes all links for a specific delivery note.
   * Useful when deleting a delivery note.
   */
  deleteByDeliveryNoteId(deliveryNoteId: string): Promise<void>;
}
