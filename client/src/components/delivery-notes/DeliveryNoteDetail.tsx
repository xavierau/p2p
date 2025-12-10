import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import DeliveryNoteItemsTable from './DeliveryNoteItemsTable';
import FileUploadZone from '../file-attachments/FileUploadZone';
import FileList from '../file-attachments/FileList';
import { deliveryNoteService } from '@/services/deliveryNoteService';
import type { DeliveryNote, DeliveryNoteStatus } from '@/types';
import { cn } from '@/lib/utils';

interface DeliveryNoteDetailProps {
  deliveryNote: DeliveryNote;
  onUpdate?: (deliveryNote: DeliveryNote) => void;
  onRefresh?: () => void;
  className?: string;
}

/**
 * Returns badge variant for delivery note status
 */
const getStatusBadgeVariant = (
  status: DeliveryNoteStatus
): 'warning' | 'success' => {
  switch (status) {
    case 'CONFIRMED':
      return 'success';
    case 'DRAFT':
    default:
      return 'warning';
  }
};

/**
 * Formats a date string to localized format
 */
const formatDate = (dateString: string): string => {
  return format(new Date(dateString), 'MMM d, yyyy');
};

/**
 * Component for viewing delivery note details with file attachments.
 */
const DeliveryNoteDetail: React.FC<DeliveryNoteDetailProps> = ({
  deliveryNote,
  onUpdate,
  onRefresh,
  className,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = deliveryNote.status === 'DRAFT';
  const hasDiscrepancies =
    deliveryNote.items?.some(
      (item) => item.quantityDelivered !== item.quantityOrdered
    ) || false;

  // Handle confirm delivery note
  const handleConfirm = async () => {
    setIsConfirming(true);
    setError(null);

    try {
      const updated = await deliveryNoteService.confirmDeliveryNote(
        deliveryNote.id
      );
      onUpdate?.(updated);
      onRefresh?.();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to confirm delivery note';
      setError(errorMessage);
      console.error('Confirm error:', err);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Delivery Note #{deliveryNote.id}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Created {formatDate(deliveryNote.createdAt)}
              </p>
            </div>
            <Badge variant={getStatusBadgeVariant(deliveryNote.status)}>
              {deliveryNote.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Purchase Order</p>
              {deliveryNote.purchaseOrder ? (
                <Link
                  to={`/purchase-orders/${deliveryNote.purchaseOrderId}`}
                  className="text-primary hover:underline font-medium"
                >
                  PO #{deliveryNote.purchaseOrderId}
                </Link>
              ) : (
                <p className="font-medium">PO #{deliveryNote.purchaseOrderId}</p>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Vendor</p>
              {deliveryNote.purchaseOrder?.vendor ? (
                <Link
                  to={`/vendors/${deliveryNote.purchaseOrder.vendor.id}`}
                  className="text-primary hover:underline font-medium"
                >
                  {deliveryNote.purchaseOrder.vendor.name}
                </Link>
              ) : (
                <p className="font-medium">-</p>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Delivery Date</p>
              <p className="font-medium">
                {formatDate(deliveryNote.deliveryDate)}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Received By</p>
              <p className="font-medium">{deliveryNote.receivedBy}</p>
            </div>
          </div>

          {deliveryNote.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-sm mt-1">{deliveryNote.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Button */}
      {isDraft && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold mb-1">Ready to confirm?</h4>
                <p className="text-sm text-muted-foreground">
                  Confirming will finalize this delivery note and it can no longer
                  be edited.
                  {hasDiscrepancies &&
                    ' Please review quantity discrepancies before confirming.'}
                </p>
              </div>
              <Button
                onClick={handleConfirm}
                disabled={isConfirming}
                className="flex-shrink-0"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {isConfirming ? 'Confirming...' : 'Confirm Delivery'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items Card */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Items</CardTitle>
        </CardHeader>
        <CardContent>
          <DeliveryNoteItemsTable
            items={deliveryNote.items || []}
            editable={false}
          />
        </CardContent>
      </Card>

      {/* File Attachments Card */}
      <Card>
        <CardHeader>
          <CardTitle>File Attachments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload zone */}
          <FileUploadZone
            entityType="DELIVERY_NOTE"
            entityId={deliveryNote.id}
            onUploadComplete={onRefresh}
            onError={(err) => setError(err)}
          />

          {/* Attached files list */}
          <FileList
            attachments={deliveryNote.attachments || []}
            onDetach={onRefresh}
            onRefresh={onRefresh}
          />
        </CardContent>
      </Card>

      {/* Linked Invoices Card */}
      {deliveryNote.invoices && deliveryNote.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Linked Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {deliveryNote.invoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  to={`/invoices/${invoice.id}`}
                  className="block p-3 border rounded-md hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Invoice #{invoice.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(invoice.date)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        invoice.status === 'APPROVED'
                          ? 'success'
                          : invoice.status === 'REJECTED'
                          ? 'error'
                          : 'warning'
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DeliveryNoteDetail;
