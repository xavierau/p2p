import React, { useState, useEffect } from 'react';
import { FileIcon, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fileAttachmentService } from '@/services/fileAttachmentService';
import type { FileAttachment } from '@/types';
import { cn } from '@/lib/utils';

interface FilePreviewProps {
  fileId: number;
  className?: string;
}

/**
 * Previews file content based on MIME type.
 * Shows images inline, PDFs in iframe, and metadata for other types.
 */
const FilePreview: React.FC<FilePreviewProps> = ({ fileId, className }) => {
  const [file, setFile] = useState<FileAttachment | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch file metadata
        const fileData = await fileAttachmentService.getFileById(fileId);
        setFile(fileData);

        // Get download URL for preview
        if (
          fileData.virusScanStatus === 'CLEAN' ||
          fileData.virusScanStatus === 'PENDING'
        ) {
          const { downloadUrl: url } = await fileAttachmentService.getDownloadUrl(
            fileId
          );
          setDownloadUrl(url);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load file';
        setError(errorMessage);
        console.error('File preview error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [fileId]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error || !file) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <p>{error || 'File not found'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Infected file warning
  if (file.virusScanStatus === 'INFECTED') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">
            Infected File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <p>This file has been flagged as potentially harmful and cannot be previewed.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader>
        <CardTitle className="text-base">{file.filename}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Image preview */}
        {isImage && downloadUrl && (
          <img
            src={downloadUrl}
            alt={file.filename}
            className="max-w-full h-auto rounded-md"
          />
        )}

        {/* PDF preview */}
        {isPdf && downloadUrl && (
          <iframe
            src={downloadUrl}
            className="w-full h-[600px] border rounded-md"
            title={file.filename}
          />
        )}

        {/* Other file types - show metadata */}
        {!isImage && !isPdf && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileIcon className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{file.filename}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {file.mimeType}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Version {file.version}
            </p>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={file.filename}
                className="mt-4 text-primary hover:underline"
              >
                Download to view
              </a>
            )}
          </div>
        )}

        {/* No download URL available */}
        {!downloadUrl && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>Preview not available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FilePreview;
