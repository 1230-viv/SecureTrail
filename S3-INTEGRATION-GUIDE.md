# AWS S3 Integration Setup

## ✅ What's Been Implemented

Your SecureTrail application now has full AWS S3 integration! Here's what was added:

### 1. **Environment Configuration** ✅
Updated [Backend/.env](Backend/.env) with your AWS credentials:
- AWS Access Key ID: `AKIA5X72HHDLWM3AG6PU`
- AWS Secret Access Key: *(configured)*
- S3 Bucket: `securetrail-storage`
- AWS Region: `ap-south-1` (Mumbai)

### 2. **S3 Manager Utility** ✅
Created [Backend/Utils/s3_manager.py](Backend/Utils/s3_manager.py) with functions:
- `upload_file_to_s3()` - Upload any file to S3
- `upload_zip_to_s3()` - Upload ZIP files with metadata
- `create_and_upload_zip()` - Create ZIP from directory and upload
- `delete_from_s3()` - Delete objects from S3
- `get_s3_url()` - Generate S3 URLs

### 3. **Database Updates** ✅
- Added `s3_url` field to `ScanJob` model
- Updated `scan_repo.py` to support S3 URL storage
- Created migration: [alembic/versions/add_s3_url_to_scan_jobs.py](Backend/alembic/versions/add_s3_url_to_scan_jobs.py)

### 4. **Upload Route Enhancement** ✅
[Backend/Routes/upload.py](Backend/Routes/upload.py) now:
- Uploads user-submitted ZIP files to S3
- Stores S3 URL in database
- Keeps local copy for scanning
- Path: `s3://securetrail-storage/uploads/{job_id}/{filename}`

### 5. **Repository Route Enhancement** ✅
[Backend/Routes/repository.py](Backend/Routes/repository.py) now:
- Clones GitHub repositories
- **Automatically creates ZIP** of the cloned repo
- **Uploads ZIP to S3** before scanning
- Stores S3 URL in database
- Path: `s3://securetrail-storage/scans/{job_id}/{repo_name}_{timestamp}.zip`

### 6. **API Response Updates** ✅
[Backend/Routes/scan.py](Backend/Routes/scan.py) now includes `s3_url` in job listings

---

## 🚀 How to Use

### **Step 1: Run Database Migration**

Apply the new migration to add the `s3_url` column:

```bash
cd /home/parth219/Downloads/SecureTrail/Backend
conda activate securetrail
alembic upgrade head
```

### **Step 2: Verify S3 Bucket**

Make sure your S3 bucket `securetrail-storage` exists and is accessible:

```bash
# Test AWS credentials
aws s3 ls s3://securetrail-storage --region ap-south-1
```

If the bucket doesn't exist, create it:

```bash
aws s3 mb s3://securetrail-storage --region ap-south-1
```

### **Step 3: Start the Application**

```bash
# Terminal 1: Backend
./start-backend.sh

# Terminal 2: Frontend
./start-frontend.sh
```

---

## 📦 How It Works

### **For ZIP Uploads:**
1. User uploads ZIP file via frontend
2. Backend saves ZIP temporarily
3. **ZIP is uploaded to S3** at: `uploads/{job_id}/{filename}`
4. S3 URL is stored in database
5. ZIP is extracted and scanned locally
6. Results are stored with S3 reference

### **For GitHub Repositories:**
1. User selects GitHub repository
2. Backend clones repository
3. **Repository is zipped automatically**
4. **ZIP is uploaded to S3** at: `scans/{job_id}/{repo_name}_{timestamp}.zip`
5. S3 URL is stored in database
6. Repository is scanned locally
7. Results are stored with S3 reference

---

## 🔍 Verification

After running a scan, you can verify the S3 upload:

### Check S3 bucket:
```bash
aws s3 ls s3://securetrail-storage/uploads/ --recursive
aws s3 ls s3://securetrail-storage/scans/ --recursive
```

### Check database:
```sql
-- Connect to PostgreSQL
docker exec -it securetrail-postgres psql -U securetrail -d securetrail

-- View scan jobs with S3 URLs
SELECT id, repository_name, source_type, s3_url, created_at 
FROM scan_jobs 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check via API:
```bash
# List all jobs (should include s3_url field)
curl http://localhost:8000/api/scan/jobs
```

---

## 📁 S3 Bucket Structure

```
securetrail-storage/
├── uploads/                    # User-uploaded ZIP files
│   └── {job_id}/
│       └── {filename}_{timestamp}.zip
└── scans/                      # GitHub repository ZIPs
    └── {job_id}/
        └── {repo_name}_{timestamp}.zip
```

---

## 🔐 Security Notes

1. **Never commit .env file to Git** - Your AWS credentials are sensitive
2. **Rotate credentials regularly** - Consider using IAM roles instead
3. **Set bucket policies** - Restrict access to your AWS account only
4. **Enable versioning** - Protect against accidental deletions
5. **Enable encryption** - Use S3 server-side encryption

---

## 🎯 Next Steps (Optional)

### Enable S3 Lifecycle Policies:
Auto-delete old files after 30 days to save costs:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket securetrail-storage \
  --lifecycle-configuration file://s3-lifecycle.json
```

### Enable Bucket Versioning:
```bash
aws s3api put-bucket-versioning \
  --bucket securetrail-storage \
  --versioning-configuration Status=Enabled
```

### Enable Server-Side Encryption:
```bash
aws s3api put-bucket-encryption \
  --bucket securetrail-storage \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

---

## ✅ Testing Checklist

- [ ] Run database migration successfully
- [ ] Verify S3 bucket exists and is accessible
- [ ] Upload a ZIP file and verify it appears in S3
- [ ] Scan a GitHub repository and verify ZIP is created in S3
- [ ] Check database for s3_url values
- [ ] Verify S3 URLs are returned in API responses

---

## 🐛 Troubleshooting

### "NoSuchBucket" error:
```bash
# Create the bucket
aws s3 mb s3://securetrail-storage --region ap-south-1
```

### "AccessDenied" error:
- Verify AWS credentials in .env file
- Check IAM user has S3 permissions
- Verify bucket policy allows your account

### Migration fails:
```bash
# Check current migration state
alembic current

# If needed, manually upgrade
alembic upgrade head
```

### S3 upload fails but scan continues:
- This is by design - S3 upload is non-blocking
- Check logs for specific error messages
- Verify AWS credentials and bucket permissions

---

**Need Help?** Check the logs in real-time:
```bash
tail -f /home/parth219/Downloads/SecureTrail/Backend/logs/securetrail.log
```
