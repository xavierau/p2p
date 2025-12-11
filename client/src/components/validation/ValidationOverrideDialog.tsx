import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';
import type { InvoiceValidation } from '@/types';
import { formatRuleType } from '@/lib/validation-utils';

interface ValidationOverrideDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  validation: InvoiceValidation | null;
}

export const ValidationOverrideDialog: React.FC<ValidationOverrideDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  validation,
}) => {
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (!isLoading) {
      setReason('');
      setError('');
      onClose();
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (reason.trim().length < 10) {
      setError('Override reason must be at least 10 characters long.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onSubmit(reason.trim());
      handleClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to override validation';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const isReasonValid = reason.trim().length >= 10;
  const characterCount = reason.trim().length;
  const characterCountColor = characterCount < 10 ? 'text-red-500' : 'text-green-600';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Override Validation
          </DialogTitle>
          <DialogDescription>
            You are about to override a critical validation issue. This action will be permanently
            logged in the audit trail and associated with your user account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Validation Issue Display */}
          {validation && (
            <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-1">Validation Issue</p>
                <p className="text-sm">{formatRuleType(validation.ruleType)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Severity: {validation.severity}
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Reason Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="override-reason">
                Override Reason <span className="text-destructive">*</span>
              </Label>
              <span className={`text-xs ${characterCountColor}`}>
                {characterCount}/10 characters minimum
              </span>
            </div>
            <Textarea
              id="override-reason"
              placeholder="Explain why you are overriding this validation (minimum 10 characters)..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              rows={4}
              className={error && !isReasonValid ? 'border-red-500' : ''}
              disabled={isLoading}
            />
            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>

          {/* Important Note */}
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <p className="text-xs">
                <strong>Important:</strong> This override will be permanently recorded in the
                audit log. Make sure to provide a clear and detailed explanation for this action.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isReasonValid || isLoading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isLoading ? 'Overriding...' : 'Confirm Override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
