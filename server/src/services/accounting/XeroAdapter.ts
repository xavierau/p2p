import { AccountingProvider, InvoiceWithDetails } from './AccountingService';

export class XeroAdapter implements AccountingProvider {
    async createBill(invoice: InvoiceWithDetails): Promise<string> {
        console.log(`[XeroAdapter] Creating bill for Invoice #${invoice.id}`);

        if (invoice.items.length > 0) {
            console.log(`[XeroAdapter] Vendor: ${invoice.items[0]?.item.vendor.name}`);
        }

        console.log(`[XeroAdapter] Total Amount: ${invoice.totalAmount}`);

        // Simulate API latency
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Return a mock Xero ID
        const mockXeroId = `XERO-${Date.now()}-${invoice.id}`;
        console.log(`[XeroAdapter] Bill created successfully. ID: ${mockXeroId}`);

        return mockXeroId;
    }
}
