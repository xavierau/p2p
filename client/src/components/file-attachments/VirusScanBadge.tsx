import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Clock, Shield, XCircle, Loader2 } from 'lucide-react';
import type { VirusScanStatus } from '@/types';

interface VirusScanBadgeProps {
  status: VirusScanStatus;
  className?: string;
}

/**
 * Displays a badge indicating the virus scan status of a file.
 * Shows appropriate color, icon, and label for each status.
 */
const VirusScanBadge: React.FC<VirusScanBadgeProps> = ({ status, className }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'CLEAN':
        return {
          variant: 'success' as const,
          icon: CheckCircle,
          label: 'Clean',
        };
      case 'INFECTED':
        return {
          variant: 'error' as const,
          icon: XCircle,
          label: 'Infected',
        };
      case 'SCANNING':
        return {
          variant: 'info' as const,
          icon: Loader2,
          label: 'Scanning',
          animated: true,
        };
      case 'FAILED':
        return {
          variant: 'warning' as const,
          icon: AlertTriangle,
          label: 'Scan Failed',
        };
      case 'PENDING':
      default:
        return {
          variant: 'gray' as const,
          icon: Clock,
          label: 'Pending',
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon
        className={`mr-1 h-3 w-3 ${config.animated ? 'animate-spin' : ''}`}
      />
      {config.label}
    </Badge>
  );
};

export default VirusScanBadge;
