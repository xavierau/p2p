import { EventEmitter } from 'events';

export class PubSubService extends EventEmitter {
    private static instance: PubSubService;

    private constructor() {
        super();
    }

    public static getInstance(): PubSubService {
        if (!PubSubService.instance) {
            PubSubService.instance = new PubSubService();
        }
        return PubSubService.instance;
    }

    public static readonly INVOICE_APPROVED = 'INVOICE_APPROVED';
    public static readonly INVOICE_CREATED = 'INVOICE_CREATED';
    public static readonly PO_STATUS_CHANGED = 'PO_STATUS_CHANGED';

    // Validation events
    public static readonly INVOICE_VALIDATED = 'INVOICE_VALIDATED';
    public static readonly DUPLICATE_DETECTED = 'DUPLICATE_DETECTED';
    public static readonly SUSPICIOUS_DETECTED = 'SUSPICIOUS_DETECTED';
    public static readonly VALIDATION_OVERRIDDEN = 'VALIDATION_OVERRIDDEN';

    // Delivery Note events
    public static readonly DELIVERY_NOTE_CREATED = 'DELIVERY_NOTE_CREATED';
    public static readonly DELIVERY_NOTE_CONFIRMED = 'DELIVERY_NOTE_CONFIRMED';
    public static readonly DELIVERY_NOTES_LINKED_TO_INVOICE = 'DELIVERY_NOTES_LINKED_TO_INVOICE';

    // File Attachment events
    public static readonly FILE_UPLOADED = 'FILE_UPLOADED';
    public static readonly FILE_ATTACHED = 'FILE_ATTACHED';
    public static readonly FILE_DETACHED = 'FILE_DETACHED';
    public static readonly FILE_REPLACED = 'FILE_REPLACED';
    public static readonly FILE_DELETED = 'FILE_DELETED';

    public publish(event: string, data: unknown): void {
        // Only emit if listeners exist (performance optimization)
        if (this.listenerCount(event) > 0) {
            this.emit(event, data);
        }
    }

    public subscribe(event: string, listener: (data: any) => void): void {
        this.on(event, listener);
    }
}

export default PubSubService.getInstance();
