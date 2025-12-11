import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { InvoiceValidation, ValidationSeverity } from '@/types';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatRuleType,
  getSeverityBadgeVariant,
  getSeverityAlertVariant,
  getSeverityBgColor,
  getSeverityBorderColor,
} from '@/lib/validation-utils';

interface ValidationAlertProps {
  validation: InvoiceValidation;
  onOverride?: () => void;
  onDismiss?: () => void;
  showActions?: boolean;
}

/**
 * Severity icon configuration mapping
 */
const severityIcons: Record<ValidationSeverity, React.ComponentType<{ className?: string }>> = {
  CRITICAL: AlertCircle,
  WARNING: AlertTriangle,
  INFO: Info,
};

/**
 * Format validation details for display
 */
const formatDetails = (details: Record<string, unknown>): React.ReactNode => {
  if (!details || Object.keys(details).length === 0) {
    return <p className="text-sm text-muted-foreground">No additional details available.</p>;
  }

  // Handle specific detail formats
  if ('reason' in details && typeof details.reason === 'string') {
    return <p className="text-sm">{details.reason}</p>;
  }

  if ('duplicateInvoiceId' in details) {
    const duplicateId = details.duplicateInvoiceId;
    const duplicateDate = details.duplicateDate;
    return (
      <div className="text-sm space-y-1">
        <p>Duplicate invoice detected: Invoice #{String(duplicateId)}</p>
        {duplicateDate ? (
          <p className="text-muted-foreground">
            Date: {new Date(String(duplicateDate)).toLocaleDateString()}
          </p>
        ) : null}
      </div>
    );
  }

  if ('threshold' in details && typeof details.threshold === 'number') {
    return (
      <p className="text-sm">
        Amount exceeds threshold of ${details.threshold.toFixed(2)}
      </p>
    );
  }

  if ('variancePercent' in details && typeof details.variancePercent === 'number') {
    return (
      <p className="text-sm">
        Variance: {details.variancePercent.toFixed(2)}% from expected
      </p>
    );
  }

  // Default: JSON display
  return (
    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
      {JSON.stringify(details, null, 2)}
    </pre>
  );
};

export const ValidationAlert: React.FC<ValidationAlertProps> = ({
  validation,
  onOverride,
  onDismiss,
  showActions = true,
}) => {
  const Icon = severityIcons[validation.severity];
  const alertVariant = getSeverityAlertVariant(validation.severity);
  const badgeVariant = getSeverityBadgeVariant(validation.severity);
  const bgColor = getSeverityBgColor(validation.severity);
  const borderColor = getSeverityBorderColor(validation.severity);

  const showOverrideAction = showActions && validation.severity === 'CRITICAL' &&
    validation.status === 'FLAGGED' && onOverride;
  const showDismissAction = showActions && validation.severity !== 'CRITICAL' &&
    validation.status === 'FLAGGED' && onDismiss;

  return (
    <Alert
      variant={alertVariant}
      className={cn(
        bgColor,
        borderColor,
        'border-l-4'
      )}
    >
      <Icon className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span className="font-semibold">{formatRuleType(validation.ruleType)}</span>
        <Badge variant={badgeVariant}>{validation.severity}</Badge>
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-3">
          {formatDetails(validation.details)}

          {validation.override && (
            <div className="mt-3 p-3 bg-muted rounded-md">
              <p className="text-sm font-semibold mb-1">Override Information</p>
              <p className="text-sm text-muted-foreground">
                Overridden by {validation.override.user?.name || 'Unknown User'}
              </p>
              <p className="text-sm mt-1">Reason: {validation.override.reason}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(validation.override.createdAt).toLocaleString()}
              </p>
            </div>
          )}

          {(showOverrideAction || showDismissAction) && (
            <div className="flex gap-2 mt-3 pt-3 border-t">
              {showOverrideAction && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOverride}
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  Override
                </Button>
              )}
              {showDismissAction && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDismiss}
                >
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
