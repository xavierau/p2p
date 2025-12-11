import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { validationService } from '@/services/validationService';
import type { ValidationRule, ValidationSeverity } from '@/types/validation';

/**
 * Admin page for configuring validation rules.
 * Allows enabling/disabling rules and adjusting thresholds and severity levels.
 */
const ValidationRulesPage: React.FC = () => {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingRuleId, setSavingRuleId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch validation rules on mount
  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await validationService.getValidationRules();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load validation rules');
    } finally {
      setLoading(false);
    }
  };

  const handleRuleUpdate = async (
    ruleId: number,
    updates: Partial<Pick<ValidationRule, 'enabled' | 'severity' | 'config'>>
  ) => {
    try {
      setSavingRuleId(ruleId);
      setError(null);
      setSuccessMessage(null);

      await validationService.updateValidationRule(ruleId, updates);

      // Update local state
      setRules((prev) =>
        prev.map((rule) =>
          rule.id === ruleId ? { ...rule, ...updates } : rule
        )
      );

      // Show success message
      setSuccessMessage('Rule updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    } finally {
      setSavingRuleId(null);
    }
  };

  const handleEnabledToggle = (ruleId: number, enabled: boolean) => {
    handleRuleUpdate(ruleId, { enabled });
  };

  const handleSeverityChange = (ruleId: number, severity: ValidationSeverity) => {
    handleRuleUpdate(ruleId, { severity });
  };

  const handleConfigChange = (ruleId: number, configKey: string, value: any) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const newConfig = {
      ...rule.config,
      [configKey]: value,
    };

    handleRuleUpdate(ruleId, { config: newConfig });
  };

  const getSeverityBadgeVariant = (
    severity: ValidationSeverity
  ): 'error' | 'warning' | 'info' => {
    switch (severity) {
      case 'CRITICAL':
        return 'error';
      case 'WARNING':
        return 'warning';
      case 'INFO':
        return 'info';
      default:
        return 'info';
    }
  };

  const getRuleDescription = (ruleType: string): string => {
    const descriptions: Record<string, string> = {
      DUPLICATE_INVOICE_NUMBER:
        'Prevents duplicate invoice numbers from the same vendor',
      MISSING_INVOICE_NUMBER: 'Warns when invoice number is missing',
      AMOUNT_THRESHOLD_EXCEEDED:
        'Flags invoices exceeding the configured threshold',
      ROUND_AMOUNT_PATTERN: 'Detects suspiciously round invoice amounts',
      PO_AMOUNT_VARIANCE:
        'Flags invoices with significant variance from purchase order amount',
      PO_ITEM_MISMATCH: 'Detects invoice items not present in purchase order',
      DELIVERY_NOTE_MISMATCH:
        'Flags quantities exceeding delivery note quantities',
      PRICE_VARIANCE:
        'Detects prices significantly different from historical average',
    };
    return descriptions[ruleType] || 'No description available';
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error && rules.length === 0) {
    return <ErrorDisplay message={error} onRetry={fetchRules} />;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Validation Rules Configuration</h1>
        <p className="text-muted-foreground">
          Configure invoice validation rules, thresholds, and severity levels.
          Changes take effect immediately.
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Alert className="mb-6 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Rules List */}
      <div className="space-y-6">
        {rules.map((rule) => (
          <Card key={rule.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-xl">
                      {rule.ruleType.replace(/_/g, ' ')}
                    </CardTitle>
                    <Badge variant={getSeverityBadgeVariant(rule.severity)}>
                      {rule.severity}
                    </Badge>
                    {!rule.enabled && (
                      <Badge variant="gray">Disabled</Badge>
                    )}
                  </div>
                  <CardDescription>
                    {getRuleDescription(rule.ruleType)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`enabled-${rule.id}`} className="text-sm">
                    Enabled
                  </Label>
                  <Switch
                    id={`enabled-${rule.id}`}
                    checked={rule.enabled}
                    onCheckedChange={(checked) =>
                      handleEnabledToggle(rule.id, checked)
                    }
                    disabled={savingRuleId === rule.id}
                  />
                </div>
              </div>
            </CardHeader>

            {rule.enabled && (
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Severity Selection */}
                  <div className="space-y-2">
                    <Label htmlFor={`severity-${rule.id}`}>Severity Level</Label>
                    <Select
                      value={rule.severity}
                      onValueChange={(value) =>
                        handleSeverityChange(rule.id, value as ValidationSeverity)
                      }
                      disabled={savingRuleId === rule.id}
                    >
                      <SelectTrigger id={`severity-${rule.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CRITICAL">
                          Critical (blocks approval)
                        </SelectItem>
                        <SelectItem value="WARNING">Warning</SelectItem>
                        <SelectItem value="INFO">Info</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Critical validations block invoice approval
                    </p>
                  </div>

                  {/* Dynamic Config Fields */}
                  {rule.config && Object.keys(rule.config).length > 0 && (
                    <>
                      {Object.entries(rule.config).map(([key, value]) => (
                        <div key={key} className="space-y-2">
                          <Label htmlFor={`config-${rule.id}-${key}`}>
                            {key
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/^./, (str) => str.toUpperCase())}
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id={`config-${rule.id}-${key}`}
                              type={typeof value === 'number' ? 'number' : 'text'}
                              value={value as string | number}
                              onChange={(e) => {
                                const newValue =
                                  typeof value === 'number'
                                    ? parseFloat(e.target.value)
                                    : e.target.value;
                                handleConfigChange(rule.id, key, newValue);
                              }}
                              disabled={savingRuleId === rule.id}
                              step={typeof value === 'number' ? '0.01' : undefined}
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                handleRuleUpdate(rule.id, {
                                  config: rule.config,
                                })
                              }
                              disabled={savingRuleId === rule.id}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {savingRuleId === rule.id && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <LoadingSpinner className="h-4 w-4" />
                    <span>Saving changes...</span>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {rules.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No validation rules configured</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ValidationRulesPage;
