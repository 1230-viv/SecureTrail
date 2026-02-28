#!/usr/bin/env python3
"""
Test AWS Bedrock Access for SecureTrail
Verifies Claude 3 Sonnet model access before enabling AI features.
"""

import os
import sys
import json
from pathlib import Path

# Add Backend to path
backend_dir = Path(__file__).parent / "Backend"
sys.path.insert(0, str(backend_dir))

# Load environment variables
from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


def test_aws_credentials():
    """Test if AWS credentials are valid."""
    print("🔑 Testing AWS Credentials...")
    try:
        sts = boto3.client('sts')
        identity = sts.get_caller_identity()
        print(f"   ✅ AWS Account: {identity['Account']}")
        print(f"   ✅ User ARN: {identity['Arn']}")
        return True
    except ClientError as e:
        print(f"   ❌ AWS Credentials Invalid: {e}")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def test_bedrock_access():
    """Test if Bedrock service is accessible in the region."""
    print("\n🌐 Testing Bedrock Service Access...")
    
    region = os.getenv("AWS_REGION", "ap-south-1")
    print(f"   Region: {region}")
    
    try:
        bedrock = boto3.client('bedrock', region_name=region)
        
        # List available foundation models
        response = bedrock.list_foundation_models()
        models = response.get('modelSummaries', [])
        
        print(f"   ✅ Bedrock service accessible")
        print(f"   ✅ Found {len(models)} foundation models")
        
        # Check for Claude models
        claude_models = [m for m in models if 'claude' in m['modelId'].lower()]
        if claude_models:
            print(f"   ✅ Found {len(claude_models)} Claude models")
            for model in claude_models[:3]:
                print(f"      - {model['modelId']}")
        else:
            print("   ⚠️  No Claude models found")
        
        return True
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'AccessDeniedException':
            print(f"   ❌ Access Denied: Your IAM user needs bedrock:ListFoundationModels permission")
        else:
            print(f"   ❌ Error [{error_code}]: {e}")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def test_claude_model_access():
    """Test if Claude 3 Sonnet model is accessible."""
    print("\n🤖 Testing Claude 3 Sonnet Model Access...")
    
    region = os.getenv("AWS_REGION", "ap-south-1")
    model_id = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")
    
    print(f"   Model: {model_id}")
    print(f"   Region: {region}")
    
    config = Config(
        region_name=region,
        connect_timeout=10,
        read_timeout=30,
        retries={"max_attempts": 1, "mode": "standard"},
    )
    
    try:
        bedrock_runtime = boto3.client('bedrock-runtime', config=config)
        
        # Build request body based on model provider
        if model_id.startswith("anthropic."):
            body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 100,
                "temperature": 0.1,
                "system": "You are a helpful assistant.",
                "messages": [
                    {"role": "user", "content": "Say 'Hello from SecureTrail!' in 5 words or less."}
                ],
            }
        else:
            # Llama / other models
            body = {
                "prompt": (
                    "<|begin_of_text|>"
                    "<|start_header_id|>system<|end_header_id|>\n\nYou are a helpful assistant.<|eot_id|>"
                    "<|start_header_id|>user<|end_header_id|>\n\nSay 'Hello from SecureTrail!' in 5 words or less.<|eot_id|>"
                    "<|start_header_id|>assistant<|end_header_id|>\n\n"
                ),
                "max_gen_len": 100,
                "temperature": 0.1,
            }
        
        print("   🔄 Invoking model...")
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )
        
        result = json.loads(response["body"].read())

        # Parse response based on model provider
        if model_id.startswith("anthropic."):
            content = result.get("content", [])
            if content and isinstance(content, list):
                response_text = content[0].get("text", "")
            else:
                print(f"   ⚠️  Unexpected response format: {result}")
                return False
        else:
            response_text = result.get("generation", "")
            if not response_text:
                print(f"   ⚠️  Unexpected response format: {result}")
                return False

        print(f"   ✅ Model response: {response_text}")
        print(f"   ✅ Model is WORKING!")
        return True
            
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        
        if error_code == 'ResourceNotFoundException':
            print(f"   ❌ Model Not Found: {error_msg}")
            print(f"   💡 The model might not be available in region '{region}'")
            print(f"   💡 Try region 'us-east-1' or 'us-west-2'")
        elif error_code == 'AccessDeniedException':
            print(f"   ❌ Access Denied: {error_msg}")
            print(f"   💡 You need to request model access in AWS Console:")
            print(f"   💡 1. Go to: https://console.aws.amazon.com/bedrock")
            print(f"   💡 2. Navigate to: Model access")
            print(f"   💡 3. Request access for: Claude 3 Sonnet")
            print(f"   💡 4. Wait for approval (usually instant for Claude)")
        elif error_code in ['ThrottlingException', 'ServiceQuotaExceededException']:
            print(f"   ❌ Rate Limit: {error_msg}")
            print(f"   💡 Your account has hit API limits")
        else:
            print(f"   ❌ Error [{error_code}]: {error_msg}")
        
        return False
    except Exception as e:
        print(f"   ❌ Unexpected error: {e}")
        return False


def check_env_configuration():
    """Check environment configuration."""
    print("\n⚙️  Checking Configuration...")
    
    required_vars = {
        "AWS_ACCESS_KEY_ID": os.getenv("AWS_ACCESS_KEY_ID"),
        "AWS_SECRET_ACCESS_KEY": os.getenv("AWS_SECRET_ACCESS_KEY"),
        "AWS_REGION": os.getenv("AWS_REGION"),
        "BEDROCK_MODEL_ID": os.getenv("BEDROCK_MODEL_ID"),
        "AI_ENABLED": os.getenv("AI_ENABLED"),
    }
    
    all_set = True
    for var, value in required_vars.items():
        if value and not value.startswith("your_"):
            if var == "AWS_SECRET_ACCESS_KEY":
                print(f"   ✅ {var}: ****{value[-4:]}")
            else:
                print(f"   ✅ {var}: {value}")
        else:
            print(f"   ❌ {var}: Not set or placeholder")
            all_set = False
    
    return all_set


def estimate_costs():
    """Provide cost estimates for AI usage."""
    print("\n💰 AWS Bedrock Cost Estimates:")
    print("   Claude 3 Sonnet Pricing (as of 2024):")
    print("   - Input: $0.003 per 1K tokens (~750 words)")
    print("   - Output: $0.015 per 1K tokens")
    print()
    print("   Typical SecureTrail usage per scan:")
    print("   - Input: ~500 tokens per vulnerability")
    print("   - Output: ~300 tokens per explanation")
    print("   - Cost per vuln: ~$0.006 (less than 1 cent)")
    print()
    print("   Example project with 10 HIGH/CRITICAL findings:")
    print("   - Estimated cost: ~$0.06 per scan")
    print()
    print("   ✅ Cost optimizations already configured:")
    print("   - Only analyzes HIGH/CRITICAL (score >= 7.0)")
    print("   - Max 3 concurrent API calls (anti-throttle)")
    print("   - Temperature 0.1 (deterministic, no retries)")
    print()


def main():
    print("=" * 70)
    print("🛡️  SecureTrail - AWS Bedrock Access Test")
    print("=" * 70)
    
    # Step 1: Check configuration
    if not check_env_configuration():
        print("\n❌ Configuration incomplete. Fix .env file first.")
        return False
    
    # Step 2: Test AWS credentials
    if not test_aws_credentials():
        print("\n❌ AWS credentials test failed.")
        return False
    
    # Step 3: Test Bedrock access
    if not test_bedrock_access():
        print("\n⚠️  Bedrock service test failed (non-critical).")
    
    # Step 4: Test Claude model
    if not test_claude_model_access():
        print("\n❌ Claude model access test failed.")
        print("\n📋 Next Steps:")
        print("   1. Request model access in AWS Console")
        print("   2. Verify region supports Claude 3 Sonnet")
        print("   3. Check IAM permissions")
        return False
    
    # Step 5: Show cost estimates
    estimate_costs()
    
    # Success!
    print("\n" + "=" * 70)
    print("✅ ALL TESTS PASSED - AI FEATURES READY!")
    print("=" * 70)
    print("\nTo enable AI features:")
    print("   1. Edit Backend/.env")
    print("   2. Set: AI_ENABLED=true")
    print("   3. Restart backend")
    print()
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
