import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { vendorService } from '@/services/vendorService';
import { itemService } from '@/services/itemService';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import type { Vendor, Item, PurchaseOrder, UpdateVendorInput } from '@/types';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const VendorDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Core data state
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editContact, setEditContact] = useState('');

  const fetchVendorData = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const vendorData = await vendorService.getVendorById(Number(id));
      setVendor(vendorData);

      // Fetch related items and purchase orders in parallel
      const [itemsResponse, posResponse] = await Promise.all([
        itemService.getItems({ vendorId: Number(id) }),
        purchaseOrderService.getPurchaseOrders({ vendorId: Number(id) }),
      ]);

      setItems(itemsResponse.data);
      setPurchaseOrders(posResponse.data);
    } catch (err) {
      setError('Failed to load vendor details');
      console.error('Error fetching vendor data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Fetch data on mount and when id changes
  useEffect(() => {
    fetchVendorData();
  }, [fetchVendorData]);

  // Initialize edit form when vendor data is loaded or dialog opens
  useEffect(() => {
    if (vendor && isEditDialogOpen) {
      setEditName(vendor.name);
      setEditContact(vendor.contact || '');
    }
  }, [vendor, isEditDialogOpen]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id || !editName.trim()) return;

    setIsSaving(true);

    try {
      const updateData: UpdateVendorInput = {
        name: editName.trim(),
        contact: editContact.trim() || null,
      };

      const updatedVendor = await vendorService.updateVendor(Number(id), updateData);
      setVendor(updatedVendor);
      setIsEditDialogOpen(false);
    } catch (err) {
      console.error('Failed to update vendor:', err);
      setError('Failed to update vendor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setIsDeleting(true);

    try {
      await vendorService.deleteVendor(Number(id));
      navigate('/vendors');
    } catch (err) {
      console.error('Failed to delete vendor:', err);
      setError('Failed to delete vendor');
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading vendor details...</div>
      </div>
    );
  }

  // Error state
  if (error && !vendor) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link to="/vendors">Back to Vendors</Link>
        </Button>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">{error}</div>
        </div>
      </div>
    );
  }

  // Vendor not found
  if (!vendor) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link to="/vendors">Back to Vendors</Link>
        </Button>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Vendor not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Button variant="outline" asChild>
          <Link to="/vendors">Back to Vendors</Link>
        </Button>
      </div>

      {/* Error banner for non-critical errors */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">
          {error}
        </div>
      )}

      {/* Vendor Information Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Vendor Information</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Name</dt>
              <dd className="mt-1 text-lg">{vendor.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Contact</dt>
              <dd className="mt-1 text-lg">{vendor.contact || '-'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items from this Vendor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.item_code || '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                      No items found for this vendor.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell>{po.id}</TableCell>
                    <TableCell>{formatDate(po.date)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          po.status === 'FULFILLED'
                            ? 'bg-green-100 text-green-800'
                            : po.status === 'SENT'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {po.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {purchaseOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                      No purchase orders found for this vendor.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
            <DialogDescription>
              Update the vendor details below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
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
                  disabled={isSaving}
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
                  disabled={isSaving}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Vendor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this vendor? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
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

export default VendorDetail;
