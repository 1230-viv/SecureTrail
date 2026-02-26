#!/bin/bash
# S3 Integration Test Script

echo "🔍 Checking S3 Integration Setup..."
echo ""

# Check if backend directory exists
if [ ! -d "Backend" ]; then
    echo "❌ Backend directory not found. Run this script from SecureTrail root."
    exit 1
fi

cd Backend

echo "✅ Step 1: Checking environment file..."
if [ -f ".env" ]; then
    if grep -q "S3_BUCKET_NAME=securetrail-storage" .env; then
        echo "   ✓ S3 bucket configured"
    else
        echo "   ⚠️  S3_BUCKET_NAME not found in .env"
    fi
    
    if grep -q "AWS_ACCESS_KEY_ID" .env && ! grep -q "AWS_ACCESS_KEY_ID=your_aws" .env; then
        echo "   ✓ AWS credentials configured"
    else
        echo "   ⚠️  AWS credentials need to be configured"
    fi
else
    echo "   ❌ .env file not found"
    exit 1
fi

echo ""
echo "✅ Step 2: Checking required files..."

required_files=(
    "Utils/s3_manager.py"
    "Routes/upload.py"
    "Routes/repository.py"
    "Database/models.py"
    "pipeline.py"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✓ $file exists"
    else
        echo "   ❌ $file missing"
    fi
done

echo ""
echo "✅ Step 3: Checking database migration..."
if [ -f "alembic/versions/add_s3_url_to_scan_jobs.py" ]; then
    echo "   ✓ S3 URL migration file exists"
else
    echo "   ❌ Migration file missing"
fi

echo ""
echo "✅ Step 4: Checking boto3 in requirements.txt..."
if grep -q "boto3" requirements.txt; then
    echo "   ✓ boto3 listed in requirements.txt"
else
    echo "   ❌ boto3 missing from requirements.txt"
fi

echo ""
echo "✅ Step 5: Code syntax check..."
python_files=(
    "Utils/s3_manager.py"
    "Routes/upload.py"
    "Routes/repository.py"
    "pipeline.py"
)

syntax_errors=0
for file in "${python_files[@]}"; do
    if [ -f "$file" ]; then
        if python -m py_compile "$file" 2>/dev/null; then
            echo "   ✓ $file - syntax OK"
        else
            echo "   ❌ $file - syntax error"
            syntax_errors=$((syntax_errors + 1))
        fi
    fi
done

echo ""
if [ $syntax_errors -eq 0 ]; then
    echo "✅ All syntax checks passed!"
else
    echo "⚠️  Found $syntax_errors file(s) with syntax errors"
fi

echo ""
echo "📋 Next Steps:"
echo "   1. Run database migration: alembic upgrade head"
echo "   2. Verify S3 bucket exists: aws s3 ls s3://securetrail-storage"
echo "   3. Configure S3 lifecycle rule (see S3-ARCHIVE-GUIDE.md)"
echo "   4. Start the backend: ./start-backend.sh"
echo "   5. Test with a scan"
echo ""
