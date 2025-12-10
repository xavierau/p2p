# Infrastructure Layer Setup Guide

This guide covers the setup and configuration required for the infrastructure layer.

## Required Dependencies

Install the following npm packages:

```bash
# AWS SDK v3 for S3 operations
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Already installed (verify in package.json):
# - @prisma/client
# - crypto (Node.js built-in)
```

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Database (already configured)
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# AWS S3 Configuration
AWS_REGION="us-east-1"                    # AWS region
S3_BUCKET="your-bucket-name"              # S3 bucket for file storage
AWS_ACCESS_KEY_ID="your-access-key"       # AWS access key ID
AWS_SECRET_ACCESS_KEY="your-secret-key"   # AWS secret access key

# Optional: For S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
S3_ENDPOINT="https://s3.example.com"      # Custom S3 endpoint
S3_FORCE_PATH_STYLE="true"                # Required for MinIO
```

## Database Migration

The Prisma schema includes tables for DeliveryNote and FileAttachment. If you haven't already applied the schema:

```bash
cd server
npx prisma db push       # Apply schema to database
npx prisma generate      # Regenerate Prisma client
```

## S3 Bucket Setup

### Option 1: AWS S3

1. **Create S3 Bucket:**
   ```bash
   aws s3 mb s3://your-bucket-name --region us-east-1
   ```

2. **Configure CORS (for presigned URLs):**
   ```json
   {
     "CORSRules": [
       {
         "AllowedOrigins": ["http://localhost:5173", "https://yourdomain.com"],
         "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
         "AllowedHeaders": ["*"],
         "MaxAgeSeconds": 3600
       }
     ]
   }
   ```

3. **Enable Encryption:**
   Server-side encryption is automatically enabled in the code (AES256).

4. **Set Lifecycle Policy (optional):**
   Configure automatic deletion of old files or transition to cheaper storage tiers.

### Option 2: MinIO (Local Development)

1. **Install MinIO:**
   ```bash
   # macOS
   brew install minio/stable/minio

   # Ubuntu/Debian
   wget https://dl.min.io/server/minio/release/linux-amd64/minio
   chmod +x minio
   sudo mv minio /usr/local/bin/
   ```

2. **Start MinIO:**
   ```bash
   minio server ~/minio-data
   ```

3. **Configure Environment:**
   ```bash
   S3_ENDPOINT="http://localhost:9000"
   S3_FORCE_PATH_STYLE="true"
   AWS_ACCESS_KEY_ID="minioadmin"
   AWS_SECRET_ACCESS_KEY="minioadmin"
   AWS_REGION="us-east-1"
   S3_BUCKET="your-bucket"
   ```

4. **Create Bucket:**
   Access MinIO Console at http://localhost:9000 and create a bucket.

## Application Initialization

Add the following to your application startup code:

```typescript
// src/index.ts or server startup file

import {
  PrismaDeliveryNoteRepository,
  PrismaFileAttachmentRepository,
  AWSS3StorageProvider,
  FileUploadedSubscriber,
  loadS3Config,
} from './infrastructure';
import pubsub from './services/pubsub';

// Initialize S3 storage
const s3Config = loadS3Config();
export const s3Storage = new AWSS3StorageProvider(s3Config);

// Initialize repositories
export const deliveryNoteRepository = new PrismaDeliveryNoteRepository();
export const fileAttachmentRepository = new PrismaFileAttachmentRepository();

// Subscribe to file upload events
const fileUploadedSubscriber = new FileUploadedSubscriber(pubsub);
fileUploadedSubscriber.subscribe();

// Graceful shutdown
process.on('SIGTERM', () => {
  s3Storage.destroy();
  process.exit(0);
});
```

## Testing the Setup

### Test S3 Connection

Create a test script to verify S3 connectivity:

```typescript
// scripts/test-s3.ts

import { AWSS3StorageProvider, loadS3Config } from '../src/infrastructure';

async function testS3() {
  try {
    const config = loadS3Config();
    console.log('S3 Config loaded:', {
      region: config.region,
      bucket: config.bucket,
      endpoint: config.endpoint,
    });

    const storage = new AWSS3StorageProvider(config);

    // Test upload
    const testKey = 'test/hello.txt';
    const testContent = Buffer.from('Hello from infrastructure layer!');
    await storage.upload(testKey, testContent, 'text/plain');
    console.log('✅ Upload successful');

    // Test exists
    const exists = await storage.exists(testKey);
    console.log('✅ File exists:', exists);

    // Test download
    const downloaded = await storage.download(testKey);
    console.log('✅ Download successful:', downloaded.toString());

    // Test delete
    await storage.delete(testKey);
    console.log('✅ Delete successful');

    storage.destroy();
    console.log('\n✅ All S3 tests passed!');
  } catch (error) {
    console.error('❌ S3 test failed:', error);
    process.exit(1);
  }
}

testS3();
```

Run the test:
```bash
npx ts-node scripts/test-s3.ts
```

### Test Database Connection

```typescript
// scripts/test-repositories.ts

import {
  PrismaDeliveryNoteRepository,
  PrismaFileAttachmentRepository,
} from '../src/infrastructure';

async function testRepositories() {
  try {
    const deliveryNoteRepo = new PrismaDeliveryNoteRepository();
    const fileRepo = new PrismaFileAttachmentRepository();

    // Test queries
    const deliveryNotes = await deliveryNoteRepo.findByStatus(
      DeliveryNoteStatus.createDraft()
    );
    console.log('✅ Delivery notes query successful:', deliveryNotes.length);

    const pendingScans = await fileRepo.findPendingScans();
    console.log('✅ File attachments query successful:', pendingScans.length);

    console.log('\n✅ All repository tests passed!');
  } catch (error) {
    console.error('❌ Repository test failed:', error);
    process.exit(1);
  }
}

testRepositories();
```

Run the test:
```bash
npx ts-node scripts/test-repositories.ts
```

## Troubleshooting

### Issue: AWS SDK Errors

**Error:** `Cannot find module '@aws-sdk/client-s3'`

**Solution:**
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Issue: S3 Connection Failed

**Error:** `Failed to upload file to S3`

**Checklist:**
1. Verify environment variables are loaded
2. Check AWS credentials are valid
3. Verify S3 bucket exists
4. Check IAM permissions (s3:PutObject, s3:GetObject, s3:DeleteObject)
5. For MinIO, verify server is running

### Issue: Prisma Type Errors

**Error:** Type mismatch with enums

**Solution:**
```bash
npx prisma generate  # Regenerate Prisma client after schema changes
```

### Issue: Database Connection Failed

**Error:** `Can't reach database server`

**Solution:**
1. Verify PostgreSQL is running
2. Check DATABASE_URL in .env
3. Test connection: `npx prisma db push`

## Security Checklist

Before deploying to production:

- [ ] Use IAM roles instead of access keys (if on AWS EC2/ECS)
- [ ] Enable S3 bucket encryption
- [ ] Configure S3 bucket policies to restrict access
- [ ] Set up S3 bucket versioning for file recovery
- [ ] Enable CloudTrail for S3 audit logging
- [ ] Use VPC endpoints for S3 (if in VPC)
- [ ] Set appropriate CORS policies
- [ ] Enable S3 access logging
- [ ] Configure lifecycle policies for old files
- [ ] Set up monitoring and alerts

## Performance Optimization

### Database Indexes

Verify all indexes are created:

```sql
-- Check indexes on delivery notes
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'DeliveryNote';

-- Check indexes on file attachments
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'FileAttachment';
```

### S3 Performance

- Use CloudFront CDN for frequently accessed files
- Enable S3 Transfer Acceleration for large file uploads
- Use multipart upload for files > 100MB
- Consider S3 Intelligent-Tiering for cost optimization

## Monitoring

Set up monitoring for:

1. **S3 Operations:**
   - Upload success rate
   - Download latency
   - Storage usage

2. **Database Operations:**
   - Query performance
   - Connection pool usage
   - Slow query log

3. **File Processing:**
   - Virus scan duration
   - Scan failure rate
   - Quarantine events

## Next Steps

1. Install AWS SDK dependencies
2. Configure environment variables
3. Run test scripts to verify setup
4. Integrate virus scanning (see infrastructure/events/subscribers/FileUploadedSubscriber.ts)
5. Set up monitoring and alerts
6. Configure backup strategy

## Support

For issues or questions:
1. Check the main README: `infrastructure/README.md`
2. Review domain layer documentation
3. Check Prisma documentation: https://www.prisma.io/docs
4. Check AWS SDK documentation: https://docs.aws.amazon.com/sdk-for-javascript/v3
