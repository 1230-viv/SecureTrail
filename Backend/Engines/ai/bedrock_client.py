"""
AWS Bedrock Client — SecureTrail
Wraps boto3 bedrock-runtime for model invocations (Llama 3 / Claude).
All configuration comes from environment variables.
"""

from __future__ import annotations

import json
import os
import time
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
BEDROCK_REGION    = os.getenv("BEDROCK_REGION", AWS_REGION)  # dedicated region for Bedrock (may differ from S3/default)
BEDROCK_MODEL_ID  = os.getenv("BEDROCK_MODEL_ID", "meta.llama3-70b-instruct-v1:0")
MAX_TOKENS        = int(os.getenv("BEDROCK_MAX_TOKENS", "1400"))
TEMPERATURE       = float(os.getenv("BEDROCK_TEMPERATURE", "0.15"))  # low temp = less hallucination
TOP_P             = float(os.getenv("BEDROCK_TOP_P", "0.85"))
CONNECT_TIMEOUT   = int(os.getenv("BEDROCK_CONNECT_TIMEOUT", "10"))
READ_TIMEOUT      = int(os.getenv("BEDROCK_READ_TIMEOUT", "60"))

# Reusable client singleton (avoid creating a new client per call)
_client_instance = None


def _get_client() -> Any:
    """Get or create a boto3 bedrock-runtime client with tuned timeouts."""
    global _client_instance
    if _client_instance is None:
        config = Config(
            region_name=BEDROCK_REGION,
            connect_timeout=CONNECT_TIMEOUT,
            read_timeout=READ_TIMEOUT,
            retries={"max_attempts": 2, "mode": "standard"},
        )
        _client_instance = boto3.client("bedrock-runtime", config=config)
    return _client_instance


def _is_claude(model_id: str) -> bool:
    # Handles direct IDs (anthropic.*), cross-region (us./eu./ap./apac. prefixes), and full ARNs
    return "anthropic." in model_id


def _is_nova(model_id: str) -> bool:
    # Amazon Nova models (direct IDs and inference profile ARNs)
    return "amazon.nova" in model_id


def _build_body(
    system_prompt: str,
    user_message: str,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> Dict[str, Any]:
    """Build the request body based on the model provider.
    Per-call overrides fall back to the global env defaults."""
    _temp = temperature if temperature is not None else TEMPERATURE
    _max = max_tokens if max_tokens is not None else MAX_TOKENS

    if _is_claude(BEDROCK_MODEL_ID):
        return {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": _max,
            "temperature": _temp,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}],
        }
    elif _is_nova(BEDROCK_MODEL_ID):
        # Amazon Nova Converse-style body
        return {
            "messages": [{"role": "user", "content": [{"text": user_message}]}],
            "system": [{"text": system_prompt}],
            "inferenceConfig": {
                "maxTokens": _max,
                "temperature": _temp,
                "topP": TOP_P,
            },
        }
    else:
        # Llama 3 Instruct format
        prompt = (
            f"<|begin_of_text|>"
            f"<|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|>"
            f"<|start_header_id|>user<|end_header_id|>\n\n{user_message}<|eot_id|>"
            f"<|start_header_id|>assistant<|end_header_id|>\n\n"
        )
        return {
            "prompt": prompt,
            "max_gen_len": _max,
            "temperature": _temp,
            "top_p": TOP_P,
        }


def _parse_response(result: Dict[str, Any]) -> str:
    """Parse the response based on the model provider."""
    if _is_claude(BEDROCK_MODEL_ID):
        content = result.get("content", [])
        if content and isinstance(content, list):
            return content[0].get("text", "")
        return ""
    elif _is_nova(BEDROCK_MODEL_ID):
        # Nova response: {"output": {"message": {"content": [{"text": "..."}]}}}
        # Content may contain multiple items (e.g. reasoning + text); find the text block.
        try:
            content = result["output"]["message"]["content"]
            for item in content:
                if "text" in item:
                    return item["text"]
            logger.warning("Nova: no text block found in content: %s", content)
            return ""
        except (KeyError, IndexError, TypeError) as exc:
            logger.warning("Nova parse error: %s | raw result keys: %s", exc, list(result.keys()))
            return ""
    else:
        # Llama response
        return result.get("generation", "")


def invoke_claude(
    system_prompt: str,
    user_message: str,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    """
    Invoke a model via AWS Bedrock (supports Claude and Llama).
    Optional temperature / max_tokens override the global defaults
    to allow per-layer tuning in the 4-layer chain.
    Returns the response text content.
    Raises BedrockPermanentError on non-retryable failures.
    Raises RuntimeError on transient API failures.
    """
    client = _get_client()
    body = _build_body(system_prompt, user_message, temperature, max_tokens)

    t0 = time.monotonic()
    try:
        response = client.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )
        result = json.loads(response["body"].read())
        text = _parse_response(result)
        if not text:
            raise RuntimeError(
                f"Bedrock returned empty response text. Raw keys: {list(result.keys())}"
            )
        elapsed = (time.monotonic() - t0) * 1000
        logger.info(
            f"Bedrock OK — model={BEDROCK_MODEL_ID}, "
            f"latency={elapsed:.0f}ms, response_len={len(text)}"
        )
        return text

    except ClientError as e:
        elapsed = (time.monotonic() - t0) * 1000
        error_code = e.response["Error"]["Code"]
        logger.error(
            f"Bedrock ClientError [{error_code}] after {elapsed:.0f}ms: {e}"
        )
        if error_code in _PERMANENT_ERROR_CODES:
            raise BedrockPermanentError(
                f"Bedrock permanent error [{error_code}]: {e}"
            ) from e
        raise RuntimeError(f"Bedrock API error: {error_code}") from e
    except Exception as e:
        elapsed = (time.monotonic() - t0) * 1000
        logger.error(f"Unexpected Bedrock error after {elapsed:.0f}ms: {e}")
        raise RuntimeError(f"AI service unavailable: {e}") from e
