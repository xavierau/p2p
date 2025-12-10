import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import DeliveryNoteDetail from '@/components/delivery-notes/DeliveryNoteDetail';
import DeliveryNoteForm from '@/components/delivery-notes/DeliveryNoteForm';
import { deliveryNoteService } from '@/services/deliveryNoteService';
import type { DeliveryNote } from '@/types';

/**
 * Delivery note detail page with view/edit modes.
 */
const DeliveryNoteDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [deliveryNote, setDeliveryNote] = useState<DeliveryNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch delivery note data
  const fetchDeliveryNote = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await deliveryNoteService.getDeliveryNoteById(Number(id));
      setDeliveryNote(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load delivery note';
      setError(errorMessage);
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDeliveryNote();
  }, [fetchDeliveryNote]);

  // Handle delete
  const handleDelete = async () => {
    if (!id) return;

    setIsDeleting(true);

    try {
      await deliveryNoteService.deleteDeliveryNote(Number(id));
      navigate('/delivery-notes');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete delivery note';
      setError(errorMessage);
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle update
  const handleUpdate = (updated: DeliveryNote) => {
    setDeliveryNote(updated);
    setIsEditing(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (error && !deliveryNote) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => navigate('/delivery-notes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Delivery Notes
        </Button>
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button variant="outline" onClick={fetchDeliveryNote}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Not found state
  if (!deliveryNote) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => navigate('/delivery-notes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Delivery Notes
        </Button>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Delivery note not found</p>
        </div>
      </div>
    );
  }

  const isDraft = deliveryNote.status === 'DRAFT';

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => navigate('/delivery-notes')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Delivery Notes
        </Button>

        {!isEditing && isDraft && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete delivery note?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    the delivery note and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Content: Form or Detail view */}
      {isEditing ? (
        <DeliveryNoteForm
          deliveryNote={deliveryNote}
          onSuccess={handleUpdate}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <DeliveryNoteDetail
          deliveryNote={deliveryNote}
          onUpdate={handleUpdate}
          onRefresh={fetchDeliveryNote}
        />
      )}
    </div>
  );
};

export default DeliveryNoteDetailPage;
