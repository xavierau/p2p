import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { deliveryNoteService } from '@/services/deliveryNoteService';
import type {
  DeliveryNote,
  DeliveryNoteStatus,
  DeliveryNoteFilters,
} from '@/types';
import { cn } from '@/lib/utils';

interface DeliveryNoteListProps {
  className?: string;
}

/**
 * Returns badge variant for delivery note status
 */
const getStatusBadgeVariant = (
  status: DeliveryNoteStatus
): 'warning' | 'success' => {
  return status === 'CONFIRMED' ? 'success' : 'warning';
};

/**
 * Formats a date string to short format
 */
const formatDate = (dateString: string): string => {
  return format(new Date(dateString), 'MMM d, yyyy');
};

/**
 * List component for displaying delivery notes with filtering and pagination.
 */
const DeliveryNoteList: React.FC<DeliveryNoteListProps> = ({ className }) => {
  const navigate = useNavigate();

  // Data state
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Filter state
  const [statusFilter, setStatusFilter] = useState<DeliveryNoteStatus | 'ALL'>(
    'ALL'
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Fetch delivery notes
  const fetchDeliveryNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters: DeliveryNoteFilters = {};

      if (statusFilter !== 'ALL') {
        filters.status = statusFilter;
      }
      if (startDate) {
        filters.startDate = startDate;
      }
      if (endDate) {
        filters.endDate = endDate;
      }

      const response = await deliveryNoteService.getDeliveryNotes(filters, {
        page: currentPage,
        limit,
      });

      setDeliveryNotes(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalCount(response.pagination.total);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load delivery notes';
      setError(errorMessage);
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter, startDate, endDate]);

  // Fetch on mount and when filters/page change
  useEffect(() => {
    fetchDeliveryNotes();
  }, [fetchDeliveryNotes]);

  // Filter notes by search term (client-side)
  const filteredNotes = searchTerm
    ? deliveryNotes.filter(
        (note) =>
          note.id.toString().includes(searchTerm) ||
          note.purchaseOrder?.vendor?.name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          note.receivedBy.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : deliveryNotes;

  // Handle row click
  const handleRowClick = (id: number) => {
    navigate(`/delivery-notes/${id}`);
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Reset filters
  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn('p-6 text-center', className)}>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => fetchDeliveryNotes()}
        >
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters Card */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by DN#, vendor, or receiver..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as DeliveryNoteStatus | 'ALL')
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Reset Filters Button */}
        {(statusFilter !== 'ALL' || startDate || endDate || searchTerm) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            className="mt-4"
          >
            Reset Filters
          </Button>
        )}
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredNotes.length} of {totalCount} delivery notes
        </p>
      </div>

      {/* Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DN #</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Purchase Order</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Received By</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredNotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-32">
                  <p className="text-muted-foreground">
                    No delivery notes found
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredNotes.map((note) => {
                const itemCount = note.items?.length || 0;
                const vendorName =
                  note.purchaseOrder?.vendor?.name || 'Unknown Vendor';

                return (
                  <TableRow
                    key={note.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(note.id)}
                  >
                    <TableCell className="font-medium">
                      #{note.id}
                    </TableCell>
                    <TableCell>{formatDate(note.deliveryDate)}</TableCell>
                    <TableCell>
                      PO #{note.purchaseOrderId}
                    </TableCell>
                    <TableCell>{vendorName}</TableCell>
                    <TableCell>{note.receivedBy}</TableCell>
                    <TableCell>{itemCount} items</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(note.status)}>
                        {note.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryNoteList;
