# 📦 S3 Archive & Lifecycle Management Guide

## 🔄 How Archive System Works

### **Automatic Archive Flow:**

```
1. User uploads ZIP / Scans GitHub repo
   ↓
2. ZIP uploaded to S3: scans/{job_id}/file.zip or uploads/{job_id}/file.zip
   ↓
3. Security scan runs (Semgrep, Trivy, Gitleaks)
   ↓
4. Scan completes successfully
   ↓
5. **ZIP automatically moved to archive/file.zip**
   ↓
6. S3 Lifecycle Rule: Delete after 7 days
   ↓
7. File auto-deleted (storage cost reduced!)
```

---

## 🗄️ Database Storage - Where S3 URLs Are Stored

### **Table: `scan_jobs`**

The S3 URL is stored in the `scan_jobs` table in the `s3_url` column:

| Column Name | Type | Description |
|------------|------|-------------|
| `id` | UUID | Primary key (job ID) |
| `repository_name` | String | Name of repository/project |
| `source_type` | String | "github" or "upload" |
| `s3_url` | **Text** | **⭐ S3 URL of the ZIP file** |
| `status` | String | Job status (queued, running, completed) |
| `created_at` | DateTime | When scan was created |
| `completed_at` | DateTime | When scan finished |

### **Example Data:**

```sql
SELECT id, repository_name, s3_url, status, created_at 
FROM scan_jobs 
WHERE s3_url IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 5;
```

**Sample Output:**
```
id                  | repository_name | s3_url                                                      | status    | created_at
--------------------|-----------------|-------------------------------------------------------------|-----------|------------------
abc-123-def-456     | my-app          | https://securetrail-storage.s3.ap-south-1.amazonaws.com/archive/my-app_20260227_143022.zip | completed | 2026-02-27 14:30:22
```

### **S3 URL Lifecycle:**

1. **Initial Upload:**
   - GitHub repos: `https://securetrail-storage.s3.ap-south-1.amazonaws.com/scans/{job_id}/repo_name.zip`
   - User uploads: `https://securetrail-storage.s3.ap-south-1.amazonaws.com/uploads/{job_id}/filename.zip`

2. **After Scan Completes:**
   - Moved to: `https://securetrail-storage.s3.ap-south-1.amazonaws.com/archive/filename.zip`
   - Database updated with new archive URL

3. **After 7 Days:**
   - S3 automatically deletes the file
   - Database still has the URL (for audit trail)

---

## ⚙️ S3 Lifecycle Rule Configuration

### **Step 1: Access AWS Console**

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Select bucket: `securetrail-storage`
3. Click **Management** tab
4. Click **Create lifecycle rule**

### **Step 2: Configure Rule**

#### **Rule Name:**
```
delete-archive-after-7-days
```

#### **Rule Scope:**
- Select: **Limit the scope of this rule using one or more filters**
- Prefix: `archive/`

This ensures only files in the `archive/` folder are affected.

#### **Lifecycle Rule Actions:**
✅ Check: **Expire current versions of objects**

#### **Number of Days:**
```
7
```

#### **Configuration Summary:**
- All files in `archive/` folder will be automatically deleted 7 days after creation
- Files in `scans/` and `uploads/` folders are NOT affected (only `archive/`)

### **Step 3: Create Rule**

Click **Create rule** button.

---

## 🖥️ AWS CLI Configuration (Alternative)

If you prefer command-line, create a file `lifecycle.json`:

```json
{
  "Rules": [
    {
      "Id": "delete-archive-after-7-days",
      "Filter": {
        "Prefix": "archive/"
      },
      "Status": "Enabled",
      "Expiration": {
        "Days": 7
      }
    }
  ]
}
```

Then apply it:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket securetrail-storage \
  --lifecycle-configuration file://lifecycle.json \
  --region ap-south-1
```

Verify:

```bash
aws s3api get-bucket-lifecycle-configuration \
  --bucket securetrail-storage \
  --region ap-south-1
```

---

## ✅ Verification & Testing

### **1. Check Database Storage:**

```sql
-- Connect to PostgreSQL
docker exec -it securetrail-postgres psql -U securetrail -d securetrail

-- View all S3 URLs
SELECT 
    id, 
    repository_name, 
    source_type,
    s3_url,
    status,
    created_at,
    completed_at
FROM scan_jobs 
WHERE s3_url IS NOT NULL
ORDER BY created_at DESC;

-- Count archived files
SELECT COUNT(*) as archived_files
FROM scan_jobs
WHERE s3_url LIKE '%archive/%';
```

### **2. Check S3 Bucket:**

```bash
# List all files in bucket
aws s3 ls s3://securetrail-storage/ --recursive --region ap-south-1

# List only archive folder
aws s3 ls s3://securetrail-storage/archive/ --region ap-south-1

# Check file age (for verification of 7-day deletion)
aws s3api list-objects-v2 \
  --bucket securetrail-storage \
  --prefix archive/ \
  --query 'Contents[*].[Key,LastModified]' \
  --output table \
  --region ap-south-1
```

### **3. Test Archive Flow:**

1. **Upload a test ZIP file:**
   ```bash
   # Via frontend or API
   curl -X POST http://localhost:8000/api/upload/zip \
     -F "file=@test.zip"
   ```

2. **Wait for scan to complete** (check status endpoint)

3. **Verify archive move:**
   ```bash
   # Check if file is in archive folder
   aws s3 ls s3://securetrail-storage/archive/ --region ap-south-1
   
   # File should NOT be in original location
   aws s3 ls s3://securetrail-storage/uploads/ --recursive --region ap-south-1
   ```

4. **Check database:**
   ```sql
   SELECT s3_url FROM scan_jobs WHERE repository_name = 'test' LIMIT 1;
   -- Should show: https://...amazonaws.com/archive/test_....zip
   ```

---

## 📊 S3 Bucket Structure

```
securetrail-storage/
│
├── uploads/                    # Initial upload location (temporary)
│   └── {job_id}/
│       └── filename.zip
│
├── scans/                      # GitHub repo scans (temporary)
│   └── {job_id}/
│       └── repo_name.zip
│
└── archive/                    # ⭐ Archived files (auto-delete after 7 days)
    ├── repo1_20260227_120000.zip    [Created: Feb 27, Deletes: Mar 6]
    ├── repo2_20260227_130000.zip    [Created: Feb 27, Deletes: Mar 6]
    └── upload_20260227_140000.zip    [Created: Feb 27, Deletes: Mar 6]
```

---

## 💡 Benefits of Archive System

1. **Cost Savings** 💰
   - Files automatically deleted after 7 days
   - Reduces S3 storage costs significantly
   - No manual cleanup needed

2. **Audit Trail** 📝
   - Database retains S3 URL even after file deletion
   - Can track what was scanned and when
   - Compliance and logging maintained

3. **Privacy & Security** 🔐
   - User code not stored permanently
   - Automatic cleanup ensures data is not kept longer than needed
   - GDPR/privacy-friendly

4. **Organized Storage** 📦
   - Clear separation: active scans vs. archived
   - Easy to identify old files
   - Prevents bucket clutter

---

## 🎯 API Response Example

When you query the `/api/scan/jobs` endpoint, you'll see:

```json
{
  "jobs": [
    {
      "job_id": "abc-123-def-456",
      "repository_name": "my-secure-app",
      "source_type": "github",
      "s3_url": "https://securetrail-storage.s3.ap-south-1.amazonaws.com/archive/my-secure-app_20260227_143022.zip",
      "status": "completed",
      "total_vulnerabilities": 5,
      "critical_count": 1,
      "high_count": 2,
      "created_at": "2026-02-27T14:30:22Z",
      "completed_at": "2026-02-27T14:32:15Z"
    }
  ]
}
```

Notice the `s3_url` field pointing to the `archive/` folder.

---

## 🔍 Monitoring & Alerts

### **CloudWatch Metrics (Optional):**

Track S3 storage and lifecycle deletions:

```bash
# View S3 metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name BucketSizeBytes \
  --dimensions Name=BucketName,Value=securetrail-storage Name=StorageType,Value=StandardStorage \
  --start-time 2026-02-20T00:00:00Z \
  --end-time 2026-02-27T23:59:59Z \
  --period 86400 \
  --statistics Average \
  --region ap-south-1
```

### **Set Up Alerts:**

1. Go to **CloudWatch → Alarms**
2. Create alarm for `NumberOfObjects` metric
3. Set threshold (e.g., alert if > 1000 files)
4. Configure SNS notification

---

## 🐛 Troubleshooting

### **Files Not Moving to Archive:**

**Check logs:**
```bash
# Backend logs
tail -f /tmp/securetrail_jobs/*/logs/*.log | grep -i archive
```

**Common issues:**
- S3 permissions missing (need `s3:CopyObject` and `s3:DeleteObject`)
- Network connectivity issues
- Invalid S3 URL in database

**Solution:**
```bash
# Test AWS credentials
aws s3 ls s3://securetrail-storage --region ap-south-1

# Check IAM permissions
aws iam get-user-policy --user-name your-user --policy-name your-policy
```

### **Lifecycle Rule Not Deleting Files:**

**Verify rule is active:**
```bash
aws s3api get-bucket-lifecycle-configuration \
  --bucket securetrail-storage \
  --region ap-south-1
```

**Check file age:**
```bash
# Files must be >7 days old
aws s3api list-objects-v2 \
  --bucket securetrail-storage \
  --prefix archive/ \
  --query 'Contents[*].[Key,LastModified]' \
  --region ap-south-1
```

**Note:** S3 lifecycle runs once per day at midnight UTC, so deletion may not be immediate.

### **Database Has S3 URL but File Doesn't Exist:**

This is **normal** after 7 days! The database keeps the URL for audit purposes, but S3 has deleted the file.

To verify:
```bash
# Try to download (should fail if deleted)
aws s3 cp s3://securetrail-storage/archive/old-file.zip ./ --region ap-south-1
# Error: The specified key does not exist.
```

---

## 📚 Summary

✅ **Archive System Implemented:**
- Files automatically move to `archive/` after scan completion
- Database tracks S3 URLs in `scan_jobs.s3_url` column
- S3 lifecycle rule deletes files after 7 days

✅ **Cost Efficient:**
- No manual cleanup needed
- Automatic storage management
- Reduces monthly S3 costs

✅ **Production Ready:**
- Non-blocking (archive failures don't affect scans)
- Comprehensive error handling
- Audit trail maintained in database

---

**Need Help?** Check the application logs for detailed archive operations:

```bash
grep -i "archive" /tmp/securetrail_jobs/*/logs/*.log
```
