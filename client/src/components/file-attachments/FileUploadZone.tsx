import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File as FileIcon, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { uploadFile } from '@/services/fileAttachmentService';
import type { FileAttachment, AttachableEntityType } from '@/types';
import { cn } from '@/lib/utils';
import { fileAttachmentService } from '@/services/fileAttachmentService';

interface FileUploadZoneProps {
  entityType: AttachableEntityType;
  entityId: number;
  onUploadComplete?: (file: FileAttachment) => void;
  onError?: (error: string) => void;
  maxFileSize?: number; // in bytes
  multiple?: boolean;
  className?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  error?: string;
  fileAttachment?: FileAttachment;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB default

/**
 * Formats file size in human-readable format
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Drag-and-drop file upload component with progress tracking.
 * Calculates SHA-256 checksum and uploads directly to S3.
 */
const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  entityType,
  entityId,
  onUploadComplete,
  onError,
  maxFileSize = MAX_FILE_SIZE,
  multiple = true,
  className,
}) => {
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(
    new Map()
  );
  const [isAttaching, setIsAttaching] = useState(false);

  // Handle file upload and attachment
  const handleFileUpload = useCallback(
    async (file: File) => {
      const fileKey = `${file.name}-${file.size}-${Date.now()}`;

      // Validate file size
      if (file.size > maxFileSize) {
        const error = `File size exceeds ${formatFileSize(maxFileSize)} limit`;
        setUploadingFiles((prev) =>
          new Map(prev).set(fileKey, { file, progress: 0, error })
        );
        onError?.(error);
        return;
      }

      // Initialize upload state
      setUploadingFiles((prev) =>
        new Map(prev).set(fileKey, { file, progress: 0 })
      );

      try {
        // Upload file to S3 and create FileAttachment record
        const fileAttachment = await uploadFile(file, (progress) => {
          setUploadingFiles((prev) => {
            const updated = new Map(prev);
            const current = updated.get(fileKey);
            if (current) {
              updated.set(fileKey, { ...current, progress });
            }
            return updated;
          });
        });

        // Update state with completed upload
        setUploadingFiles((prev) => {
          const updated = new Map(prev);
          const current = updated.get(fileKey);
          if (current) {
            updated.set(fileKey, { ...current, progress: 100, fileAttachment });
          }
          return updated;
        });

        // Attach file to entity
        setIsAttaching(true);
        await fileAttachmentService.attachFile({
          fileId: fileAttachment.id,
          entityType,
          entityId,
        });

        onUploadComplete?.(fileAttachment);

        // Remove from uploading list after 2 seconds
        setTimeout(() => {
          setUploadingFiles((prev) => {
            const updated = new Map(prev);
            updated.delete(fileKey);
            return updated;
          });
        }, 2000);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';
        setUploadingFiles((prev) => {
          const updated = new Map(prev);
          const current = updated.get(fileKey);
          if (current) {
            updated.set(fileKey, { ...current, error: errorMessage });
          }
          return updated;
        });
        onError?.(errorMessage);
      } finally {
        setIsAttaching(false);
      }
    },
    [entityType, entityId, maxFileSize, onUploadComplete, onError]
  );

  // Handle dropped files
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach(handleFileUpload);
    },
    [handleFileUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    maxSize: maxFileSize,
  });

  // Remove file from upload list
  const removeFile = (fileKey: string) => {
    setUploadingFiles((prev) => {
      const updated = new Map(prev);
      updated.delete(fileKey);
      return updated;
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop zone */}
      <Card
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-10 w-10 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-sm text-primary font-medium">
              Drop files here...
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Drag and drop files here, or click to select
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum file size: {formatFileSize(maxFileSize)}
              </p>
            </>
          )}
        </div>
      </Card>

      {/* Upload progress list */}
      {uploadingFiles.size > 0 && (
        <div className="space-y-2">
          {Array.from(uploadingFiles.entries()).map(([key, uploadFile]) => (
            <Card key={key} className="p-4">
              <div className="flex items-center gap-3">
                <FileIcon className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium truncate">
                      {uploadFile.file.name}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={() => removeFile(key)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {formatFileSize(uploadFile.file.size)} •{' '}
                    {uploadFile.file.type || 'Unknown type'}
                  </p>

                  {/* Progress bar */}
                  {!uploadFile.error && uploadFile.progress < 100 && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadFile.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Success state */}
                  {uploadFile.progress === 100 && !uploadFile.error && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {isAttaching
                        ? 'Attaching to entity...'
                        : 'Upload complete!'}
                    </p>
                  )}

                  {/* Error state */}
                  {uploadFile.error && (
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3 w-3" />
                      <p className="text-xs">{uploadFile.error}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUploadZone;
