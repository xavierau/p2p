import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import DeliveryNoteItemsTable from './DeliveryNoteItemsTable';
import { deliveryNoteService } from '@/services/deliveryNoteService';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import type {
  DeliveryNote,
  DeliveryNoteItem,
  PurchaseOrder,
  CreateDeliveryNoteInput,
  ItemCondition,
} from '@/types';
import { cn } from '@/lib/utils';

interface DeliveryNoteFormProps {
  deliveryNote?: DeliveryNote;
  onSuccess?: (deliveryNote: DeliveryNote) => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * Form component for creating/editing delivery notes.
 * Loads PO items and allows quantity/condition tracking.
 */
const DeliveryNoteForm: React.FC<DeliveryNoteFormProps> = ({
  deliveryNote,
  onSuccess,
  onCancel,
  className,
}) => {
  const navigate = useNavigate();
  const isEditing = !!deliveryNote;

  // Form state
  const [purchaseOrderId, setPurchaseOrderId] = useState<number | null>(
    deliveryNote?.purchaseOrderId || null
  );
  const [deliveryDate, setDeliveryDate] = useState<string>(
    deliveryNote?.deliveryDate
      ? new Date(deliveryNote.deliveryDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [receivedBy, setReceivedBy] = useState<string>(
    deliveryNote?.receivedBy || ''
  );
  const [notes, setNotes] = useState<string>(deliveryNote?.notes || '');
  const [items, setItems] = useState<DeliveryNoteItem[]>(deliveryNote?.items || []);

  // UI state
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isLoadingPOs, setIsLoadingPOs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load purchase orders on mount
  useEffect(() => {
    const loadPurchaseOrders = async () => {
      setIsLoadingPOs(true);
      try {
        // Fetch POs with SENT or FULFILLED status
        const response = await purchaseOrderService.getPurchaseOrders(
          { status: 'SENT' },
          { page: 1, limit: 100 }
        );
        setPurchaseOrders(response.data);

        // If editing, load the specific PO
        if (isEditing && deliveryNote.purchaseOrder) {
          setSelectedPO(deliveryNote.purchaseOrder);
        }
      } catch (err) {
        console.error('Failed to load purchase orders:', err);
        setError('Failed to load purchase orders');
      } finally {
        setIsLoadingPOs(false);
      }
    };

    loadPurchaseOrders();
  }, [isEditing, deliveryNote]);

  // Load PO items when PO is selected
  const handlePOSelection = async (poId: string) => {
    const id = parseInt(poId, 10);
    setPurchaseOrderId(id);
    setError(null);

    try {
      const po = await purchaseOrderService.getPurchaseOrderById(id);
      setSelectedPO(po);

      // Initialize delivery note items from PO items
      const deliveryItems: DeliveryNoteItem[] =
        po.items?.map((poItem) => ({
          id: 0, // Will be set by backend
          deliveryNoteId: 0,
          itemId: poItem.itemId,
          quantityOrdered: poItem.quantity,
          quantityDelivered: poItem.quantity, // Default to full quantity
          condition: 'GOOD' as ItemCondition,
          discrepancyReason: null,
          item: poItem.item,
        })) || [];

      setItems(deliveryItems);
    } catch (err) {
      console.error('Failed to load purchase order:', err);
      setError('Failed to load purchase order details');
    }
  };

  // Handle item field changes
  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prevItems) => {
      const updated = [...prevItems];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!purchaseOrderId) {
      setError('Please select a purchase order');
      return false;
    }

    if (!receivedBy.trim()) {
      setError('Please enter who received the delivery');
      return false;
    }

    if (!deliveryDate) {
      setError('Please select a delivery date');
      return false;
    }

    if (items.length === 0) {
      setError('No items to deliver');
      return false;
    }

    // Check if items with discrepancies have reasons
    const hasInvalidDiscrepancies = items.some(
      (item) =>
        item.quantityDelivered !== item.quantityOrdered &&
        !item.discrepancyReason?.trim()
    );

    if (hasInvalidDiscrepancies) {
      setError('Please provide reasons for all quantity discrepancies');
      return false;
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const input: CreateDeliveryNoteInput = {
        purchaseOrderId: purchaseOrderId!,
        deliveryDate,
        receivedBy,
        notes: notes.trim() || null,
        items: items.map((item) => ({
          itemId: item.itemId,
          quantityOrdered: item.quantityOrdered,
          quantityDelivered: item.quantityDelivered,
          condition: item.condition,
          discrepancyReason:
            item.quantityDelivered !== item.quantityOrdered
              ? item.discrepancyReason
              : null,
        })),
      };

      let result: DeliveryNote;
      if (isEditing) {
        result = await deliveryNoteService.updateDeliveryNote(
          deliveryNote.id,
          input
        );
      } else {
        result = await deliveryNoteService.createDeliveryNote(input);
      }

      onSuccess?.(result);
      navigate(`/delivery-notes/${result.id}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : `Failed to ${isEditing ? 'update' : 'create'} delivery note`;
      setError(errorMessage);
      console.error('Form submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/delivery-notes');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Purchase Order Selection */}
          <div className="space-y-2">
            <Label htmlFor="purchaseOrder">Purchase Order *</Label>
            <Select
              value={purchaseOrderId?.toString() || ''}
              onValueChange={handlePOSelection}
              disabled={isEditing || isLoadingPOs}
            >
              <SelectTrigger id="purchaseOrder">
                <SelectValue placeholder="Select a purchase order" />
              </SelectTrigger>
              <SelectContent>
                {purchaseOrders.map((po) => (
                  <SelectItem key={po.id} value={po.id.toString()}>
                    PO #{po.id} - {po.vendor?.name} - {po.items?.length || 0}{' '}
                    items
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEditing && (
              <p className="text-xs text-muted-foreground">
                Purchase order cannot be changed after creation
              </p>
            )}
          </div>

          {/* Delivery Date */}
          <div className="space-y-2">
            <Label htmlFor="deliveryDate">Delivery Date *</Label>
            <Input
              id="deliveryDate"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              required
            />
          </div>

          {/* Received By */}
          <div className="space-y-2">
            <Label htmlFor="receivedBy">Received By *</Label>
            <Input
              id="receivedBy"
              type="text"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              placeholder="Enter name of person who received the delivery"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes about the delivery..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Items Card */}
      {selectedPO && items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Items</CardTitle>
          </CardHeader>
          <CardContent>
            <DeliveryNoteItemsTable
              items={items}
              editable={true}
              onItemChange={handleItemChange}
            />
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !selectedPO}>
          {isSubmitting
            ? 'Saving...'
            : isEditing
            ? 'Update Delivery Note'
            : 'Create Delivery Note'}
        </Button>
      </div>
    </form>
  );
};

export default DeliveryNoteForm;
