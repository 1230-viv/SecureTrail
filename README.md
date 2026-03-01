# 🛡️ SecureTrail – AI Security Mentor

> Transforming vulnerability reports into developer security growth using Generative AI.

[![AWS AI for Bharat Hackathon](https://img.shields.io/badge/AWS-AI%20for%20Bharat-orange)](https://aws.amazon.com)
[![Powered by Amazon Bedrock](https://img.shields.io/badge/AI-Amazon%20Bedrock-blue)](https://aws.amazon.com/bedrock/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 🎯 Overview

**SecureTrail** is an AI-powered security mentoring platform built for the **AWS AI for Bharat Hackathon**.

Traditional security scanners detect vulnerabilities.  
SecureTrail goes further — it transforms every detected issue into a structured learning experience and tracks developer security maturity over time.

The platform combines:

- Static code analysis
- Custom access control detection
- Behavioral pattern modeling
- Generative AI mentoring via **Amazon Bedrock (Llama 4 Maverick)**

---

## 🏆 What Makes SecureTrail Different

- Converts vulnerability reports into structured learning journeys  
- Tracks recurring insecure coding habits across scans  
- Builds a measurable developer security maturity model  
- Uses Amazon Bedrock to personalize mentoring at scale  
- Designed for education-first security adoption in India  

SecureTrail is not just a scanner — it is a security growth engine.

## 🚨 Problem Statement

Security tools today:

- Generate complex vulnerability reports  
- Provide minimal learning context  
- Do not personalize feedback  
- Do not track recurring insecure coding habits  
- Do not measure developer security growth  

As a result:

- Developers fix issues mechanically  
- Insecure habits persist  
- Security remains reactive instead of learned  

---

## 💡 Solution

SecureTrail introduces a **Behavioral Security Learning Engine** that:

1. **Scans** source code using multiple security tools  
2. **Normalizes and scores** vulnerabilities deterministically  
3. **Identifies recurring coding habits** across scan history  
4. **Uses Generative AI** to convert findings into structured learning insights  
5. **Tracks security maturity progression** over time  

---

## 🧠 Why Generative AI Is Required

Without AI:

- The system only reports vulnerabilities  
- No personalization  
- No contextual learning  
- No behavioral modeling  

With Amazon Bedrock (Llama 4 Maverick):

- Vulnerabilities are explained in developer-friendly language  
- Recurring patterns are identified as skill gaps  
- Secure coding guidance is contextualized to the repository  
- Security drift across scans is detected  
- A structured security maturity model is generated  

Generative AI is not decorative — it enables mentorship-level feedback.

---

## ✨ Key Features

### 🔍 Multi-Layer Code Analysis

- **Semgrep** – Static Application Security Testing (SAST)  
- **Trivy** – Dependency vulnerability scanning (CVEs)  
- **Gitleaks** – Secret detection  
- **Custom Access Control Analyzer (Proprietary Engine)**:
  - Broken Access Control (AC-001–AC-007)  
  - IDOR / BOLA detection  
  - Unauthenticated destructive endpoints  
  - RouterGraph multi-level middleware inheritance  
  - Middleware semantic inference  
  - Object-level authorization flow tracking  

Supports all languages covered by Semgrep (JavaScript, TypeScript, Python, Java, Go, Ruby, etc.).

---

### 🤖 AI Learning & Mentoring Engine  
Powered by **Amazon Bedrock – Llama 4 Maverick 17B**

For each scan, the AI layer generates:

- Root cause explanations  
- Defensive impact analysis  
- Secure coding guidance  
- Secure code pattern examples  
- Behavioral pattern insights  
- Longitudinal trend summaries  

All AI responses are:

- Defensive and educational  
- Structured JSON validated  
- Cached per scan for cost efficiency  
- Processed entirely within AWS Bedrock  

---

### 📈 Security Maturity & Habit Tracking

SecureTrail models developer growth using:

- Security score (0–100)  
- Skill domain buckets:
  - Authentication & Authorization  
  - Secrets Management  
  - API Protection  
  - Input Validation  
  - Dependency Hygiene  
- Habit recurrence tracking  
- Risk momentum analysis  
- Regression detection  

Vulnerability lifecycle:

```
Detected → Learning → Fix Attempted → Verified → Mastered
```


---

### 📊 Developer Dashboard

- Severity distribution charts  
- Vulnerability correlation  
- Exploitability scoring  
- OWASP / CWE / CVE mapping  
- Historical scan comparison  
- Learning XP progression  

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React 18 + Vite + Tailwind CSS  (JavaScript)            │  │
│  │  - Dashboard & Vulnerability Viewer                       │  │
│  │  - Code Upload Interface                                  │  │
│  │  - Learning & Mentor Hub                                  │  │
│  │  - Progressive AI enrichment (background polling)        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS / REST
┌─────────────────────────────────────────────────────────────────┐
│             Application Layer  (AWS EC2 – us-east-1)             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  FastAPI + Uvicorn  (Python 3.11, async)                  │  │
│  │  - OAuth 2.0 (GitHub / Google) + JWT authentication      │  │
│  │  - Scan job queue with real-time progress polling         │  │
│  │  - Learning / Mentor / Chat API routes                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    ↓                          ↓
┌──────────────────────────────┐  ┌──────────────────────────────┐
│       Scan Pipeline          │  │          AI Layer             │
│  ┌────────────────────────┐  │  │  ┌────────────────────────┐  │
│  │ Semgrep  (SAST)        │  │  │  │  Amazon Bedrock        │  │
│  │ Gitleaks (secrets)     │  │  │  │  Llama 4 Maverick 17B  │  │
│  │ Trivy    (CVEs)        │  │  │  │  - Explanation engine  │  │
│  │ Custom Access Control  │  │  │  │  - Business impact AI  │  │
│  │  Analyzer (Proprietary)│  │  │  │  - Learning mentor     │  │
│  │ Normalizer / Correlator│  │  │  │  - Chat & skill gaps   │  │
│  └────────────────────────┘  │  │  └────────────────────────┘  │
└──────────────────────────────┘  └──────────────────────────────┘
                    ↓                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                               │
│  ┌─────────────────────────────────┐  ┌───────────────────────┐ │
│  │  PostgreSQL + SQLAlchemy        │  │  Amazon S3            │ │
│  │  - Users & scan jobs            │  │  (ap-south-1)         │ │
│  │  - Vulnerability results        │  │  - ZIP archives       │ │
│  │  - Learning progress & history  │  │  - 7-day auto-delete  │ │
│  └─────────────────────────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                          DevOps                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Docker + GitHub Actions + Alembic                       │  │
│  │  - Scanners run in isolated Docker containers            │  │
│  │  - CI/CD pipeline                                         │  │
│  │  - Database schema versioning                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```


---

## 🛠️ Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS

### Backend
- FastAPI (Python 3.11)
- PostgreSQL + SQLAlchemy (async)
- Alembic (migrations)
- Docker (isolated scanner execution)

### AI Layer
- Amazon Bedrock
- Model: `meta.llama4-maverick-17b-instruct-v1:0`
- Converse API
- Structured JSON schema validation

### AWS Infrastructure
- Amazon EC2 (application hosting)
- Amazon S3 (temporary archive storage, 7-day TTL)
- Amazon Bedrock (AI reasoning)
- IAM Roles (no static credentials in production)

---

## 🔐 Security & Privacy

- OAuth 2.0 (GitHub / Google) + JWT authentication  
- IAM roles used for AWS service access  
- Uploaded code archived in S3 with automatic deletion  
- Scanners executed in isolated Docker containers  
- No user code used for model training  
- All AI calls remain within AWS infrastructure  

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Docker
- AWS account with Bedrock access (us-east-1)

---

### Backend Setup

```bash
cd Backend
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd Frontend
npm install
npm run dev
```

### Environment Variables (`.env`)

```env
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=meta.llama4-maverick-17b-instruct-v1:0
S3_BUCKET_NAME=your-bucket
DATABASE_URL=postgresql+asyncpg://user:password@localhost/securetrail
JWT_SECRET_KEY=your_secret
```

> ⚠️ In production, use IAM roles instead of static AWS access keys.

## 📊 Success Metrics

- `<10s` scan time for small projects
- `<500ms` API latency (P95)
- 90%+ detection validation accuracy (continuous benchmarking)
- 20% average security score improvement after 5 scans
- Measurable reduction in recurring vulnerability patterns

---

## 🤖 Responsible AI Commitment

- AI-generated content is educational and defensive
- The system does not perform real exploitation or penetration testing
- Explanations align with OWASP and CWE standards
- Human review is encouraged for production-critical decisions

---

## 👥 Team – Strawhats

| Name | Role |
|---|---|
| Parth Chavan | Team Lead & DevOps |
| Vivek Swami | Cybersecurity |
| Sarthak Kshirsagar | Cybersecurity |
| Meghal Kulkarni | AI/ML Integration |

---

## 📄 License

MIT License

---

> Built for **AWS AI for Bharat Hackathon**  
> Making security education measurable, personalized, and scalable.