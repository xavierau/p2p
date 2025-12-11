import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { invoiceService } from '@/services/invoiceService';
import { validationService } from '@/services/validationService';
import type { Invoice, InvoiceStatus, InvoiceValidationSummary } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LoadingSpinner, ErrorDisplay } from '@/components/common';
import { AlertCircle, AlertTriangle } from 'lucide-react';

/**
 * Extended invoice type with validation summary
 */
interface InvoiceWithValidation extends Invoice {
    validationSummary?: InvoiceValidationSummary;
}

/**
 * Validation badge component to show validation issues
 */
interface ValidationBadgeProps {
    validationSummary?: InvoiceValidationSummary;
}

const ValidationBadge: React.FC<ValidationBadgeProps> = ({ validationSummary }) => {
    if (!validationSummary || validationSummary.flagCount === 0) {
        return null;
    }

    const { flagCount, hasBlockingIssues } = validationSummary;

    if (hasBlockingIssues) {
        return (
            <Badge variant="error" className="ml-2" title="Critical validation issues">
                <AlertCircle className="h-3 w-3 mr-1" />
                {flagCount}
            </Badge>
        );
    }

    return (
        <Badge variant="warning" className="ml-2" title="Validation warnings">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {flagCount}
        </Badge>
    );
};

const InvoiceList: React.FC = () => {
    const [invoices, setInvoices] = useState<InvoiceWithValidation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await invoiceService.getInvoices();

            // Fetch validation summaries for all invoices in parallel
            const invoicesWithValidations = await Promise.all(
                response.data.map(async (invoice) => {
                    try {
                        const validationSummary = await validationService.getValidationSummary(invoice.id);
                        return { ...invoice, validationSummary };
                    } catch {
                        // If validation fetch fails, just return invoice without validation
                        return invoice;
                    }
                })
            );

            setInvoices(invoicesWithValidations);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load invoices';
            setError(message);
            console.error('Failed to fetch invoices', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    const handleStatusChange = async (id: number, status: 'approve' | 'reject') => {
        try {
            await invoiceService.updateInvoiceStatus(id, status);
            fetchInvoices();
        } catch (error) {
            console.error(`Failed to ${status} invoice`, error);
        }
    };

    const getStatusColor = (status: InvoiceStatus) => {
        switch (status) {
            case 'APPROVED':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'REJECTED':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            default:
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
        }
    };

    // Loading state
    if (isLoading && invoices.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    // Error state
    if (error && invoices.length === 0) {
        return <ErrorDisplay message={error} onRetry={fetchInvoices} />;
    }

    return (
        <div className="space-y-6">
            {/* Error banner for fetch errors when we have existing data */}
            {error && invoices.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded-md">
                    {error}
                </div>
            )}
            <div className="flex justify-between items-center">
                <div/>
                <Link to="/invoices/new">
                    <Button>Create Invoice</Button>
                </Link>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24">
                                    <LoadingSpinner />
                                </TableCell>
                            </TableRow>
                        ) : invoices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No invoices found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            invoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                                <TableCell>
                                    <div className="flex items-center">
                                        <Link to={`/invoices/${invoice.id}`} className="text-primary hover:underline">
                                            {invoice.id}
                                        </Link>
                                        <ValidationBadge validationSummary={invoice.validationSummary} />
                                    </div>
                                </TableCell>
                                <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                                <TableCell>${invoice.totalAmount.toFixed(2)}</TableCell>
                                <TableCell>
                                    <span className={cn("px-2 py-1 rounded-full text-xs font-semibold", getStatusColor(invoice.status))}>
                                        {invoice.status}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    {invoice.status === 'PENDING' && (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleStatusChange(invoice.id, 'approve')}
                                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                disabled={invoice.validationSummary?.hasBlockingIssues}
                                                title={invoice.validationSummary?.hasBlockingIssues ? 'Cannot approve invoice with critical validation issues' : 'Approve invoice'}
                                            >
                                                Approve
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleStatusChange(invoice.id, 'reject')} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                                Reject
                                            </Button>
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default InvoiceList;