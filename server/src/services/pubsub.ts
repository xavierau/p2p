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
    public static readonly PO_STATUS_CHANGED = 'PO_STATUS_CHANGED';

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
