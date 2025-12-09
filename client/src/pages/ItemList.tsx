import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { itemService } from '@/services/itemService';
import { vendorService } from '@/services/vendorService';
import type { Item, Vendor, PaginationMeta } from '@/types';
import { Pagination } from '@/components/common/Pagination';
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog';
import { LoadingSpinner, ErrorDisplay } from '@/components/common';
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
    SelectItem as SelectItemUI,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const ITEMS_PER_PAGE = 10;

/**
 * Formats a number as currency (USD)
 */
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};

const ItemList: React.FC = () => {
    // List state
    const [items, setItems] = useState<Item[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create dialog state
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Edit dialog state
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editItemName, setEditItemName] = useState('');
    const [editItemPrice, setEditItemPrice] = useState('');
    const [editVendorId, setEditVendorId] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Delete dialog state
    const [deletingItem, setDeletingItem] = useState<Item | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchItems = useCallback(async (page: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await itemService.getItems(undefined, {
                page,
                limit: ITEMS_PER_PAGE,
            });
            setItems(response.data);
            setPagination(response.pagination);
        } catch (err) {
            console.error('Failed to fetch items', err);
            setError('Failed to load items. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchVendors = useCallback(async () => {
        try {
            const response = await vendorService.getVendors();
            setVendors(response.data);
        } catch (err) {
            console.error('Failed to fetch vendors', err);
        }
    }, []);

    // Initial data fetch
    useEffect(() => {
        fetchItems(currentPage);
        fetchVendors();
    }, [currentPage, fetchItems, fetchVendors]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleCreateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            await itemService.createItem({
                name: newItemName,
                price: parseFloat(newItemPrice),
                vendorId: parseInt(selectedVendorId, 10),
            });
            setNewItemName('');
            setNewItemPrice('');
            setSelectedVendorId('');
            setIsCreateDialogOpen(false);
            // Refresh list from first page to show new item
            setCurrentPage(1);
            fetchItems(1);
        } catch (err) {
            console.error('Failed to create item', err);
            setError('Failed to create item. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const openEditDialog = (item: Item) => {
        setEditingItem(item);
        setEditItemName(item.name);
        setEditItemPrice(String(item.price));
        setEditVendorId(String(item.vendorId));
        setIsEditDialogOpen(true);
    };

    const handleEditItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;

        setIsUpdating(true);
        try {
            await itemService.updateItem(editingItem.id, {
                name: editItemName,
                price: parseFloat(editItemPrice),
                vendorId: parseInt(editVendorId, 10),
            });
            setIsEditDialogOpen(false);
            setEditingItem(null);
            fetchItems(currentPage);
        } catch (err) {
            console.error('Failed to update item', err);
            setError('Failed to update item. Please try again.');
        } finally {
            setIsUpdating(false);
        }
    };

    const openDeleteDialog = (item: Item) => {
        setDeletingItem(item);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteItem = async () => {
        if (!deletingItem) return;

        setIsDeleting(true);
        try {
            await itemService.deleteItem(deletingItem.id);
            setIsDeleteDialogOpen(false);
            setDeletingItem(null);
            // If we deleted the last item on the page, go to previous page
            if (items.length === 1 && currentPage > 1) {
                setCurrentPage(currentPage - 1);
            } else {
                fetchItems(currentPage);
            }
        } catch (err) {
            console.error('Failed to delete item', err);
            setError('Failed to delete item. Please try again.');
            setIsDeleteDialogOpen(false);
        } finally {
            setIsDeleting(false);
        }
    };

    /**
     * Gets the vendor name for an item.
     * First checks if vendor is embedded in item, otherwise looks up from vendors list.
     */
    const getVendorName = (item: Item): string => {
        if (item.vendor?.name) {
            return item.vendor.name;
        }
        const vendor = vendors.find((v) => v.id === item.vendorId);
        return vendor?.name ?? 'Unknown';
    };

    // Render loading state
    if (isLoading && items.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    // Render error state (initial load failed)
    if (error && items.length === 0) {
        return <ErrorDisplay message={error} onRetry={() => fetchItems(currentPage)} />;
    }

    return (
        <div className="space-y-6">
            {/* Error banner for errors when we have existing data */}
            {error && items.length > 0 && (
                <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md">
                    {error}
                    <button
                        onClick={() => setError(null)}
                        className="ml-4 underline hover:no-underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Header with Add button */}
            <div className="flex justify-between items-center">
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>Add Item</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Item</DialogTitle>
                            <DialogDescription>
                                Enter the details of the new item here.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateItem}>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="create-name" className="text-right">
                                        Name
                                    </Label>
                                    <Input
                                        id="create-name"
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        className="col-span-3"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="create-price" className="text-right">
                                        Price
                                    </Label>
                                    <Input
                                        id="create-price"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={newItemPrice}
                                        onChange={(e) => setNewItemPrice(e.target.value)}
                                        className="col-span-3"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="create-vendor" className="text-right">
                                        Vendor
                                    </Label>
                                    <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue placeholder="Select a vendor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vendors.map((vendor) => (
                                                <SelectItemUI key={vendor.id} value={String(vendor.id)}>
                                                    {vendor.name}
                                                </SelectItemUI>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isCreating}>
                                    {isCreating ? 'Saving...' : 'Save'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Items table */}
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="text-right">Price</TableHead>
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
                        ) : items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No items found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <Link
                                            to={`/items/${item.id}`}
                                            className="text-primary hover:underline"
                                        >
                                            {item.id}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <Link
                                            to={`/items/${item.id}`}
                                            className="hover:underline"
                                        >
                                            {item.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{getVendorName(item)}</TableCell>
                                    <TableCell className="text-right">
                                        {formatCurrency(item.price)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openEditDialog(item)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => openDeleteDialog(item)}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <Pagination pagination={pagination} onPageChange={handlePageChange} />
            )}

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Item</DialogTitle>
                        <DialogDescription>
                            Update the item details below.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditItem}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-name" className="text-right">
                                    Name
                                </Label>
                                <Input
                                    id="edit-name"
                                    value={editItemName}
                                    onChange={(e) => setEditItemName(e.target.value)}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-price" className="text-right">
                                    Price
                                </Label>
                                <Input
                                    id="edit-price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editItemPrice}
                                    onChange={(e) => setEditItemPrice(e.target.value)}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-vendor" className="text-right">
                                    Vendor
                                </Label>
                                <Select value={editVendorId} onValueChange={setEditVendorId}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Select a vendor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vendors.map((vendor) => (
                                            <SelectItemUI key={vendor.id} value={String(vendor.id)}>
                                                {vendor.name}
                                            </SelectItemUI>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEditDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isUpdating}>
                                {isUpdating ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title="Delete Item"
                description={`Are you sure you want to delete "${deletingItem?.name}"? This action cannot be undone.`}
                onConfirm={handleDeleteItem}
                isDeleting={isDeleting}
            />
        </div>
    );
};

export default ItemList;
