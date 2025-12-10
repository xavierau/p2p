import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import type { PurchaseOrder, PurchaseOrderStatus, Invoice } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import FileUploadZone from '@/components/file-attachments/FileUploadZone';
import FileList from '@/components/file-attachments/FileList';

/**
 * Returns the appropriate CSS classes for status badge styling.
 */
const getStatusBadgeClasses = (status: PurchaseOrderStatus): string => {
    switch (status) {
        case 'FULFILLED':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case 'SENT':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        case 'DRAFT':
        default:
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    }
};

/**
 * Returns the appropriate CSS classes for invoice status badge styling.
 */
const getInvoiceStatusBadgeClasses = (status: string): string => {
    switch (status) {
        case 'APPROVED':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case 'REJECTED':
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
        case 'PENDING':
        default:
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    }
};

/**
 * Formats a number as currency (USD).
 */
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};

/**
 * Formats a date string to a localized date.
 */
const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

/**
 * Calculates the total amount for a purchase order from its items.
 */
const calculateTotal = (items: { quantity: number; price: number }[]): number => {
    return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
};

const PurchaseOrderDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    /**
     * Fetches the purchase order details from the API.
     */
    const fetchPurchaseOrder = useCallback(async () => {
        if (!id) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await purchaseOrderService.getPurchaseOrderById(Number(id));
            setPurchaseOrder(data);
        } catch (err) {
            console.error('Failed to fetch purchase order', err);
            setError('Failed to load purchase order details. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    // Fetch purchase order on mount and when id changes
    useEffect(() => {
        fetchPurchaseOrder();
    }, [fetchPurchaseOrder]);

    /**
     * Handles status change for the purchase order.
     */
    const handleStatusChange = async (newStatus: PurchaseOrderStatus) => {
        if (!id) return;
        setIsUpdating(true);
        setError(null);
        try {
            await purchaseOrderService.updateStatus(Number(id), newStatus);
            await fetchPurchaseOrder();
        } catch (err) {
            console.error(`Failed to update status to ${newStatus}`, err);
            setError('Failed to update status. Please try again.');
        } finally {
            setIsUpdating(false);
        }
    };

    /**
     * Handles deleting the purchase order.
     */
    const handleDelete = async () => {
        if (!id) return;
        setIsDeleting(true);
        try {
            await purchaseOrderService.deletePurchaseOrder(Number(id));
            navigate('/purchase-orders');
        } catch (err) {
            console.error('Failed to delete purchase order', err);
            setError('Failed to delete purchase order. Please try again.');
            setIsDeleteDialogOpen(false);
        } finally {
            setIsDeleting(false);
        }
    };

    // Calculate total amount from items
    const totalAmount = purchaseOrder?.items
        ? calculateTotal(purchaseOrder.items)
        : 0;

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Loading purchase order details...</div>
            </div>
        );
    }

    // Error state when purchase order not found
    if (!purchaseOrder && !isLoading) {
        return (
            <div className="space-y-6">
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
                    {error || 'Purchase order not found.'}
                </div>
                <Button variant="outline" onClick={() => navigate('/purchase-orders')}>
                    Back to Purchase Orders
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Error Message */}
            {error && (
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
                    {error}
                </div>
            )}

            {/* Purchase Order Summary Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-2xl">
                        Purchase Order #{purchaseOrder?.id}
                    </CardTitle>
                    <span
                        className={cn(
                            'px-3 py-1 rounded-full text-sm font-semibold',
                            getStatusBadgeClasses(purchaseOrder?.status ?? 'DRAFT')
                        )}
                    >
                        {purchaseOrder?.status}
                    </span>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <p className="text-sm text-muted-foreground">Date</p>
                            <p className="text-lg font-medium">
                                {purchaseOrder?.date
                                    ? formatDate(purchaseOrder.date)
                                    : 'N/A'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Vendor</p>
                            {purchaseOrder?.vendor ? (
                                <Link
                                    to={`/vendors/${purchaseOrder.vendorId}`}
                                    className="text-lg font-medium text-primary hover:underline"
                                >
                                    {purchaseOrder.vendor.name}
                                </Link>
                            ) : (
                                <p className="text-lg font-medium">Unknown Vendor</p>
                            )}
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Amount</p>
                            <p className="text-lg font-medium">{formatCurrency(totalAmount)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Items</p>
                            <p className="text-lg font-medium">
                                {purchaseOrder?.items?.length ?? 0} line item(s)
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Line Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Line Items</CardTitle>
                </CardHeader>
                <CardContent>
                    {purchaseOrder?.items && purchaseOrder.items.length > 0 ? (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead className="text-right">Quantity</TableHead>
                                        <TableHead className="text-right">Unit Price</TableHead>
                                        <TableHead className="text-right">Subtotal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {purchaseOrder.items.map((lineItem) => (
                                        <TableRow key={lineItem.id}>
                                            <TableCell>
                                                {lineItem.item ? (
                                                    <Link
                                                        to={`/items/${lineItem.itemId}`}
                                                        className="text-primary hover:underline font-medium"
                                                    >
                                                        {lineItem.item.name}
                                                    </Link>
                                                ) : (
                                                    <span className="font-medium">
                                                        Item #{lineItem.itemId}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {lineItem.quantity}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(lineItem.price)}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(lineItem.quantity * lineItem.price)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {/* Total Row */}
                                    <TableRow className="bg-muted/50">
                                        <TableCell
                                            colSpan={3}
                                            className="text-right font-semibold"
                                        >
                                            Total
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            {formatCurrency(totalAmount)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No line items found for this purchase order.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* File Attachments Section */}
            <Card>
                <CardHeader>
                    <CardTitle>File Attachments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Upload zone */}
                    <FileUploadZone
                        entityType="PURCHASE_ORDER"
                        entityId={purchaseOrder?.id ?? 0}
                        onUploadComplete={fetchPurchaseOrder}
                        onError={(err) => setError(err)}
                    />

                    {/* Attached files list */}
                    <FileList
                        attachments={purchaseOrder?.attachments || []}
                        onDetach={fetchPurchaseOrder}
                        onRefresh={fetchPurchaseOrder}
                    />
                </CardContent>
            </Card>

            {/* Linked Invoices Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Linked Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                    {purchaseOrder?.invoices && purchaseOrder.invoices.length > 0 ? (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice ID</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {purchaseOrder.invoices.map((invoice: Invoice) => (
                                        <TableRow key={invoice.id}>
                                            <TableCell>
                                                <Link
                                                    to={`/invoices/${invoice.id}`}
                                                    className="text-primary hover:underline font-medium"
                                                >
                                                    #{invoice.id}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                {formatDate(invoice.date)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(invoice.totalAmount)}
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    className={cn(
                                                        'px-2 py-1 rounded-full text-xs font-semibold',
                                                        getInvoiceStatusBadgeClasses(invoice.status)
                                                    )}
                                                >
                                                    {invoice.status}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No invoices linked to this purchase order.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Actions Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3">
                        {/* Back Button - Always visible */}
                        <Button
                            variant="outline"
                            onClick={() => navigate('/purchase-orders')}
                        >
                            Back to List
                        </Button>

                        {/* DRAFT Status Actions */}
                        {purchaseOrder?.status === 'DRAFT' && (
                            <>
                                <Link to={`/purchase-orders/${purchaseOrder.id}/edit`}>
                                    <Button variant="outline">Edit</Button>
                                </Link>
                                <Button
                                    variant="outline"
                                    onClick={() => handleStatusChange('SENT')}
                                    disabled={isUpdating}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                    {isUpdating ? 'Sending...' : 'Send'}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsDeleteDialogOpen(true)}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    Delete
                                </Button>
                            </>
                        )}

                        {/* SENT Status Actions */}
                        {purchaseOrder?.status === 'SENT' && (
                            <Button
                                variant="outline"
                                onClick={() => handleStatusChange('FULFILLED')}
                                disabled={isUpdating}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                                {isUpdating ? 'Updating...' : 'Mark Fulfilled'}
                            </Button>
                        )}

                        {/* FULFILLED Status */}
                        {purchaseOrder?.status === 'FULFILLED' && (
                            <span className="text-muted-foreground self-center">
                                This purchase order has been completed.
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Purchase Order</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete Purchase Order #{purchaseOrder?.id}?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PurchaseOrderDetail;
