/**
 * Interface for S3-compatible storage providers.
 * Abstracts the storage implementation to allow for different providers (AWS, MinIO, etc.)
 * or testing with mocks.
 */
export interface IS3StorageProvider {
  /**
   * Uploads a file buffer to S3 storage.
   * @param key - S3 object key
   * @param buffer - File content as Buffer
   * @param contentType - MIME type
   * @returns Promise resolving when upload is complete
   * @throws Error if upload fails
   */
  upload(key: string, buffer: Buffer, contentType: string): Promise<void>;

  /**
   * Downloads a file from S3 storage.
   * @param key - S3 object key
   * @returns Promise resolving to file content as Buffer
   * @throws Error if download fails or file not found
   */
  download(key: string): Promise<Buffer>;

  /**
   * Generates a presigned URL for uploading a file.
   * Allows clients to upload directly to S3 without going through the server.
   * @param key - S3 object key
   * @param contentType - MIME type
   * @param expiresIn - URL expiration time in seconds (default: 3600)
   * @returns Promise resolving to presigned upload URL
   * @throws Error if URL generation fails
   */
  getPresignedUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<string>;

  /**
   * Generates a presigned URL for downloading a file.
   * Allows clients to download directly from S3 with temporary access.
   * @param key - S3 object key
   * @param expiresIn - URL expiration time in seconds (default: 3600)
   * @returns Promise resolving to presigned download URL
   * @throws Error if URL generation fails
   */
  getPresignedDownloadUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Deletes a file from S3 storage.
   * @param key - S3 object key
   * @returns Promise resolving when deletion is complete
   * @throws Error if deletion fails
   */
  delete(key: string): Promise<void>;

  /**
   * Checks if a file exists in S3 storage.
   * @param key - S3 object key
   * @returns Promise resolving to true if file exists, false otherwise
   */
  exists(key: string): Promise<boolean>;

  /**
   * Gets metadata about a file without downloading it.
   * @param key - S3 object key
   * @returns Promise resolving to file metadata
   * @throws Error if file not found
   */
  getMetadata(key: string): Promise<{
    contentType: string;
    contentLength: number;
    lastModified: Date;
  }>;
}
