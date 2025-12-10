import { useState, useEffect, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog';
import { CreateTokenDialog } from './CreateTokenDialog';
import { TokenDisplay } from './TokenDisplay';
import {
  mcpTokenService,
  McpToken,
  CreateTokenResponse,
} from '@/services/mcpTokenService';

const MAX_TOKENS = 10;

export function McpTokenList() {
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTokenDisplay, setShowTokenDisplay] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Token creation result
  const [createdToken, setCreatedToken] = useState<CreateTokenResponse | null>(
    null
  );

  // Token to delete
  const [tokenToDelete, setTokenToDelete] = useState<McpToken | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedTokens = await mcpTokenService.list();
      setTokens(fetchedTokens);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load tokens';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleCreateToken = useCallback(
    async (name: string, expiryDays: number) => {
      const response = await mcpTokenService.create({ name, expiryDays });
      setCreatedToken(response);
      setShowCreateDialog(false);
      setShowTokenDisplay(true);
      // Refresh the token list
      await fetchTokens();
    },
    [fetchTokens]
  );

  const handleTokenDisplayClose = useCallback(() => {
    setShowTokenDisplay(false);
    setCreatedToken(null);
  }, []);

  const handleDeleteClick = useCallback((token: McpToken) => {
    setTokenToDelete(token);
    setShowDeleteDialog(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!tokenToDelete) return;

    setIsDeleting(true);
    try {
      await mcpTokenService.revoke(tokenToDelete.id);
      setShowDeleteDialog(false);
      setTokenToDelete(null);
      await fetchTokens();
    } catch (err) {
      console.error('Failed to revoke token:', err);
    } finally {
      setIsDeleting(false);
    }
  }, [tokenToDelete, fetchTokens]);

  const handleDeleteDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setShowDeleteDialog(false);
      setTokenToDelete(null);
    }
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  }, []);

  const formatRelativeDate = useCallback((dateString: string | null) => {
    if (!dateString) return 'Never';
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  }, []);

  const canCreateToken = tokens.length < MAX_TOKENS;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Tokens</CardTitle>
              <CardDescription>
                Manage API tokens for MCP (Model Context Protocol) integrations.
                These tokens allow AI assistants to securely access your payment
                management data.
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              disabled={!canCreateToken}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Token
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-2 py-8 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={fetchTokens}>
                Retry
              </Button>
            </div>
          ) : tokens.length === 0 ? (
            <EmptyState onCreateClick={() => setShowCreateDialog(true)} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Token Prefix</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((token) => (
                    <TableRow
                      key={token.id}
                      className={token.isExpired ? 'opacity-60' : ''}
                    >
                      <TableCell className="font-medium">
                        {token.name}
                        {token.isExpired && (
                          <span className="ml-2 text-xs text-destructive">
                            (Expired)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
                          {token.tokenPrefix}...
                        </code>
                      </TableCell>
                      <TableCell>{formatDate(token.createdAt)}</TableCell>
                      <TableCell>
                        {formatRelativeDate(token.lastUsedAt)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            token.isExpired ? 'text-destructive' : ''
                          }
                        >
                          {formatDate(token.expiresAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(token)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!canCreateToken && (
                <p className="mt-4 text-sm text-muted-foreground">
                  You have reached the maximum of {MAX_TOKENS} tokens. Delete an
                  existing token to create a new one.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateTokenDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateToken}
      />

      {createdToken && (
        <TokenDisplay
          open={showTokenDisplay}
          onOpenChange={handleTokenDisplayClose}
          token={createdToken.token}
          tokenName={createdToken.name}
        />
      )}

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={handleDeleteDialogClose}
        title="Revoke API Token"
        description={`Are you sure you want to revoke the token "${tokenToDelete?.name}"? Any integrations using this token will stop working immediately. This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </>
  );
}

interface EmptyStateProps {
  onCreateClick: () => void;
}

function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-3 mb-4">
        <Plus className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">No API tokens</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        Create your first API token to enable MCP integrations with AI
        assistants like Claude.
      </p>
      <Button className="mt-4" onClick={onCreateClick}>
        <Plus className="mr-2 h-4 w-4" />
        Create Your First Token
      </Button>
    </div>
  );
}
