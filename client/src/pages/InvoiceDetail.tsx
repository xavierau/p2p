import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { invoiceService } from '@/services/invoiceService';
import type { Invoice, InvoiceStatus, SyncStatus } from '@/types';
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
import { cn } from '@/lib/utils';
import FileUploadZone from '@/components/file-attachments/FileUploadZone';
import FileList from '@/components/file-attachments/FileList';

/**
 * Formats a number as USD currency
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

/**
 * Formats a date string to localized format
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Returns Tailwind classes for invoice status badge
 */
const getStatusBadgeClasses = (status: InvoiceStatus): string => {
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
 * Returns Tailwind classes for sync status badge
 */
const getSyncStatusBadgeClasses = (syncStatus: SyncStatus): string => {
  switch (syncStatus) {
    case 'SYNCED':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'PENDING':
    default:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
  }
};

/**
 * Status badge component for reuse
 */
interface StatusBadgeProps {
  status: string;
  className: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => (
  <span
    className={cn(
      'px-2 py-1 rounded-full text-xs font-semibold',
      className
    )}
  >
    {status}
  </span>
);

/**
 * Detail row component for consistent label-value display
 */
interface DetailRowProps {
  label: string;
  children: React.ReactNode;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, children }) => (
  <div className="flex justify-between py-2 border-b last:border-b-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{children}</span>
  </div>
);

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchInvoiceData = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await invoiceService.getInvoiceById(Number(id));
      setInvoice(data);
    } catch (err) {
      setError('Failed to load invoice details');
      console.error('Error fetching invoice:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Fetch invoice data when component mounts or id changes
  useEffect(() => {
    fetchInvoiceData();
  }, [fetchInvoiceData]);

  const handleStatusChange = async (action: 'approve' | 'reject') => {
    if (!id) return;

    setIsUpdating(true);
    setError(null);

    try {
      if (action === 'approve') {
        await invoiceService.approveInvoice(Number(id));
      } else {
        await invoiceService.rejectInvoice(Number(id));
      }
      await fetchInvoiceData();
    } catch (err) {
      setError(`Failed to ${action} invoice`);
      console.error(`Error ${action}ing invoice:`, err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBackToList = () => {
    navigate('/invoices');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading invoice details...</div>
      </div>
    );
  }

  // Error state
  if (error && !invoice) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <p className="text-red-600">{error}</p>
            <Button variant="outline" onClick={handleBackToList}>
              Back to Invoices
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No invoice found
  if (!invoice) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Invoice not found</p>
            <Button variant="outline" onClick={handleBackToList}>
              Back to Invoices
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const hasOrganizationalContext =
    invoice.branch || invoice.department || invoice.costCenter;
  const isPending = invoice.status === 'PENDING';
  const lineItems = invoice.items || [];

  return (
    <div className="space-y-6">
      {/* Header with back button and actions */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={handleBackToList}>
          Back to Invoices
        </Button>

        {isPending && (
          <div className="space-x-2">
            <Button
              onClick={() => handleStatusChange('approve')}
              disabled={isUpdating}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isUpdating ? 'Processing...' : 'Approve'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleStatusChange('reject')}
              disabled={isUpdating}
            >
              {isUpdating ? 'Processing...' : 'Reject'}
            </Button>
          </div>
        )}
      </div>

      {/* Error message display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Invoice Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice #{invoice.id}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <DetailRow label="Date">
            {formatDate(invoice.date)}
          </DetailRow>
          <DetailRow label="Status">
            <StatusBadge
              status={invoice.status}
              className={getStatusBadgeClasses(invoice.status)}
            />
          </DetailRow>
          <DetailRow label="Total Amount">
            {formatCurrency(invoice.totalAmount)}
          </DetailRow>
          {invoice.project && (
            <DetailRow label="Project">
              {invoice.project}
            </DetailRow>
          )}
          {invoice.purchaseOrder && (
            <DetailRow label="Linked Purchase Order">
              <Link
                to={`/purchase-orders/${invoice.purchaseOrderId}`}
                className="text-primary hover:underline"
              >
                PO #{invoice.purchaseOrderId}
              </Link>
            </DetailRow>
          )}
        </CardContent>
      </Card>

      {/* Organizational Context Card */}
      {hasOrganizationalContext && (
        <Card>
          <CardHeader>
            <CardTitle>Organizational Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoice.branch && (
              <DetailRow label="Branch">
                {invoice.branch.name}
              </DetailRow>
            )}
            {invoice.department && (
              <DetailRow label="Department">
                {invoice.department.name}
              </DetailRow>
            )}
            {invoice.costCenter && (
              <DetailRow label="Cost Center">
                {invoice.costCenter.name}
              </DetailRow>
            )}
          </CardContent>
        </Card>
      )}

      {/* Line Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
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
                {lineItems.map((lineItem) => {
                  const subtotal = lineItem.quantity * lineItem.price;
                  const itemName = lineItem.item?.name || `Item #${lineItem.itemId}`;

                  return (
                    <TableRow key={lineItem.id}>
                      <TableCell>
                        <Link
                          to={`/items/${lineItem.itemId}`}
                          className="text-primary hover:underline"
                        >
                          {itemName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        {lineItem.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(lineItem.price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(subtotal)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {lineItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center h-24 text-muted-foreground"
                    >
                      No line items found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
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
            entityType="INVOICE"
            entityId={invoice.id}
            onUploadComplete={fetchInvoiceData}
            onError={(err) => setError(err)}
          />

          {/* Attached files list */}
          <FileList
            attachments={invoice.attachments || []}
            onDetach={fetchInvoiceData}
            onRefresh={fetchInvoiceData}
          />
        </CardContent>
      </Card>

      {/* Sync Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <DetailRow label="Status">
            <StatusBadge
              status={invoice.syncStatus}
              className={getSyncStatusBadgeClasses(invoice.syncStatus)}
            />
          </DetailRow>
          {invoice.accountingId && (
            <DetailRow label="Accounting ID">
              {invoice.accountingId}
            </DetailRow>
          )}
          {invoice.syncError && (
            <DetailRow label="Sync Error">
              <span className="text-red-600">{invoice.syncError}</span>
            </DetailRow>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceDetail;
