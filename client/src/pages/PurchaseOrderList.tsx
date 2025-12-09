import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { vendorService } from '@/services/vendorService';
import { itemService } from '@/services/itemService';
import type {
    PurchaseOrder,
    PurchaseOrderStatus,
    PaginationMeta,
    PurchaseOrderItemInput,
    Vendor,
    Item,
} from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { LoadingSpinner, ErrorDisplay } from '@/components/common';

const ITEMS_PER_PAGE = 10;

/**
 * Returns the appropriate CSS classes for status badge styling.
 */
const getStatusColor = (status: PurchaseOrderStatus): string => {
    switch (status) {
        case 'FULFILLED':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case 'SENT':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
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
 * Calculates the total amount for a purchase order from its items.
 */
const calculatePOTotal = (items: { quantity: number; price: number }[]): number => {
    return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
};

const PurchaseOrderList: React.FC = () => {
    // List state
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [allItems, setAllItems] = useState<Item[]>([]);
    const [selectedVendorId, setSelectedVendorId] = useState<string>('');
    const [lineItems, setLineItems] = useState<PurchaseOrderItemInput[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Current line item being added
    const [currentItemId, setCurrentItemId] = useState<string>('');
    const [currentQuantity, setCurrentQuantity] = useState<number>(1);
    const [currentPrice, setCurrentPrice] = useState<number>(0);

    /**
     * Fetches purchase orders with current filters and pagination.
     */
    const fetchPurchaseOrders = useCallback(async (page: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const filters = statusFilter ? { status: statusFilter } : undefined;
            const response = await purchaseOrderService.getPurchaseOrders(filters, {
                page,
                limit: ITEMS_PER_PAGE,
            });
            setPurchaseOrders(response.data);
            setPagination(response.pagination);
        } catch (err) {
            console.error('Failed to fetch purchase orders', err);
            setError('Failed to load purchase orders. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter]);

    /**
     * Fetches vendors for the create dialog.
     */
    const fetchVendors = useCallback(async () => {
        try {
            const response = await vendorService.getVendors();
            setVendors(response.data);
        } catch (err) {
            console.error('Failed to fetch vendors', err);
        }
    }, []);

    /**
     * Fetches all items for the create dialog.
     */
    const fetchItems = useCallback(async () => {
        try {
            const response = await itemService.getItems();
            setAllItems(response.data);
        } catch (err) {
            console.error('Failed to fetch items', err);
        }
    }, []);

    // Fetch purchase orders when page or filter changes
    useEffect(() => {
        fetchPurchaseOrders(currentPage);
    }, [currentPage, fetchPurchaseOrders]);

    // Fetch vendors and items when dialog opens
    useEffect(() => {
        if (isDialogOpen) {
            fetchVendors();
            fetchItems();
        }
    }, [isDialogOpen, fetchVendors, fetchItems]);

    // Filter items by selected vendor
    const availableItems = allItems.filter(
        (item) => String(item.vendorId) === selectedVendorId
    );

    /**
     * Resets the create form to initial state.
     */
    const resetForm = () => {
        setSelectedVendorId('');
        setLineItems([]);
        setCurrentItemId('');
        setCurrentQuantity(1);
        setCurrentPrice(0);
        setFormError(null);
    };

    /**
     * Handles adding a line item to the purchase order.
     */
    const handleAddLineItem = () => {
        if (!currentItemId) return;

        const itemIdNum = parseInt(currentItemId, 10);
        if (isNaN(itemIdNum)) return;

        // Check if item already exists in line items
        if (lineItems.some((li) => li.itemId === itemIdNum)) {
            setFormError('This item has already been added.');
            return;
        }

        setLineItems([
            ...lineItems,
            {
                itemId: itemIdNum,
                quantity: currentQuantity,
                price: currentPrice,
            },
        ]);

        // Reset current item fields
        setCurrentItemId('');
        setCurrentQuantity(1);
        setCurrentPrice(0);
        setFormError(null);
    };

    /**
     * Handles removing a line item from the purchase order.
     */
    const handleRemoveLineItem = (index: number) => {
        const newItems = [...lineItems];
        newItems.splice(index, 1);
        setLineItems(newItems);
    };

    /**
     * Handles item selection change - auto-populates price from item.
     */
    const handleItemChange = (value: string) => {
        setCurrentItemId(value);
        const item = allItems.find((i) => String(i.id) === value);
        if (item) {
            setCurrentPrice(item.price);
        }
    };

    /**
     * Handles vendor selection change - clears line items when vendor changes.
     */
    const handleVendorChange = (value: string) => {
        if (selectedVendorId && value !== selectedVendorId && lineItems.length > 0) {
            // Clear line items when changing vendor
            setLineItems([]);
        }
        setSelectedVendorId(value);
        setCurrentItemId('');
        setCurrentPrice(0);
    };

    /**
     * Handles creating a new purchase order.
     */
    const handleCreatePurchaseOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!selectedVendorId) {
            setFormError('Please select a vendor.');
            return;
        }

        if (lineItems.length === 0) {
            setFormError('Please add at least one item to the purchase order.');
            return;
        }

        const vendorIdNum = parseInt(selectedVendorId, 10);
        if (isNaN(vendorIdNum)) {
            setFormError('Invalid vendor selection.');
            return;
        }

        setIsSubmitting(true);
        try {
            await purchaseOrderService.createPurchaseOrder({
                vendorId: vendorIdNum,
                items: lineItems,
            });
            setIsDialogOpen(false);
            resetForm();
            fetchPurchaseOrders(currentPage);
        } catch (err) {
            console.error('Failed to create purchase order', err);
            setFormError('Failed to create purchase order. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Handles status change for a purchase order.
     */
    const handleStatusChange = async (id: number, newStatus: PurchaseOrderStatus) => {
        try {
            await purchaseOrderService.updateStatus(id, newStatus);
            fetchPurchaseOrders(currentPage);
        } catch (err) {
            console.error(`Failed to update status to ${newStatus}`, err);
            setError(`Failed to update status. Please try again.`);
        }
    };

    /**
     * Handles deleting a purchase order.
     */
    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this purchase order?')) {
            return;
        }

        try {
            await purchaseOrderService.deletePurchaseOrder(id);
            fetchPurchaseOrders(currentPage);
        } catch (err) {
            console.error('Failed to delete purchase order', err);
            setError('Failed to delete purchase order. Please try again.');
        }
    };

    /**
     * Handles status filter change.
     */
    const handleStatusFilterChange = (value: string) => {
        setStatusFilter(value === 'ALL' ? '' : (value as PurchaseOrderStatus));
        setCurrentPage(1); // Reset to first page when filter changes
    };

    /**
     * Handles previous page navigation.
     */
    const handlePreviousPage = () => {
        if (pagination?.hasPrevious) {
            setCurrentPage((prev) => prev - 1);
        }
    };

    /**
     * Handles next page navigation.
     */
    const handleNextPage = () => {
        if (pagination?.hasNext) {
            setCurrentPage((prev) => prev + 1);
        }
    };

    /**
     * Gets the item name by ID from allItems.
     */
    const getItemName = (itemId: number): string => {
        const item = allItems.find((i) => i.id === itemId);
        return item?.name || `Item #${itemId}`;
    };

    /**
     * Calculates the total for current line items.
     */
    const lineItemsTotal = calculatePOTotal(lineItems);

    // Loading state (initial load)
    if (isLoading && purchaseOrders.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    // Error state (initial load failed)
    if (error && purchaseOrders.length === 0) {
        return <ErrorDisplay message={error} onRetry={() => fetchPurchaseOrders(currentPage)} />;
    }

    return (
        <div className="space-y-6">
            {/* Header with filter and create button */}
            <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <Label htmlFor="statusFilter" className="whitespace-nowrap">
                        Filter by Status:
                    </Label>
                    <Select
                        value={statusFilter || 'ALL'}
                        onValueChange={handleStatusFilterChange}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="SENT">Sent</SelectItem>
                            <SelectItem value="FULFILLED">Fulfilled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button>Create Purchase Order</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Create New Purchase Order</DialogTitle>
                            <DialogDescription>
                                Select a vendor and add items to create a new purchase order.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreatePurchaseOrder}>
                            <div className="space-y-6 py-4">
                                {/* Vendor Selection */}
                                <div className="space-y-2">
                                    <Label htmlFor="vendor">Vendor</Label>
                                    <Select
                                        value={selectedVendorId}
                                        onValueChange={handleVendorChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a vendor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vendors.map((vendor) => (
                                                <SelectItem key={vendor.id} value={String(vendor.id)}>
                                                    {vendor.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Add Item Section */}
                                {selectedVendorId && (
                                    <div className="space-y-4">
                                        <Label>Add Items</Label>
                                        <div className="grid grid-cols-12 gap-3 items-end">
                                            <div className="col-span-5 space-y-2">
                                                <Label className="text-sm text-muted-foreground">
                                                    Item
                                                </Label>
                                                <Select
                                                    value={currentItemId}
                                                    onValueChange={handleItemChange}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select item" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {availableItems.length === 0 ? (
                                                            <SelectItem value="" disabled>
                                                                No items for this vendor
                                                            </SelectItem>
                                                        ) : (
                                                            availableItems.map((item) => (
                                                                <SelectItem key={item.id} value={String(item.id)}>
                                                                    {item.name}
                                                                </SelectItem>
                                                            ))
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-2 space-y-2">
                                                <Label className="text-sm text-muted-foreground">
                                                    Qty
                                                </Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={currentQuantity}
                                                    onChange={(e) =>
                                                        setCurrentQuantity(
                                                            parseInt(e.target.value, 10) || 1
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="col-span-3 space-y-2">
                                                <Label className="text-sm text-muted-foreground">
                                                    Price
                                                </Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={currentPrice}
                                                    onChange={(e) =>
                                                        setCurrentPrice(
                                                            parseFloat(e.target.value) || 0
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Button
                                                    type="button"
                                                    onClick={handleAddLineItem}
                                                    disabled={!currentItemId || currentQuantity < 1}
                                                    className="w-full"
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Line Items List */}
                                {lineItems.length > 0 && (
                                    <div className="border rounded-md p-4 space-y-3">
                                        <h4 className="font-semibold">Order Items</h4>
                                        <div className="space-y-2">
                                            {lineItems.map((item, index) => (
                                                <div
                                                    key={index}
                                                    className="flex justify-between items-center text-sm py-2 border-b last:border-b-0"
                                                >
                                                    <span className="font-medium">
                                                        {getItemName(item.itemId)}
                                                    </span>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-muted-foreground">
                                                            {item.quantity} x{' '}
                                                            {formatCurrency(item.price)}
                                                        </span>
                                                        <span className="font-medium">
                                                            {formatCurrency(
                                                                item.quantity * item.price
                                                            )}
                                                        </span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive h-auto p-1"
                                                            onClick={() =>
                                                                handleRemoveLineItem(index)
                                                            }
                                                        >
                                                            Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-between items-center pt-3 border-t font-bold">
                                            <span>Total</span>
                                            <span>{formatCurrency(lineItemsTotal)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Form Error */}
                                {formError && (
                                    <div className="text-sm text-destructive">{formError}</div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || lineItems.length === 0}
                                >
                                    {isSubmitting ? 'Creating...' : 'Create Purchase Order'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
                    {error}
                </div>
            )}

            {/* Purchase Orders Table */}
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-20">ID</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24">
                                    <LoadingSpinner />
                                </TableCell>
                            </TableRow>
                        ) : purchaseOrders.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="text-center h-24 text-muted-foreground"
                                >
                                    No purchase orders found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            purchaseOrders.map((po) => (
                                <TableRow key={po.id}>
                                    <TableCell>
                                        <Link
                                            to={`/purchase-orders/${po.id}`}
                                            className="text-primary hover:underline font-medium"
                                        >
                                            #{po.id}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {po.vendor?.name ?? 'Unknown Vendor'}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(po.date).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={cn(
                                                'px-2 py-1 rounded-full text-xs font-semibold',
                                                getStatusColor(po.status)
                                            )}
                                        >
                                            {po.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatCurrency(calculatePOTotal(po.items ?? []))}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        {po.status === 'DRAFT' && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleStatusChange(po.id, 'SENT')
                                                    }
                                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                >
                                                    Send
                                                </Button>
                                                <Link to={`/purchase-orders/${po.id}/edit`}>
                                                    <Button size="sm" variant="outline">
                                                        Edit
                                                    </Button>
                                                </Link>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDelete(po.id)}
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    Delete
                                                </Button>
                                            </>
                                        )}
                                        {po.status === 'SENT' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    handleStatusChange(po.id, 'FULFILLED')
                                                }
                                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                            >
                                                Mark Fulfilled
                                            </Button>
                                        )}
                                        {po.status === 'FULFILLED' && (
                                            <span className="text-muted-foreground text-sm">
                                                Completed
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {pagination && (
                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages} (
                        {pagination.total} total)
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePreviousPage}
                            disabled={!pagination.hasPrevious}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNextPage}
                            disabled={!pagination.hasNext}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseOrderList;
