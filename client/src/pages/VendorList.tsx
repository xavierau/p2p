import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { vendorService } from '@/services/vendorService';
import type { Vendor, PaginationMeta } from '@/types';
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
import { Pagination } from '@/components/common/Pagination';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog';

const ITEMS_PER_PAGE = 10;

const VendorList: React.FC = () => {
    // List state
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create dialog state
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newVendorName, setNewVendorName] = useState('');
    const [newVendorContact, setNewVendorContact] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Edit dialog state
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editName, setEditName] = useState('');
    const [editContact, setEditContact] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Delete dialog state
    const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const fetchVendors = useCallback(async (page: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await vendorService.getVendors(undefined, {
                page,
                limit: ITEMS_PER_PAGE,
            });
            setVendors(response.data);
            setPagination(response.pagination);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch vendors';
            setError(message);
            console.error('Failed to fetch vendors', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch vendors when page changes
    useEffect(() => {
        fetchVendors(currentPage);
    }, [currentPage, fetchVendors]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleCreateVendor = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        setCreateError(null);
        try {
            await vendorService.createVendor({
                name: newVendorName,
                contact: newVendorContact || null,
            });
            setNewVendorName('');
            setNewVendorContact('');
            setIsCreateDialogOpen(false);
            // Reset to first page to show the new vendor
            setCurrentPage(1);
            fetchVendors(1);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create vendor';
            setCreateError(message);
            console.error('Failed to create vendor', err);
        } finally {
            setIsCreating(false);
        }
    };

    const handleOpenEditDialog = (vendor: Vendor) => {
        setEditingVendor(vendor);
        setEditName(vendor.name);
        setEditContact(vendor.contact || '');
        setEditError(null);
        setIsEditDialogOpen(true);
    };

    const handleCloseEditDialog = () => {
        setIsEditDialogOpen(false);
        setEditingVendor(null);
        setEditName('');
        setEditContact('');
        setEditError(null);
    };

    const handleEditVendor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVendor) return;

        setIsEditing(true);
        setEditError(null);
        try {
            await vendorService.updateVendor(editingVendor.id, {
                name: editName,
                contact: editContact || null,
            });
            handleCloseEditDialog();
            fetchVendors(currentPage);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update vendor';
            setEditError(message);
            console.error('Failed to update vendor', err);
        } finally {
            setIsEditing(false);
        }
    };

    const handleOpenDeleteDialog = (vendor: Vendor) => {
        setDeletingVendor(vendor);
        setDeleteError(null);
        setIsDeleteDialogOpen(true);
    };

    const handleCloseDeleteDialog = () => {
        setIsDeleteDialogOpen(false);
        setDeletingVendor(null);
        setDeleteError(null);
    };

    const handleDeleteVendor = async () => {
        if (!deletingVendor) return;

        setIsDeleting(true);
        setDeleteError(null);
        try {
            await vendorService.deleteVendor(deletingVendor.id);
            handleCloseDeleteDialog();
            // If we deleted the last item on the page, go to previous page
            if (vendors.length === 1 && currentPage > 1) {
                setCurrentPage(currentPage - 1);
            } else {
                fetchVendors(currentPage);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to delete vendor';
            setDeleteError(message);
            console.error('Failed to delete vendor', err);
        } finally {
            setIsDeleting(false);
        }
    };

    // Render loading state
    if (isLoading && vendors.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    // Render error state
    if (error && vendors.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-destructive">{error}</p>
                <Button onClick={() => fetchVendors(currentPage)}>Try Again</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Create Button */}
            <div className="flex justify-between items-center">
                <div />
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>Add Vendor</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Vendor</DialogTitle>
                            <DialogDescription>
                                Enter the details of the new vendor here.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateVendor}>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="create-name" className="text-right">
                                        Name
                                    </Label>
                                    <Input
                                        id="create-name"
                                        value={newVendorName}
                                        onChange={(e) => setNewVendorName(e.target.value)}
                                        className="col-span-3"
                                        required
                                        disabled={isCreating}
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="create-contact" className="text-right">
                                        Contact
                                    </Label>
                                    <Input
                                        id="create-contact"
                                        value={newVendorContact}
                                        onChange={(e) => setNewVendorContact(e.target.value)}
                                        className="col-span-3"
                                        disabled={isCreating}
                                    />
                                </div>
                                {createError && (
                                    <p className="text-sm text-destructive col-span-4 text-center">
                                        {createError}
                                    </p>
                                )}
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isCreating}>
                                    {isCreating ? (
                                        <span className="flex items-center gap-2">
                                            <LoadingSpinner size="sm" />
                                            Saving...
                                        </span>
                                    ) : (
                                        'Save changes'
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Error banner for fetch errors when we have existing data */}
            {error && vendors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded-md">
                    {error}
                </div>
            )}

            {/* Delete error banner */}
            {deleteError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded-md">
                    {deleteError}
                </div>
            )}

            {/* Table */}
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead className="w-[150px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24">
                                    <LoadingSpinner />
                                </TableCell>
                            </TableRow>
                        ) : vendors.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                    No vendors found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            vendors.map((vendor) => (
                                <TableRow key={vendor.id}>
                                    <TableCell>
                                        <Link
                                            to={`/vendors/${vendor.id}`}
                                            className="text-primary hover:underline"
                                        >
                                            {vendor.id}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <Link
                                            to={`/vendors/${vendor.id}`}
                                            className="hover:underline"
                                        >
                                            {vendor.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{vendor.contact || '-'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleOpenEditDialog(vendor)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleOpenDeleteDialog(vendor)}
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
            <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && handleCloseEditDialog()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Vendor</DialogTitle>
                        <DialogDescription>
                            Update the vendor details below.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditVendor}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-name" className="text-right">
                                    Name
                                </Label>
                                <Input
                                    id="edit-name"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="col-span-3"
                                    required
                                    disabled={isEditing}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-contact" className="text-right">
                                    Contact
                                </Label>
                                <Input
                                    id="edit-contact"
                                    value={editContact}
                                    onChange={(e) => setEditContact(e.target.value)}
                                    className="col-span-3"
                                    disabled={isEditing}
                                />
                            </div>
                            {editError && (
                                <p className="text-sm text-destructive col-span-4 text-center">
                                    {editError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseEditDialog}
                                disabled={isEditing}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isEditing}>
                                {isEditing ? (
                                    <span className="flex items-center gap-2">
                                        <LoadingSpinner size="sm" />
                                        Saving...
                                    </span>
                                ) : (
                                    'Save changes'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmDialog
                open={isDeleteDialogOpen}
                onOpenChange={(open) => !open && handleCloseDeleteDialog()}
                title="Delete Vendor"
                description={`Are you sure you want to delete "${deletingVendor?.name}"? This action cannot be undone.`}
                onConfirm={handleDeleteVendor}
                isDeleting={isDeleting}
            />
        </div>
    );
};

export default VendorList;
