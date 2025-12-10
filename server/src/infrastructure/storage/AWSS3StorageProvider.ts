import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IS3StorageProvider } from './IS3StorageProvider';
import { S3Config, validateS3Config } from './S3Config';

/**
 * AWS S3 implementation of IS3StorageProvider.
 * Uses AWS SDK v3 for S3 operations.
 * Supports both AWS S3 and S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
 */
export class AWSS3StorageProvider implements IS3StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3Config) {
    validateS3Config(config);

    const clientConfig: any = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };

    // Add endpoint and force path style for S3-compatible services
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
      clientConfig.forcePathStyle = config.forcePathStyle ?? true;
    }

    this.client = new S3Client(clientConfig);
    this.bucket = config.bucket;
  }

  /**
   * Uploads a file buffer to S3 storage.
   */
  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: 'AES256', // Enable server-side encryption
      });

      await this.client.send(command);
    } catch (error) {
      if (error instanceof S3ServiceException) {
        throw new Error(`Failed to upload file to S3: ${error.message}`);
      }
      throw new Error(`Failed to upload file to S3: ${(error as Error).message}`);
    }
  }

  /**
   * Downloads a file from S3 storage.
   */
  async download(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error(`File ${key} has no content`);
      }

      // Convert ReadableStream to Buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      if (error instanceof S3ServiceException) {
        if (error.name === 'NoSuchKey') {
          throw new Error(`File not found: ${key}`);
        }
        throw new Error(`Failed to download file from S3: ${error.message}`);
      }
      throw new Error(`Failed to download file from S3: ${(error as Error).message}`);
    }
  }

  /**
   * Generates a presigned URL for uploading a file.
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      throw new Error(`Failed to generate presigned upload URL: ${(error as Error).message}`);
    }
  }

  /**
   * Generates a presigned URL for downloading a file.
   */
  async getPresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      throw new Error(`Failed to generate presigned download URL: ${(error as Error).message}`);
    }
  }

  /**
   * Deletes a file from S3 storage.
   */
  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      if (error instanceof S3ServiceException) {
        throw new Error(`Failed to delete file from S3: ${error.message}`);
      }
      throw new Error(`Failed to delete file from S3: ${(error as Error).message}`);
    }
  }

  /**
   * Checks if a file exists in S3 storage.
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if (error instanceof S3ServiceException) {
        if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
          return false;
        }
      }
      // Other errors should be thrown
      throw new Error(`Failed to check file existence: ${(error as Error).message}`);
    }
  }

  /**
   * Gets metadata about a file without downloading it.
   */
  async getMetadata(key: string): Promise<{
    contentType: string;
    contentLength: number;
    lastModified: Date;
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
      };
    } catch (error) {
      if (error instanceof S3ServiceException) {
        if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
          throw new Error(`File not found: ${key}`);
        }
        throw new Error(`Failed to get file metadata: ${error.message}`);
      }
      throw new Error(`Failed to get file metadata: ${(error as Error).message}`);
    }
  }

  /**
   * Closes the S3 client connection.
   * Should be called when the application shuts down.
   */
  destroy(): void {
    this.client.destroy();
  }
}
