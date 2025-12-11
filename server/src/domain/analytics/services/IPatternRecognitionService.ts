import { PurchasePattern } from '@prisma/client';

/**
 * Pattern recognition service interface for analyzing purchase patterns
 * and detecting anomalies in ordering behavior
 * ARCHITECTURE: Clean separation of interface from implementation
 */
export interface IPatternRecognitionService {
  /**
   * Analyze purchase pattern for a specific item, optionally filtered by branch
   * @param itemId - Item to analyze
   * @param branchId - Optional branch filter
   * @returns The computed purchase pattern or null if insufficient data
   */
  analyzePurchasePattern(itemId: number, branchId?: number): Promise<PurchasePattern | null>;

  /**
   * Predict the next order date for a specific item
   * @param itemId - Item to predict for
   * @param branchId - Optional branch filter
   * @returns Predicted next order date or null if unable to predict
   */
  predictNextOrder(itemId: number, branchId?: number): Promise<Date | null>;

  /**
   * Detect anomalies in ordering behavior for a specific item
   * @param itemId - Item to check
   * @param branchId - Optional branch filter
   * @returns Array of detected anomalies
   */
  detectAnomalies(itemId: number, branchId?: number): Promise<Anomaly[]>;
}

/**
 * Represents a detected anomaly in ordering behavior
 */
export interface Anomaly {
  /** Invoice ID where anomaly was detected */
  invoiceId: number;
  /** Date of the invoice */
  invoiceDate: Date;
  /** Actual quantity ordered */
  quantity: number;
  /** Actual amount spent */
  amount: number;
  /** Expected quantity based on historical pattern */
  expectedQuantity: number;
  /** Expected amount based on historical pattern */
  expectedAmount: number;
  /** Number of standard deviations from expected quantity */
  quantityDeviation: number;
  /** Number of standard deviations from expected amount */
  amountDeviation: number;
  /** Type of anomaly detected */
  type: AnomalyType;
}

/**
 * Types of anomalies that can be detected
 */
export type AnomalyType = 'QUANTITY_ANOMALY' | 'AMOUNT_ANOMALY' | 'BOTH';
