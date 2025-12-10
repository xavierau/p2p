import React from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { DeliveryNoteItem, ItemCondition } from '@/types';
import { cn } from '@/lib/utils';

interface DeliveryNoteItemsTableProps {
  items: DeliveryNoteItem[];
  editable?: boolean;
  onItemChange?: (index: number, field: string, value: any) => void;
  className?: string;
}

/**
 * Gets badge styling for item condition
 */
const getConditionBadgeVariant = (
  condition: ItemCondition
): 'success' | 'warning' | 'error' => {
  switch (condition) {
    case 'GOOD':
      return 'success';
    case 'PARTIAL':
      return 'warning';
    case 'DAMAGED':
      return 'error';
    default:
      return 'success';
  }
};

/**
 * Reusable table component for displaying delivery note items.
 * Supports both editable (form mode) and read-only (detail mode) views.
 */
const DeliveryNoteItemsTable: React.FC<DeliveryNoteItemsTableProps> = ({
  items,
  editable = false,
  onItemChange,
  className,
}) => {
  // Handle field change
  const handleChange = (index: number, field: string, value: any) => {
    onItemChange?.(index, field, value);
  };

  // Check if item has discrepancy
  const hasDiscrepancy = (item: DeliveryNoteItem) => {
    return item.quantityDelivered !== item.quantityOrdered;
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No items to display
      </div>
    );
  }

  return (
    <div className={cn('border rounded-md overflow-x-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Ordered</TableHead>
            <TableHead className="text-right">Delivered</TableHead>
            <TableHead>Condition</TableHead>
            <TableHead>Discrepancy Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => {
            const itemName = item.item?.name || `Item #${item.itemId}`;
            const showDiscrepancy = hasDiscrepancy(item);

            return (
              <TableRow
                key={item.id || index}
                className={showDiscrepancy ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
              >
                {/* Item name */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {showDiscrepancy && (
                      <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    )}
                    <span className="font-medium">{itemName}</span>
                  </div>
                </TableCell>

                {/* Quantity ordered (read-only) */}
                <TableCell className="text-right">
                  {item.quantityOrdered}
                </TableCell>

                {/* Quantity delivered (editable if in form mode) */}
                <TableCell className="text-right">
                  {editable ? (
                    <Input
                      type="number"
                      min="0"
                      value={item.quantityDelivered}
                      onChange={(e) =>
                        handleChange(
                          index,
                          'quantityDelivered',
                          parseInt(e.target.value, 10) || 0
                        )
                      }
                      className="w-20 text-right"
                    />
                  ) : (
                    <span
                      className={
                        showDiscrepancy
                          ? 'font-semibold text-yellow-600 dark:text-yellow-400'
                          : ''
                      }
                    >
                      {item.quantityDelivered}
                    </span>
                  )}
                </TableCell>

                {/* Condition (editable if in form mode) */}
                <TableCell>
                  {editable ? (
                    <Select
                      value={item.condition}
                      onValueChange={(value) =>
                        handleChange(index, 'condition', value as ItemCondition)
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GOOD">Good</SelectItem>
                        <SelectItem value="DAMAGED">Damaged</SelectItem>
                        <SelectItem value="PARTIAL">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={getConditionBadgeVariant(item.condition)}>
                      {item.condition}
                    </Badge>
                  )}
                </TableCell>

                {/* Discrepancy reason (conditional, editable if in form mode) */}
                <TableCell>
                  {showDiscrepancy ? (
                    editable ? (
                      <Textarea
                        placeholder="Explain the discrepancy..."
                        value={item.discrepancyReason || ''}
                        onChange={(e) =>
                          handleChange(index, 'discrepancyReason', e.target.value)
                        }
                        className="min-h-[60px]"
                        required
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {item.discrepancyReason || 'No reason provided'}
                      </p>
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Discrepancy warning */}
      {items.some(hasDiscrepancy) && (
        <div className="border-t bg-yellow-50 dark:bg-yellow-900/10 p-3">
          <div className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-300">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              <strong>Discrepancy detected:</strong> Some items have different
              delivered quantities than ordered. Please provide reasons for the
              discrepancies.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryNoteItemsTable;
