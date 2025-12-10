import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Copy, Check } from 'lucide-react';

export interface TokenDisplayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  tokenName: string;
}

export function TokenDisplay({
  open,
  onOpenChange,
  token,
  tokenName,
}: TokenDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy token:', err);
    }
  }, [token]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setCopied(false);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Token Created Successfully</DialogTitle>
          <DialogDescription>
            Your new API token "{tokenName}" has been created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning message */}
          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">Important: Copy your token now</p>
              <p className="mt-1">
                This token will only be shown once. Make sure to copy it and
                store it securely. You will not be able to see it again.
              </p>
            </div>
          </div>

          {/* Token display */}
          <div className="space-y-2">
            <Label htmlFor="token-value">Your API Token</Label>
            <div className="flex gap-2">
              <Input
                id="token-value"
                value={token}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Usage instructions */}
          <div className="space-y-2">
            <Label>Usage Example</Label>
            <div className="rounded-md bg-muted p-3">
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all">
                <code>{`// MCP Server Configuration
{
  "mcpServers": {
    "payment-management": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {
        "MCP_API_TOKEN": "${token}"
      }
    }
  }
}`}</code>
              </pre>
            </div>
            <p className="text-xs text-muted-foreground">
              Add this token to your MCP server configuration to enable API
              access.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => handleOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
