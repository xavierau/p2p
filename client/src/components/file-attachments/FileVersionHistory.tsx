import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Download, CheckCircle, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import VirusScanBadge from './VirusScanBadge';
import { fileAttachmentService } from '@/services/fileAttachmentService';
import type { FileAttachment } from '@/types';

interface FileVersionHistoryProps {
  fileId: number;
  open: boolean;
  onClose: () => void;
}

/**
 * Formats file size in human-readable format
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Displays version history timeline for a file.
 * Shows all versions with upload date, uploader, and download links.
 */
const FileVersionHistory: React.FC<FileVersionHistoryProps> = ({
  fileId,
  open,
  onClose,
}) => {
  const [versions, setVersions] = useState<FileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    const loadVersions = async () => {
      if (!open) return;

      setIsLoading(true);
      setError(null);

      try {
        const versionList = await fileAttachmentService.getFileVersions(fileId);
        // Sort by version number descending (newest first)
        const sorted = versionList.sort((a, b) => b.version - a.version);
        setVersions(sorted);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load version history';
        setError(errorMessage);
        console.error('Version history error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadVersions();
  }, [fileId, open]);

  // Handle version download
  const handleDownload = async (versionId: number, filename: string) => {
    setDownloadingId(versionId);

    try {
      const { downloadUrl } = await fileAttachmentService.getDownloadUrl(
        versionId
      );

      // Create temporary anchor to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Loading state */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-center py-8 text-red-600 dark:text-red-400">
              <p>{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && versions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No version history available</p>
            </div>
          )}

          {/* Version timeline */}
          {!isLoading && !error && versions.length > 0 && (
            <div className="space-y-4">
              {versions.map((version, index) => {
                const isCurrentVersion = index === 0;
                const uploadedBy =
                  version.uploadedByUser?.name || `User #${version.uploadedBy}`;
                const uploadedAt = format(
                  new Date(version.uploadedAt),
                  'MMM d, yyyy h:mm a'
                );

                return (
                  <div
                    key={version.id}
                    className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Version header */}
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">
                            Version {version.version}
                          </h4>
                          {isCurrentVersion && (
                            <Badge variant="success">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Current
                            </Badge>
                          )}
                          <VirusScanBadge status={version.virusScanStatus} />
                        </div>

                        {/* File info */}
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">
                            <span className="font-medium">Filename:</span>{' '}
                            {version.filename}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium">Size:</span>{' '}
                            {formatFileSize(version.fileSize)}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium">Uploaded by:</span>{' '}
                            {uploadedBy}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium">Uploaded at:</span>{' '}
                            {uploadedAt}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium">Type:</span>{' '}
                            {version.mimeType}
                          </p>
                        </div>
                      </div>

                      {/* Download button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDownload(version.id, version.filename)
                        }
                        disabled={
                          downloadingId === version.id ||
                          version.virusScanStatus === 'INFECTED'
                        }
                        title={
                          version.virusScanStatus === 'INFECTED'
                            ? 'Cannot download infected file'
                            : 'Download this version'
                        }
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileVersionHistory;
