#!/usr/bin/env python3
"""
Simple AI test — calls Bedrock Llama with a plain prompt.
Usage: python test-ai-simple.py
"""

import os, sys, json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / "Backend" / ".env")

import boto3
from botocore.config import Config

REGION   = os.getenv("AWS_REGION", "us-east-1")
MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "meta.llama3-8b-instruct-v1:0")


def ask_ai(question: str) -> str:
    """Send a question to Bedrock and return the answer."""
    client = boto3.client(
        "bedrock-runtime",
        config=Config(
            region_name=REGION,
            connect_timeout=10,
            read_timeout=60,
            retries={"max_attempts": 2, "mode": "standard"},
        ),
    )

    system = "You are a helpful tech educator. Answer clearly in 3-4 sentences."

    if MODEL_ID.startswith("anthropic."):
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 300,
            "temperature": 0.3,
            "system": system,
            "messages": [{"role": "user", "content": question}],
        }
    else:
        # Llama format
        body = {
            "prompt": (
                "<|begin_of_text|>"
                f"<|start_header_id|>system<|end_header_id|>\n\n{system}<|eot_id|>"
                f"<|start_header_id|>user<|end_header_id|>\n\n{question}<|eot_id|>"
                "<|start_header_id|>assistant<|end_header_id|>\n\n"
            ),
            "max_gen_len": 300,
            "temperature": 0.3,
        }

    print(f"  Model  : {MODEL_ID}")
    print(f"  Region : {REGION}")
    print(f"  Calling Bedrock...\n")

    response = client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body),
    )

    result = json.loads(response["body"].read())

    if MODEL_ID.startswith("anthropic."):
        return result.get("content", [{}])[0].get("text", "")
    else:
        return result.get("generation", "")


if __name__ == "__main__":
    print("=" * 60)
    print("  SecureTrail — Simple AI Test")
    print("=" * 60)

    prompts = [
        "Explain what AWS is and why developers use it.",
        "Explain what VS Code is and why it's popular among developers.",
    ]

    for i, q in enumerate(prompts, 1):
        print(f"\n--- Question {i} ---")
        print(f"Q: {q}\n")
        try:
            answer = ask_ai(q)
            print(f"A: {answer}")
            print("  ✅ AI responded successfully!")
        except Exception as e:
            print(f"  ❌ Error: {e}")

    print("\n" + "=" * 60)
    print("  Test complete.")
    print("=" * 60)
