import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { validationService } from '@/services/validationService';
import type {
  InvoiceValidation,
  ValidationDashboardStats,
  ValidationSeverity,
  ValidationStatus,
} from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ValidationAlert } from '@/components/validation/ValidationAlert';
import { ValidationOverrideDialog } from '@/components/validation/ValidationOverrideDialog';
import { LoadingSpinner, ErrorDisplay } from '@/components/common';
import { AlertCircle, TrendingUp, TrendingDown, Filter } from 'lucide-react';

const FlaggedInvoicesPage: React.FC = () => {
  const [validations, setValidations] = useState<InvoiceValidation[]>([]);
  const [stats, setStats] = useState<ValidationDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedValidation, setSelectedValidation] = useState<InvoiceValidation | null>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<ValidationSeverity | ''>('');
  const [statusFilter, setStatusFilter] = useState<ValidationStatus | ''>('FLAGGED' as ValidationStatus);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters: { severity?: ValidationSeverity; status?: ValidationStatus } = {};
      if (severityFilter) filters.severity = severityFilter;
      if (statusFilter) filters.status = statusFilter;

      const [flaggedResult, statsResult] = await Promise.all([
        validationService.getFlaggedInvoices(filters),
        validationService.getDashboardStats(),
      ]);

      setValidations(flaggedResult.data);
      setStats(statsResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load flagged invoices';
      setError(message);
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [severityFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOverride = (validation: InvoiceValidation) => {
    setSelectedValidation(validation);
    setOverrideDialogOpen(true);
  };

  const handleOverrideSubmit = async (reason: string) => {
    if (!selectedValidation) return;

    await validationService.overrideValidation(selectedValidation.id, { reason });
    await loadData();
  };

  const handleDismiss = async (validation: InvoiceValidation) => {
    try {
      await validationService.reviewValidation(validation.id, { action: 'DISMISS' });
      await loadData();
    } catch (err) {
      console.error('Failed to dismiss validation:', err);
    }
  };

  // Loading state
  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error && !stats) {
    return <ErrorDisplay message={error} onRetry={loadData} />;
  }

  const totalFlagged = stats?.totalFlagged || 0;
  const criticalCount = stats?.bySeverity.find(s => s.severity === 'CRITICAL')?._count || 0;
  const warningCount = stats?.bySeverity.find(s => s.severity === 'WARNING')?._count || 0;
  const infoCount = stats?.bySeverity.find(s => s.severity === 'INFO')?._count || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Flagged Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Review and manage validation issues
          </p>
        </div>
        <Badge variant="destructive" className="text-lg px-4 py-2">
          <AlertCircle className="h-4 w-4 mr-1" />
          {totalFlagged} {totalFlagged === 1 ? 'Issue' : 'Issues'}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Review recommended
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Information</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{infoCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              For your awareness
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as ValidationSeverity | '')}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ValidationStatus | '')}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">All Statuses</option>
                <option value="FLAGGED">Flagged</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="DISMISSED">Dismissed</option>
                <option value="OVERRIDDEN">Overridden</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : validations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <p className="text-muted-foreground text-lg">No validation issues found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Try adjusting your filters or check back later
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {validations.map((validation) => (
            <Card key={validation.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Link
                    to={`/invoices/${validation.invoiceId}`}
                    className="text-primary hover:underline font-medium"
                  >
                    Invoice #{validation.invoiceId}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {new Date(validation.createdAt).toLocaleString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ValidationAlert
                  validation={validation}
                  onOverride={() => handleOverride(validation)}
                  onDismiss={() => handleDismiss(validation)}
                  showActions={true}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Override Dialog */}
      <ValidationOverrideDialog
        isOpen={overrideDialogOpen}
        onClose={() => {
          setOverrideDialogOpen(false);
          setSelectedValidation(null);
        }}
        onSubmit={handleOverrideSubmit}
        validation={selectedValidation}
      />
    </div>
  );
};

export default FlaggedInvoicesPage;
