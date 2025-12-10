import React, { useState } from 'react';
import {
  File as FileIcon,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  Download,
  Trash2,
  History,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
import { Skeleton } from '@/components/ui/skeleton';
import VirusScanBadge from './VirusScanBadge';
import FileVersionHistory from './FileVersionHistory';
import { fileAttachmentService } from '@/services/fileAttachmentService';
import type { EntityFileAttachment } from '@/types';
import { cn } from '@/lib/utils';

interface FileListProps {
  attachments: EntityFileAttachment[];
  isLoading?: boolean;
  onDetach?: (attachmentId: number) => void;
  onRefresh?: () => void;
  className?: string;
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
 * Gets appropriate icon for file type
 */
const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('text')
  )
    return FileText;
  return FileIcon;
};

/**
 * Displays a list of attached files with download, detach, and version history options.
 */
const FileList: React.FC<FileListProps> = ({
  attachments,
  isLoading = false,
  onDetach,
  onRefresh,
  className,
}) => {
  const [detachingId, setDetachingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<number | null>(
    null
  );
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle file download
  const handleDownload = async (fileId: number, filename: string) => {
    setDownloadingId(fileId);
    setError(null);

    try {
      const { downloadUrl } = await fileAttachmentService.getDownloadUrl(fileId);

      // Create temporary anchor to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to download file';
      setError(errorMessage);
      console.error('Download error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle file detachment
  const handleDetach = async (attachmentId: number) => {
    setDetachingId(attachmentId);
    setError(null);

    try {
      await fileAttachmentService.detachFile(attachmentId);
      onDetach?.(attachmentId);
      onRefresh?.();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to detach file';
      setError(errorMessage);
      console.error('Detach error:', err);
    } finally {
      setDetachingId(null);
      setShowDeleteDialog(false);
      setSelectedAttachmentId(null);
    }
  };

  // Show delete confirmation dialog
  const confirmDetach = (attachmentId: number) => {
    setSelectedAttachmentId(attachmentId);
    setShowDeleteDialog(true);
  };

  // Show version history dialog
  const showVersions = (fileId: number) => {
    setSelectedFileId(fileId);
    setShowVersionHistory(true);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  // Empty state
  if (attachments.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <FileIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No files attached</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn('space-y-4', className)}>
        {/* Error display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Files table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Scan Status</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Uploaded At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attachments.map((attachment) => {
                const file = attachment.file;
                if (!file) return null;

                const Icon = getFileIcon(file.mimeType);
                const uploadedBy =
                  file.uploadedByUser?.name || `User #${file.uploadedBy}`;
                const uploadedAt = format(
                  new Date(file.uploadedAt),
                  'MMM d, yyyy h:mm a'
                );

                return (
                  <TableRow key={attachment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{file.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {file.mimeType}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(file.fileSize)}</TableCell>
                    <TableCell>
                      <VirusScanBadge status={file.virusScanStatus} />
                    </TableCell>
                    <TableCell>{uploadedBy}</TableCell>
                    <TableCell>{uploadedAt}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {/* Version history button */}
                        {file.version > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => showVersions(file.id)}
                            title="View version history"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Download button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(file.id, file.filename)}
                          disabled={
                            downloadingId === file.id ||
                            file.virusScanStatus === 'INFECTED'
                          }
                          title={
                            file.virusScanStatus === 'INFECTED'
                              ? 'Cannot download infected file'
                              : 'Download file'
                          }
                        >
                          <Download className="h-4 w-4" />
                        </Button>

                        {/* Detach button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmDetach(attachment.id)}
                          disabled={detachingId === attachment.id}
                          title="Detach file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detach file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the file attachment from this entity. The file will
              remain in storage and can be re-attached later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                selectedAttachmentId && handleDetach(selectedAttachmentId)
              }
              className="bg-red-600 hover:bg-red-700"
            >
              Detach
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Version history dialog */}
      {showVersionHistory && selectedFileId && (
        <FileVersionHistory
          fileId={selectedFileId}
          open={showVersionHistory}
          onClose={() => {
            setShowVersionHistory(false);
            setSelectedFileId(null);
          }}
        />
      )}
    </>
  );
};

export default FileList;
