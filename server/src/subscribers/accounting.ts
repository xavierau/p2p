import pubsub from '../services/pubsub';
import prisma from '../prisma';
import { AccountingService } from '../services/accounting/AccountingService';
import { XeroAdapter } from '../services/accounting/XeroAdapter';
import { logger } from '../utils/logger';

const accountingService = new AccountingService(new XeroAdapter());

export const INVOICE_APPROVED = 'INVOICE_APPROVED';

pubsub.subscribe(INVOICE_APPROVED, async (invoiceId: number) => {
    logger.info({ invoiceId }, 'AccountingSubscriber: Received INVOICE_APPROVED event');

    try {
        // 1. Fetch the full invoice with details
        let invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                items: {
                    include: {
                        item: {
                            include: {
                                vendor: true
                            }
                        }
                    }
                }
            }
        });

        if (!invoice) {
            logger.error({ invoiceId }, 'AccountingSubscriber: Invoice not found');
            return;
        }

        // 2. Check Integration Config
        const config = await prisma.integrationConfig.findUnique({
            where: { key: 'XERO' }
        });

        if (!config || !config.enabled) {
            logger.info({ invoiceId }, 'AccountingSubscriber: Xero integration disabled or not configured, skipping sync');
            return;
        }

        // 3. Trigger Accounting Sync
        try {
            // In a real app, we would pass config.config (credentials) to the service
            const accountingId = await accountingService.createBill(invoice as any);

            await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                    syncStatus: 'SYNCED',
                    accountingId: accountingId,
                    syncError: null
                }
            });
            logger.info({ invoiceId, accountingId }, 'AccountingSubscriber: Invoice synced successfully');
        } catch (syncError: any) {
            logger.error({ err: syncError, invoiceId }, 'AccountingSubscriber: Accounting sync failed');
            await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                    syncStatus: 'FAILED',
                    syncError: syncError.message
                }
            });
        }
    } catch (error) {
        logger.error({ err: error, invoiceId }, 'AccountingSubscriber: Error processing event');
    }
});
