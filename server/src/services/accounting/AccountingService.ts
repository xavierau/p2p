import { Invoice, InvoiceItem, Item, Vendor } from '@prisma/client';

export type InvoiceWithDetails = Invoice & {
    items: (InvoiceItem & {
        item: Item & {
            vendor: Vendor
        }
    })[];
};

export interface AccountingProvider {
    createBill(invoice: InvoiceWithDetails): Promise<string>; // Returns external ID
}

export class AccountingService {
    private provider: AccountingProvider;

    constructor(provider: AccountingProvider) {
        this.provider = provider;
    }

    async createBill(invoice: InvoiceWithDetails): Promise<string> {
        return this.provider.createBill(invoice);
    }
}
