"""
AWS Bedrock Client — SecureTrail
Wraps boto3 bedrock-runtime for Claude invocations.
All configuration comes from environment variables.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from Utils.logger import get_logger

logger = get_logger("bedrock_client")


class BedrockPermanentError(RuntimeError):
    """
    Raised when the Bedrock error is permanent and will not be resolved by
    retrying — e.g. model access not approved, invalid credentials, quota exceeded.
    Callers should circuit-break immediately rather than retrying.
    """

# Error codes that are permanent (no point retrying any further calls)
_PERMANENT_ERROR_CODES = {
    "ResourceNotFoundException",      # model not approved / wrong model ID
    "AccessDeniedException",           # IAM permissions missing
    "UnauthorizedException",           # bad credentials
    "UnrecognizedClientException",     # invalid / expired security token
    "InvalidClientTokenId",            # key ID not valid
    "AuthFailure",                     # general auth failure
    "ValidationException",             # malformed request / model ID wrong format
    "ServiceQuotaExceededException",   # hard quota hit
}

# ──────────────────────────────────────────────────────────────────────────────
# Configuration — no hardcoded values
# ──────────────────────────────────────────────────────────────────────────────
AWS_REGION        = os.getenv("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID  = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")
MAX_TOKENS        = int(os.getenv("BEDROCK_MAX_TOKENS", "2048"))
TEMPERATURE       = float(os.getenv("BEDROCK_TEMPERATURE", "0.1"))   # low = deterministic
CONNECT_TIMEOUT   = int(os.getenv("BEDROCK_CONNECT_TIMEOUT", "10"))
READ_TIMEOUT      = int(os.getenv("BEDROCK_READ_TIMEOUT", "60"))


def _get_client() -> Any:
    """Create a boto3 bedrock-runtime client with tuned timeouts."""
    config = Config(
        region_name=AWS_REGION,
        connect_timeout=CONNECT_TIMEOUT,
        read_timeout=READ_TIMEOUT,
        retries={"max_attempts": 2, "mode": "standard"},
    )
    return boto3.client("bedrock-runtime", config=config)


def _is_claude(model_id: str) -> bool:
    return model_id.startswith("anthropic.")


def _build_body(system_prompt: str, user_message: str) -> Dict[str, Any]:
    """Build the request body based on the model provider."""
    if _is_claude(BEDROCK_MODEL_ID):
        return {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": MAX_TOKENS,
            "temperature": TEMPERATURE,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}],
        }
    else:
        # Llama / other models — use prompt format
        prompt = (
            f"<|begin_of_text|>"
            f"<|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|>"
            f"<|start_header_id|>user<|end_header_id|>\n\n{user_message}<|eot_id|>"
            f"<|start_header_id|>assistant<|end_header_id|>\n\n"
        )
        return {
            "prompt": prompt,
            "max_gen_len": MAX_TOKENS,
            "temperature": TEMPERATURE,
        }


def _parse_response(result: Dict[str, Any]) -> str:
    """Parse the response based on the model provider."""
    if _is_claude(BEDROCK_MODEL_ID):
        content = result.get("content", [])
        if content and isinstance(content, list):
            return content[0].get("text", "")
        return ""
    else:
        # Llama response
        return result.get("generation", "")


def invoke_claude(system_prompt: str, user_message: str) -> str:
    """
    Invoke a model via AWS Bedrock (supports Claude and Llama).
    Returns the response text content.
    Raises RuntimeError on API failure.
    """
    client = _get_client()
    body = _build_body(system_prompt, user_message)

    try:
        response = client.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )
        result = json.loads(response["body"].read())
        return _parse_response(result)

    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        logger.error(f"Bedrock ClientError [{error_code}]: {e}")
        if error_code in _PERMANENT_ERROR_CODES:
            raise BedrockPermanentError(
                f"Bedrock permanent error [{error_code}]: {e}"
            ) from e
        raise RuntimeError(f"Bedrock API error: {error_code}") from e
    except Exception as e:
        logger.error(f"Unexpected Bedrock error: {e}")
        raise RuntimeError(f"AI service unavailable: {e}") from e
