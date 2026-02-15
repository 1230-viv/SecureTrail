# 🛡️ SecureTrail – AI Security Mentor

> Transforming security vulnerabilities into learning opportunities with AI

[![AWS AI for Bharat Hackathon](https://img.shields.io/badge/AWS-AI%20for%20Bharat-orange)](https://aws.amazon.com)
[![Built with Amazon Bedrock](https://img.shields.io/badge/Powered%20by-Amazon%20Bedrock-blue)](https://aws.amazon.com/bedrock/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 📋 Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Team](#team)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

**SecureTrail** is an AI-powered security mentoring platform designed for the **AWS AI for Bharat Hackathon**. It helps students and early-career developers build secure coding practices by analyzing source code in real-time and providing educational feedback on vulnerabilities.

Unlike traditional security scanners that simply report issues, SecureTrail transforms every vulnerability into a comprehensive learning experience, making security education accessible and actionable.

### 🏆 Hackathon Details

- **Hackathon:** AWS AI for Bharat
- **Team Name:** Strawhats
- **Team Leader:** Parth Chavan
- **Category:** AI/ML for Security Education

## 🚨 Problem Statement

Security vulnerabilities often go unnoticed during development because:

- 🎓 Students and early-career developers lack comprehensive security knowledge
- 📊 Security tools generate complex reports that are difficult to understand
- ⏰ Security reviews typically happen late in the development cycle (post-deployment)
- 📚 There is no real-time learning feedback during the coding process

**Consequences:**
- Applications are deployed with preventable vulnerabilities
- Developers develop insecure coding habits early in their careers
- Security becomes reactive instead of proactive
- Increased risk of data breaches and cyber attacks

## 💡 Solution

SecureTrail provides an intelligent AI-based system that:

1. **Analyzes** source code before deployment using static analysis
2. **Detects** genuine security vulnerabilities across multiple categories
3. **Explains** vulnerabilities in simple, accessible language using AI
4. **Teaches** developers secure coding practices through contextual learning
5. **Converts** every vulnerability into a learning opportunity

### Key Differentiator

Instead of simply reporting **"SQL Injection detected"**, SecureTrail provides:

✅ Why the vulnerability exists  
✅ How attackers exploit it  
✅ Real-world impact scenarios  
✅ Step-by-step remediation guide  
✅ Secure coding best practices  
✅ Improved secure version of the code  

## ✨ Key Features

### 🔍 Code Analysis Engine
- Static code analysis for JavaScript, TypeScript, and Python
- Detects 9+ vulnerability categories:
  - SQL Injection (SQLi)
  - Cross-Site Scripting (XSS)
  - Hardcoded secrets and credentials
  - Insecure authentication mechanisms
  - Insecure deserialization
  - Improper input validation
  - Path traversal vulnerabilities
  - Command injection
  - Insecure cryptographic practices
- Severity classification (Critical, High, Medium, Low, Info)
- Line-by-line vulnerability mapping

### 🤖 AI Explanation Engine (Powered by Amazon Bedrock)
- Human-friendly vulnerability explanations
- Educational attack simulation scenarios
- Impact severity analysis
- OWASP category mapping
- CWE (Common Weakness Enumeration) references
- Before/after code comparisons
- Secure code examples
- Multiple complexity levels (Beginner, Intermediate, Advanced)

**Note:** All attack simulations are educational and do not involve actual exploitation or penetration testing.

### 📚 Learning Mode
- Structured mini-lessons for each vulnerability
- Prevention techniques and best practices
- Related security concepts
- Learning progress tracking
- Personalized learning paths

### 📊 Developer Dashboard
- Comprehensive vulnerability overview
- Security score (0-100) tracking
- Severity distribution charts
- Historical analysis results
- Filter by severity, type, file, and date
- Export reports (PDF, JSON)

### 🔐 Security & Privacy
- Leverages AWS-managed encryption for data at rest and in transit
- Automatic code deletion after 30 days
- AWS Cognito authentication with MFA support
- OAuth integration (Google, GitHub)
- Rate limiting and DDoS protection via AWS WAF
- IAM role-based access control

### 💰 Cost Optimization
- Token usage monitoring for AI calls
- Prompt compression techniques
- Batch processing for multiple files
- AI response caching for identical code patterns
- Usage quotas per user tier

## 🛠️ Tech Stack

### Frontend
- **Framework:** React
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Build Tool:** Vite
- **Hosting:** AWS S3 + CloudFront

### Backend
- **Framework:** FastAPI
- **Language:** Python 3.10+
- **Code Analysis:** Static Analysis Engines (Bandit, Semgrep, custom AST parsers)
- **API Gateway:** Amazon API Gateway
- **Compute:** AWS Lambda (serverless functions)

### AI Intelligence
- **LLM Service:** Amazon Bedrock
- **Model:** Claude 3 Sonnet (Anthropic)
- **Use Cases:** 
  - Vulnerability explanation generation
  - Secure code example creation
  - Learning content generation
  - Attack scenario simulation (educational purposes only)

**Responsible AI Note:** Exploit simulations are generated for educational purposes only. The system does not execute real penetration tests or perform live attacks. All AI-generated content is designed to teach secure coding practices in a safe, controlled environment.

### Cloud Infrastructure (AWS)
- **API Gateway:** Amazon API Gateway
- **Compute:** AWS Lambda (serverless architecture)
- **Storage:** Amazon S3 (code storage, reports, static assets)
- **Database:** Amazon DynamoDB (NoSQL for scalability)
- **Monitoring:** Amazon CloudWatch (logs, metrics, alarms)
- **Authentication:** Amazon Cognito (user pools, OAuth)
- **Security:** AWS WAF, IAM roles, Security Groups
- **CDN:** CloudFront for global content delivery

### DevOps
- **Containerization:** Docker
- **CI/CD:** GitHub Actions
- **Container Registry:** AWS ECR (Elastic Container Registry)
- **Infrastructure as Code:** AWS CloudFormation / Terraform

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React + TypeScript + Tailwind CSS                       │  │
│  │  (Hosted on S3 + CloudFront)                             │  │
│  │  - Dashboard UI                                           │  │
│  │  - Code Upload Interface                                  │  │
│  │  - Vulnerability Viewer                                   │  │
│  │  - Learning Module                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Amazon API Gateway + AWS WAF                            │  │
│  │  - Rate Limiting                                          │  │
│  │  - Request Validation                                     │  │
│  │  - DDoS Protection                                        │  │
│  │  - Lambda Integration                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Serverless Application Layer                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AWS Lambda Functions (FastAPI + Python)                 │  │
│  │  ┌────────────────┐  ┌────────────────┐                 │  │
│  │  │ Auth Lambda    │  │ Analysis       │                 │  │
│  │  │ (Cognito)      │  │ Lambda         │                 │  │
│  │  └────────────────┘  └────────────────┘                 │  │
│  │  ┌────────────────┐  ┌────────────────┐                 │  │
│  │  │ Report Lambda  │  │ User Lambda    │                 │  │
│  │  │                │  │                │                 │  │
│  │  └────────────────┘  └────────────────┘                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    ↓                    ↓
┌──────────────────────────┐  ┌──────────────────────────────────┐
│   Analysis Engine        │  │      AI Layer                    │
│  ┌────────────────────┐  │  │  ┌────────────────────────────┐ │
│  │ Static Analyzers   │  │  │  │  Amazon Bedrock            │ │
│  │ - Bandit (Python)  │  │  │  │  - Claude 3 Sonnet         │ │
│  │ - Semgrep          │  │  │  │  - Prompt Engineering      │ │
│  │ - Custom AST       │  │  │  │  - Response Filtering      │ │
│  └────────────────────┘  │  │  └────────────────────────────┘ │
└──────────────────────────┘  └──────────────────────────────────┘
                    ↓                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  DynamoDB        │  │  Amazon S3       │  │  Cognito     │ │
│  │  - User Data     │  │  - Code Storage  │  │  - User Pool │ │
│  │  - Analysis Data │  │  - Reports       │  │  - OAuth     │ │
│  │  - Metadata      │  │  - Static Assets │  │  - MFA       │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Monitoring & DevOps                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CloudWatch + GitHub Actions + Docker + ECR              │  │
│  │  - Application Logs                                       │  │
│  │  - Performance Metrics                                    │  │
│  │  - CI/CD Pipeline                                         │  │
│  │  - Container Management                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ (for frontend)
- AWS Account with the following services enabled:
  - Amazon Bedrock (with Claude model access)
  - AWS Lambda
  - Amazon API Gateway
  - Amazon DynamoDB
  - Amazon S3
  - Amazon Cognito
  - Amazon CloudWatch
  - AWS ECR
- Docker (for containerization)
- AWS CLI configured
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/strawhats/securetrail.git
cd securetrail
```

2. **Install backend dependencies**

```bash
cd backend
pip install -r requirements.txt
```

3. **Install frontend dependencies**

```bash
cd frontend
npm install
```

4. **Configure environment variables**

Create `.env` file in backend directory:
```env
# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Amazon Bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_REGION=us-east-1

# DynamoDB
DYNAMODB_TABLE_USERS=securetrail-users
DYNAMODB_TABLE_ANALYSES=securetrail-analyses
DYNAMODB_TABLE_VULNERABILITIES=securetrail-vulnerabilities

# AWS Cognito
COGNITO_USER_POOL_ID=your_user_pool_id
COGNITO_CLIENT_ID=your_client_id
COGNITO_REGION=ap-south-1

# S3
S3_BUCKET_NAME=securetrail-code-storage
S3_REGION=ap-south-1

# API Configuration
API_GATEWAY_URL=https://your-api-id.execute-api.ap-south-1.amazonaws.com
STAGE=dev
```

Frontend `.env`:
```env
VITE_API_URL=https://your-api-id.execute-api.ap-south-1.amazonaws.com/dev
VITE_COGNITO_USER_POOL_ID=your_user_pool_id
VITE_COGNITO_CLIENT_ID=your_client_id
VITE_AWS_REGION=ap-south-1
```

5. **Set up AWS infrastructure**

Using AWS CLI:
```bash
# Create DynamoDB tables
aws dynamodb create-table --table-name securetrail-users --cli-input-json file://infrastructure/dynamodb-users.json

# Create S3 bucket
aws s3 mb s3://securetrail-code-storage --region ap-south-1

# Create Cognito User Pool
aws cognito-idp create-user-pool --pool-name securetrail-users --cli-input-json file://infrastructure/cognito-config.json
```

Or using CloudFormation:
```bash
aws cloudformation create-stack --stack-name securetrail-infrastructure --template-body file://infrastructure/cloudformation/main.yaml
```

6. **Deploy Lambda functions**

```bash
# Build Docker image
docker build -t securetrail-backend .

# Tag and push to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin your-account-id.dkr.ecr.ap-south-1.amazonaws.com
docker tag securetrail-backend:latest your-account-id.dkr.ecr.ap-south-1.amazonaws.com/securetrail-backend:latest
docker push your-account-id.dkr.ecr.ap-south-1.amazonaws.com/securetrail-backend:latest

# Deploy Lambda functions
cd infrastructure
./deploy-lambda.sh
```

7. **Start the development servers**

Backend (local testing):
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm run dev
```

8. **Deploy frontend to S3**

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://securetrail-frontend --delete
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

9. **Access the application**
- Frontend: https://your-cloudfront-domain.cloudfront.net
- Backend API: https://your-api-id.execute-api.ap-south-1.amazonaws.com/dev
- API Documentation: https://your-api-id.execute-api.ap-south-1.amazonaws.com/dev/docs

## 📖 Usage

### 1. Register/Login
- Create an account using email or OAuth (Google/GitHub)
- Verify your email address

### 2. Upload Code
- **Option 1:** Drag and drop code files (`.js`, `.py`, `.ts`, `.jsx`, `.tsx`)
- **Option 2:** Provide GitHub repository URL
- Maximum file size: 10MB per file, 50MB per project

### 3. Analyze Code
- Click "Analyze" to start the security scan
- Wait for analysis to complete (typically <10 seconds for small projects)

### 4. Review Results
- View detected vulnerabilities on the dashboard
- Check your security score (0-100)
- Filter by severity: Critical, High, Medium, Low, Info

### 5. Learn from Vulnerabilities
- Click on any vulnerability to see detailed explanation
- Read the AI-generated learning content:
  - What the vulnerability is
  - Why it's dangerous
  - How attackers exploit it
  - How to fix it
  - Secure code example
- Track your learning progress

### 6. Export Reports
- Export analysis results as PDF or JSON
- Share reports with your team or instructor

## 📁 Project Structure

```
securetrail/
├── .kiro/
│   └── specs/
│       └── securetrail-ai-security-mentor/
│           ├── requirements.md    # Detailed requirements
│           ├── design.md          # Technical design
│           └── tasks.md           # Implementation tasks
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI application entry
│   │   ├── api/                  # API routes and endpoints
│   │   ├── services/             # Business logic
│   │   ├── models/               # Data models (Pydantic)
│   │   ├── core/                 # Core configuration
│   │   └── utils/                # Utility functions
│   ├── tests/                    # Backend tests
│   ├── requirements.txt          # Python dependencies
│   └── Dockerfile                # Container configuration
├── frontend/
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── pages/                # Page components
│   │   ├── services/             # API services
│   │   ├── store/                # Redux store
│   │   ├── hooks/                # Custom hooks
│   │   └── utils/                # Utility functions
│   ├── public/                   # Static assets
│   └── package.json
├── infrastructure/
│   ├── cloudformation/           # CloudFormation templates
│   └── terraform/                # Terraform configs
├── docs/
│   ├── api/                      # API documentation
│   ├── architecture/             # Architecture diagrams
│   └── user-guide/               # User documentation
├── scripts/
│   ├── deploy.sh                 # Deployment scripts
│   └── setup.sh                  # Setup scripts
├── .github/
│   └── workflows/                # GitHub Actions CI/CD
├── README.md
├── LICENSE
└── .gitignore
```

## 👥 Team

**Team Name:** Strawhats

**Team Leader:** Parth Chavan

**Team Members:**
- Parth Chavan - Team Lead & DevOps
- Vivek Swami - Cybersecurity & Code Analysis
- Sarthak Kshirsagar - Cybersecurity & Vulnerability Research
- Meghal Kulkarni - AI/ML Integration & Prompt Engineering

## 🤖 Responsible AI & Ethics

SecureTrail is committed to responsible AI practices:

**Educational Purpose Only**
- All exploit simulations and attack scenarios are generated for educational purposes only
- The system does not execute real penetration tests or perform live attacks
- AI-generated content is designed to teach secure coding practices in a safe, controlled environment

**Transparency**
- AI explanations clearly indicate they are generated by Claude 3 Sonnet via Amazon Bedrock
- Users are informed when viewing AI-generated content
- The system does not claim to replace professional security audits

**Privacy & Data Protection**
- User code is processed securely and deleted after 30 days by default
- No code is used to train AI models without explicit consent
- All data handling follows AWS security best practices

**Accuracy & Limitations**
- Detection accuracy targets are continuously validated and improved
- False positives are tracked and minimized through ongoing refinement
- Users are encouraged to verify findings and apply professional judgment

**Bias Mitigation**
- The system is designed to provide consistent analysis regardless of code author
- Vulnerability detection is based on established security standards (OWASP, CWE)
- Regular audits ensure fair and unbiased operation

## 🗺️ Roadmap

### Phase 1 (MVP - Hackathon) ✅
- [x] Code upload and GitHub integration
- [x] Static analysis for JavaScript and Python
- [x] AI-powered vulnerability explanations
- [x] Developer dashboard
- [x] User authentication
- [x] Basic learning mode

### Phase 2 (6-12 months)
- [ ] IDE integration (VS Code, IntelliJ)
- [ ] Additional language support (Java, Go, Ruby, PHP)
- [ ] Advanced analysis (dynamic analysis, dependency scanning)
- [ ] CI/CD integration (GitHub Actions, GitLab CI, Jenkins)
- [ ] Team collaboration features

### Phase 3 (12-24 months)
- [ ] Interactive security challenges and CTF exercises
- [ ] Gamification with badges and achievements
- [ ] Security certification program
- [ ] Enterprise features (SSO, custom policies, compliance reporting)
- [ ] Mobile applications (iOS, Android)

## 🎯 Success Metrics

### User Engagement
- **Target:** 500 users in first 3 months
- **Target:** 2,000 users by end of Year 1
- **Target:** 80% of registered users complete first analysis
- **Target:** 40% retention after 30 days

### Technical Performance
- **Target:** <10 seconds analysis time for small projects
- **Target:** <500ms API response time (95th percentile)
- **Target:** 99.5% uptime
- **Target:** 1,000 concurrent users supported

### Security & Quality
- **Target:** >90% detection accuracy (ongoing validation)
- **Target:** <10% false positive rate (continuous improvement)
- **Goal:** Designed to align with OWASP Top 10 categories
- **Target:** 20% average security score improvement after 5 analyses

### Educational Impact
- **Target:** 70% of detected vulnerabilities addressed by users
- **Target:** 60% of users demonstrate improved secure coding patterns
- **Goal:** Establish partnerships with 5 educational institutions by end of Year 1

## 🤝 Contributing

We welcome contributions from the community! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Follow ESLint/Prettier configurations
- Write unit tests for new features
- Update documentation as needed
- Follow conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **AWS AI for Bharat Hackathon** for the opportunity
- **Amazon Bedrock** for powering our AI explanations
- **OWASP** for security vulnerability classifications
- **Open-source community** for amazing tools and libraries

## 📞 Contact

- **Project Link:** [https://github.com/strawhats/securetrail](https://github.com/strawhats/securetrail)
- **Team Leader:** Parth Chavan - [email@example.com](mailto:email@example.com)
- **Documentation:** [https://docs.securetrail.dev](https://docs.securetrail.dev)
- **Demo:** [https://demo.securetrail.dev](https://demo.securetrail.dev)

## 🌟 Show Your Support

If you find SecureTrail helpful, please give it a ⭐️ on GitHub!

---

**Built with ❤️ by Team Strawhats for AWS AI for Bharat Hackathon**

*Making security education accessible, one vulnerability at a time.*
