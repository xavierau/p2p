import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Props for the DeleteConfirmDialog component
 */
export interface DeleteConfirmDialogProps {
  /** Controls whether the dialog is open */
  open: boolean;
  /** Callback to change the open state */
  onOpenChange: (open: boolean) => void;
  /** Title displayed in the dialog header */
  title: string;
  /** Description text explaining what will be deleted */
  description: string;
  /** Callback invoked when user confirms deletion */
  onConfirm: () => void;
  /** When true, shows loading state on the delete button */
  isDeleting?: boolean;
}

/**
 * A confirmation dialog component for delete operations.
 *
 * Provides a consistent UI for confirming destructive actions with
 * Cancel and Delete buttons. The Delete button shows a loading state
 * when the deletion is in progress.
 *
 * @example
 * ```tsx
 * <DeleteConfirmDialog
 *   open={showDeleteDialog}
 *   onOpenChange={setShowDeleteDialog}
 *   title="Delete Invoice"
 *   description="Are you sure you want to delete this invoice? This action cannot be undone."
 *   onConfirm={handleDelete}
 *   isDeleting={isDeleting}
 * />
 * ```
 */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isDeleting = false,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" className="text-destructive-foreground" />
                Deleting...
              </span>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
