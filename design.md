# SecureTrail – AI Security Mentor
## Technical Design Document

**Project Name:** SecureTrail  
**Team Name:** Strawhats  
**Team Leader:** Parth Chavan  
**Hackathon:** AWS AI for Bharat Hackathon  
**Version:** 1.0  
**Last Updated:** February 15, 2026

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Component Design](#component-design)
4. [Data Architecture](#data-architecture)
5. [API Design](#api-design)
6. [Security Architecture](#security-architecture)
7. [AI/ML Architecture](#aiml-architecture)
8. [Frontend Architecture](#frontend-architecture)
9. [Backend Architecture](#backend-architecture)
10. [Infrastructure Design](#infrastructure-design)
11. [Deployment Architecture](#deployment-architecture)
12. [Integration Design](#integration-design)
13. [Performance Optimization](#performance-optimization)
14. [Monitoring & Observability](#monitoring--observability)
15. [Error Handling & Recovery](#error-handling--recovery)
16. [Testing Strategy](#testing-strategy)
17. [Development Workflow](#development-workflow)
18. [Implementation Roadmap](#implementation-roadmap)

---

## 1. Executive Summary

### 1.1 Design Overview
SecureTrail is designed as a cloud-native, microservices-oriented platform leveraging AWS services for scalability, security, and cost-effectiveness. The architecture emphasizes:

- **Modularity:** Loosely coupled services for independent scaling and deployment
- **Security-First:** Defense in depth with multiple security layers
- **AI-Powered:** Amazon Bedrock integration for intelligent vulnerability explanations
- **Developer-Friendly:** Intuitive interfaces and comprehensive documentation
- **Cost-Optimized:** Efficient resource utilization and caching strategies

### 1.2 Technology Stack Summary

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Frontend | React 18 + TypeScript | Modern, type-safe, component-based |
| UI Framework | Tailwind CSS + shadcn/ui | Rapid development, customizable |
| State Management | Zustand + React Query | Lightweight, server-state optimized |
| Backend | Node.js 18 + Express | JavaScript ecosystem consistency |
| Database | PostgreSQL 14 (AWS RDS) | ACID compliance, JSON support |
| Cache | Redis (ElastiCache) | Session storage, response caching |
| Storage | AWS S3 | Scalable object storage |
| Auth | AWS Cognito | Managed authentication service |
| AI/ML | Amazon Bedrock (Claude 3) | Advanced reasoning, code understanding |
| Static Analysis | Semgrep + Custom Rules | Flexible, extensible pattern matching |
| API Gateway | AWS API Gateway | Managed, scalable API layer |
| CDN | CloudFront | Global content delivery |
| Monitoring | CloudWatch + X-Ray | Integrated AWS observability |
| CI/CD | GitHub Actions | Automated testing and deployment |


---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  React SPA (TypeScript)                                           │  │
│  │  ├─ Dashboard Module          ├─ Analysis Module                 │  │
│  │  ├─ Authentication Module     ├─ Learning Module                 │  │
│  │  ├─ Upload Module              ├─ Report Module                   │  │
│  │  └─ Hosted on: CloudFront + S3                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓ HTTPS
┌─────────────────────────────────────────────────────────────────────────┐
│                         EDGE LAYER                                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  AWS CloudFront (CDN)                                             │  │
│  │  ├─ SSL/TLS Termination       ├─ DDoS Protection (Shield)        │  │
│  │  ├─ Static Asset Caching      ├─ Geographic Distribution         │  │
│  │  └─ WAF Rules                                                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY LAYER                                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  AWS API Gateway                                                  │  │
│  │  ├─ Request Routing           ├─ Rate Limiting (100/hr)          │  │
│  │  ├─ Request Validation        ├─ API Key Management              │  │
│  │  ├─ CORS Configuration        ├─ Request/Response Transform      │  │
│  │  └─ Lambda Authorizer (JWT)                                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    APPLICATION LOAD BALANCER                             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  AWS ALB                                                          │  │
│  │  ├─ Health Checks              ├─ SSL Termination                │  │
│  │  ├─ Path-based Routing         ├─ Sticky Sessions                │  │
│  │  └─ Target Group Management                                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER (VPC)                             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Backend Services (Node.js on EC2/Fargate)                       │  │
│  │                                                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │  │
│  │  │   Auth       │  │  Analysis    │  │   Report     │           │  │
│  │  │   Service    │  │  Service     │  │   Service    │           │  │
│  │  │              │  │              │  │              │           │  │
│  │  │ - Login      │  │ - Upload     │  │ - Generate   │           │  │
│  │  │ - Register   │  │ - Analyze    │  │ - Export     │           │  │
│  │  │ - OAuth      │  │ - Results    │  │ - Share      │           │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │  │
│  │                                                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │  │
│  │  │   User       │  │  Dashboard   │  │   GitHub     │           │  │
│  │  │   Service    │  │  Service     │  │   Service    │           │  │
│  │  │              │  │              │  │              │           │  │
│  │  │ - Profile    │  │ - Metrics    │  │ - Clone      │           │  │
│  │  │ - Prefs      │  │ - Analytics  │  │ - Webhook    │           │  │
│  │  │ - Progress   │  │ - Summary    │  │ - OAuth      │           │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                    ↓                              ↓
┌──────────────────────────────┐    ┌──────────────────────────────────┐
│   ANALYSIS ENGINE LAYER      │    │      AI/ML LAYER                 │
│  ┌────────────────────────┐  │    │  ┌────────────────────────────┐ │
│  │  Static Analyzer       │  │    │  │  Amazon Bedrock            │ │
│  │  ┌──────────────────┐  │  │    │  │  ┌──────────────────────┐ │ │
│  │  │  Semgrep Engine  │  │  │    │  │  │  Claude 3 Sonnet     │ │ │
│  │  │  - Custom Rules  │  │  │    │  │  │  - Explanation Gen   │ │ │
│  │  │  - Pattern Match │  │  │    │  │  │  - Code Examples     │ │ │
│  │  └──────────────────┘  │  │    │  │  │  - Attack Scenarios  │ │ │
│  │  ┌──────────────────┐  │  │    │  │  └──────────────────────┘ │ │
│  │  │  AST Parser      │  │  │    │  │                            │ │
│  │  │  - JS/TS Parser  │  │  │    │  │  Prompt Engineering:       │ │
│  │  │  - Python Parser │  │  │    │  │  - Context Injection       │ │
│  │  └──────────────────┘  │  │    │  │  - Token Optimization      │ │
│  │  ┌──────────────────┐  │  │    │  │  - Response Validation     │ │
│  │  │  Vulnerability   │  │  │    │  │  - Caching Layer           │ │
│  │  │  Classifier      │  │  │    │  └────────────────────────────┘ │
│  │  │  - Severity      │  │  │    └──────────────────────────────────┘
│  │  │  - OWASP Map     │  │  │
│  │  │  - CWE Map       │  │  │
│  │  └──────────────────┘  │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  AWS RDS         │  │  AWS S3          │  │  ElastiCache (Redis) │  │
│  │  (PostgreSQL)    │  │                  │  │                      │  │
│  │                  │  │  Buckets:        │  │  - Session Store     │  │
│  │  - Users         │  │  - code-uploads  │  │  - API Cache         │  │
│  │  - Analyses      │  │  - reports       │  │  - AI Response Cache │  │
│  │  - Vulnerabilities│ │  - static-assets │  │  - Rate Limit Data   │  │
│  │  - CodeFiles     │  │                  │  │                      │  │
│  │  - Learning      │  │  Lifecycle:      │  │  TTL: 1-24 hours     │  │
│  │  - AuditLogs     │  │  - 30d deletion  │  │                      │  │
│  │                  │  │  - Encryption    │  │                      │  │
│  │  Multi-AZ        │  │  - Versioning    │  │  Cluster Mode        │  │
│  │  Read Replicas   │  │                  │  │                      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  AWS Cognito User Pool                                           │  │
│  │  - User Authentication    - OAuth Integration (Google, GitHub)   │  │
│  │  - Password Policies      - MFA Support                          │  │
│  │  - User Attributes        - Token Management                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    MONITORING & LOGGING LAYER                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  AWS CloudWatch                                                   │  │
│  │  ├─ Application Logs        ├─ Custom Metrics                    │  │
│  │  ├─ Performance Metrics     ├─ Alarms & Notifications            │  │
│  │  └─ Log Aggregation         └─ Dashboards                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  AWS X-Ray                                                        │  │
│  │  ├─ Distributed Tracing     ├─ Service Map                       │  │
│  │  ├─ Performance Analysis    ├─ Error Analysis                    │  │
│  │  └─ Request Flow Tracking                                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         QUEUE LAYER                                      │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  AWS SQS (Simple Queue Service)                                   │  │
│  │  ├─ Analysis Job Queue      ├─ Dead Letter Queue                 │  │
│  │  ├─ Report Generation Queue ├─ Priority Queue (Premium)          │  │
│  │  └─ Notification Queue                                           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Architecture Principles

#### 2.2.1 Separation of Concerns
- Frontend handles presentation and user interaction
- Backend services handle business logic
- Analysis engine focuses on code scanning
- AI layer provides intelligent explanations
- Data layer manages persistence

#### 2.2.2 Scalability
- Horizontal scaling via auto-scaling groups
- Stateless services for easy replication
- Queue-based job processing for async operations
- Caching at multiple layers
- Database read replicas for read-heavy operations

#### 2.2.3 Security
- Defense in depth with multiple security layers
- Encryption at rest and in transit
- Principle of least privilege
- Network isolation via VPC
- Regular security audits

#### 2.2.4 Reliability
- Multi-AZ deployment for high availability
- Automated backups and disaster recovery
- Health checks and auto-recovery
- Circuit breakers for external dependencies
- Graceful degradation

#### 2.2.5 Cost Optimization
- Right-sizing of resources
- Auto-scaling based on demand
- S3 lifecycle policies
- Reserved instances for predictable workloads
- Caching to reduce compute and AI costs

### 2.3 Data Flow Diagrams

#### 2.3.1 Code Upload and Analysis Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. Upload Code
     ↓
┌────────────────┐
│  React App     │
│  - Validate    │
│  - Compress    │
└────┬───────────┘
     │ 2. POST /api/analysis/upload
     ↓
┌────────────────┐
│  API Gateway   │
│  - Auth Check  │
│  - Rate Limit  │
└────┬───────────┘
     │ 3. Forward Request
     ↓
┌────────────────┐
│ Analysis       │
│ Service        │
│ - Validate     │
│ - Store S3     │
│ - Queue Job    │
└────┬───────────┘
     │ 4. Enqueue
     ↓
┌────────────────┐
│  SQS Queue     │
└────┬───────────┘
     │ 5. Dequeue
     ↓
┌────────────────┐
│ Analysis       │
│ Worker         │
│ - Fetch Code   │
│ - Run Semgrep  │
│ - Parse AST    │
│ - Detect Vulns │
└────┬───────────┘
     │ 6. Store Results
     ↓
┌────────────────┐
│  PostgreSQL    │
│  - Analysis    │
│  - Vulnerabilities
└────┬───────────┘
     │ 7. For Each Vulnerability
     ↓
┌────────────────┐
│ AI Service     │
│ - Build Prompt │
│ - Call Bedrock │
│ - Parse Response
└────┬───────────┘
     │ 8. Store Explanations
     ↓
┌────────────────┐
│  PostgreSQL    │
│  - Update Vuln │
└────┬───────────┘
     │ 9. Notify Complete
     ↓
┌────────────────┐
│  User          │
│  (Dashboard)   │
└────────────────┘
```

#### 2.3.2 Authentication Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. Login Request
     ↓
┌────────────────┐
│  React App     │
└────┬───────────┘
     │ 2. POST /api/auth/login
     ↓
┌────────────────┐
│  API Gateway   │
└────┬───────────┘
     │ 3. Forward
     ↓
┌────────────────┐
│ Auth Service   │
└────┬───────────┘
     │ 4. Authenticate
     ↓
┌────────────────┐
│ AWS Cognito    │
│ - Verify Creds │
│ - Generate JWT │
└────┬───────────┘
     │ 5. Return Token
     ↓
┌────────────────┐
│ Auth Service   │
│ - Store Session│
└────┬───────────┘
     │ 6. Cache Session
     ↓
┌────────────────┐
│  Redis         │
└────┬───────────┘
     │ 7. Return JWT
     ↓
┌────────────────┐
│  React App     │
│  - Store Token │
│  - Redirect    │
└────────────────┘
```


---

## 3. Component Design

### 3.1 Frontend Components

#### 3.1.1 Component Hierarchy

```
App
├── AuthProvider (Context)
├── ThemeProvider (Context)
├── QueryClientProvider (React Query)
└── Router
    ├── PublicRoutes
    │   ├── LandingPage
    │   ├── LoginPage
    │   ├── RegisterPage
    │   └── ForgotPasswordPage
    └── ProtectedRoutes
        ├── DashboardLayout
        │   ├── Sidebar
        │   ├── Header
        │   └── MainContent
        │       ├── DashboardPage
        │       │   ├── SecurityScoreCard
        │       │   ├── RecentAnalysesTable
        │       │   ├── VulnerabilityTrendChart
        │       │   └── LearningProgressCard
        │       ├── AnalysisPage
        │       │   ├── UploadSection
        │       │   │   ├── FileUploader
        │       │   │   └── GitHubConnector
        │       │   ├── AnalysisProgress
        │       │   └── ResultsViewer
        │       │       ├── VulnerabilityList
        │       │       ├── VulnerabilityDetail
        │       │       │   ├── CodeSnippet
        │       │       │   ├── ExplanationPanel
        │       │       │   ├── AttackScenario
        │       │       │   ├── FixSuggestion
        │       │       │   └── SecureCodeExample
        │       │       └── FilterPanel
        │       ├── LearningPage
        │       │   ├── ProgressTracker
        │       │   ├── VulnerabilityLibrary
        │       │   └── LessonViewer
        │       ├── ReportsPage
        │       │   ├── ReportList
        │       │   ├── ReportGenerator
        │       │   └── ExportOptions
        │       └── ProfilePage
        │           ├── UserInfo
        │           ├── PreferencesForm
        │           └── UsageStatistics
        └── NotFoundPage
```

#### 3.1.2 Key Component Specifications

**FileUploader Component**
```typescript
interface FileUploaderProps {
  onUploadComplete: (analysisId: string) => void;
  maxFileSize: number; // 10MB
  maxTotalSize: number; // 50MB
  acceptedFileTypes: string[];
}

Features:
- Drag-and-drop interface
- Multi-file selection
- File validation (type, size)
- Upload progress tracking
- Error handling and retry
- Preview of selected files
```

**VulnerabilityDetail Component**
```typescript
interface VulnerabilityDetailProps {
  vulnerability: Vulnerability;
  onMarkResolved: (id: string) => void;
  onReportFalsePositive: (id: string) => void;
  explanationLevel: 'beginner' | 'intermediate' | 'advanced';
}

Features:
- Syntax-highlighted code snippets
- Collapsible sections
- Copy-to-clipboard functionality
- Before/after code comparison
- Related vulnerabilities suggestions
- OWASP/CWE reference links
```

**SecurityScoreCard Component**
```typescript
interface SecurityScoreCardProps {
  score: number; // 0-100
  previousScore: number;
  trend: 'up' | 'down' | 'stable';
  breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

Features:
- Animated score display
- Trend indicator
- Severity breakdown chart
- Historical comparison
- Tooltip explanations
```

#### 3.1.3 State Management Architecture

**Global State (Zustand)**
```typescript
interface AppState {
  // Auth State
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
  
  // UI State
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  
  // Preferences
  explanationLevel: 'beginner' | 'intermediate' | 'advanced';
  setExplanationLevel: (level: string) => void;
}
```

**Server State (React Query)**
```typescript
// Queries
useAnalyses() // Fetch user's analyses
useAnalysisById(id) // Fetch specific analysis
useVulnerabilities(analysisId) // Fetch vulnerabilities
useDashboardSummary() // Fetch dashboard data
useUserProfile() // Fetch user profile

// Mutations
useUploadCode() // Upload code for analysis
useUpdateProfile() // Update user profile
useMarkResolved() // Mark vulnerability as resolved
useExportReport() // Generate and export report
```

### 3.2 Backend Service Components

#### 3.2.1 Service Architecture

**Auth Service**
```typescript
class AuthService {
  // Core Methods
  async register(userData: RegisterDTO): Promise<User>
  async login(credentials: LoginDTO): Promise<AuthToken>
  async logout(userId: string): Promise<void>
  async refreshToken(refreshToken: string): Promise<AuthToken>
  async verifyToken(token: string): Promise<TokenPayload>
  
  // OAuth Methods
  async initiateOAuth(provider: string): Promise<OAuthURL>
  async handleOAuthCallback(code: string, provider: string): Promise<AuthToken>
  
  // Password Management
  async requestPasswordReset(email: string): Promise<void>
  async resetPassword(token: string, newPassword: string): Promise<void>
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>
  
  // Session Management
  async createSession(userId: string, token: string): Promise<void>
  async validateSession(sessionId: string): Promise<boolean>
  async invalidateSession(sessionId: string): Promise<void>
}
```

**Analysis Service**
```typescript
class AnalysisService {
  // Upload Methods
  async uploadFiles(files: File[], userId: string): Promise<Analysis>
  async uploadFromGitHub(repoUrl: string, branch: string, userId: string): Promise<Analysis>
  
  // Analysis Methods
  async startAnalysis(analysisId: string): Promise<void>
  async getAnalysisStatus(analysisId: string): Promise<AnalysisStatus>
  async getAnalysisResults(analysisId: string): Promise<AnalysisResult>
  
  // Vulnerability Methods
  async getVulnerabilities(analysisId: string, filters?: VulnFilter): Promise<Vulnerability[]>
  async getVulnerabilityDetail(vulnId: string): Promise<VulnerabilityDetail>
  async markVulnerabilityResolved(vulnId: string): Promise<void>
  async reportFalsePositive(vulnId: string, reason: string): Promise<void>
  
  // History Methods
  async getUserAnalyses(userId: string, pagination: Pagination): Promise<PaginatedAnalyses>
  async deleteAnalysis(analysisId: string): Promise<void>
}
```

**AI Service**
```typescript
class AIService {
  // Explanation Generation
  async generateExplanation(vulnerability: Vulnerability, level: string): Promise<Explanation>
  async generateSecureCode(vulnerability: Vulnerability): Promise<string>
  async generateAttackScenario(vulnerability: Vulnerability): Promise<string>
  
  // Batch Processing
  async generateExplanationsBatch(vulnerabilities: Vulnerability[]): Promise<Explanation[]>
  
  // Caching
  async getCachedExplanation(vulnHash: string): Promise<Explanation | null>
  async cacheExplanation(vulnHash: string, explanation: Explanation): Promise<void>
  
  // Prompt Management
  buildPrompt(vulnerability: Vulnerability, context: PromptContext): string
  optimizePrompt(prompt: string): string
  validateResponse(response: string): boolean
}
```

**Report Service**
```typescript
class ReportService {
  // Report Generation
  async generateReport(analysisId: string, format: 'pdf' | 'json'): Promise<Report>
  async getReport(reportId: string): Promise<Report>
  async listReports(userId: string): Promise<Report[]>
  
  // Export Methods
  async exportToPDF(analysisId: string): Promise<Buffer>
  async exportToJSON(analysisId: string): Promise<object>
  
  // Sharing
  async createShareLink(reportId: string, expiresIn: number): Promise<string>
  async getSharedReport(shareToken: string): Promise<Report>
}
```

**Dashboard Service**
```typescript
class DashboardService {
  // Summary Methods
  async getDashboardSummary(userId: string): Promise<DashboardSummary>
  async getSecurityScore(userId: string): Promise<SecurityScore>
  async getVulnerabilityTrends(userId: string, period: string): Promise<TrendData>
  
  // Analytics Methods
  async getLearningProgress(userId: string): Promise<LearningProgress>
  async getCommonVulnerabilities(userId: string): Promise<VulnStats[]>
  async getImprovementMetrics(userId: string): Promise<ImprovementMetrics>
}
```

**User Service**
```typescript
class UserService {
  // Profile Methods
  async getProfile(userId: string): Promise<UserProfile>
  async updateProfile(userId: string, updates: ProfileUpdate): Promise<UserProfile>
  async deleteAccount(userId: string): Promise<void>
  
  // Preferences
  async getPreferences(userId: string): Promise<UserPreferences>
  async updatePreferences(userId: string, prefs: UserPreferences): Promise<void>
  
  // Usage Tracking
  async trackUsage(userId: string, action: string, metadata: object): Promise<void>
  async getUsageStats(userId: string): Promise<UsageStats>
}
```

**GitHub Service**
```typescript
class GitHubService {
  // Repository Methods
  async cloneRepository(repoUrl: string, branch: string): Promise<string>
  async validateRepository(repoUrl: string): Promise<boolean>
  async getRepositoryInfo(repoUrl: string): Promise<RepoInfo>
  
  // OAuth Methods
  async getOAuthToken(code: string): Promise<string>
  async getUserRepositories(token: string): Promise<Repository[]>
  
  // Webhook Methods
  async setupWebhook(repoUrl: string, token: string): Promise<void>
  async handleWebhook(payload: WebhookPayload): Promise<void>
}
```

#### 3.2.2 Service Communication Patterns

**Synchronous Communication**
- Direct HTTP calls for real-time operations
- Used for: Auth, user profile, dashboard queries
- Timeout: 5 seconds
- Retry: 3 attempts with exponential backoff

**Asynchronous Communication**
- SQS queues for long-running operations
- Used for: Code analysis, report generation, AI processing
- Visibility timeout: 5 minutes
- Dead letter queue for failed jobs

**Event-Driven Communication**
- EventBridge for system events
- Events: AnalysisCompleted, VulnerabilityDetected, UserRegistered
- Enables loose coupling and extensibility

### 3.3 Analysis Engine Components

#### 3.3.1 Static Analyzer Architecture

```typescript
class StaticAnalyzer {
  private semgrepEngine: SemgrepEngine;
  private astParser: ASTParser;
  private vulnerabilityClassifier: VulnerabilityClassifier;
  
  async analyzeCode(files: CodeFile[]): Promise<AnalysisResult> {
    const results: Vulnerability[] = [];
    
    for (const file of files) {
      // Run Semgrep rules
      const semgrepResults = await this.semgrepEngine.scan(file);
      
      // Parse AST for additional analysis
      const ast = await this.astParser.parse(file);
      const astResults = await this.analyzeAST(ast, file);
      
      // Combine and classify results
      const combined = [...semgrepResults, ...astResults];
      const classified = await this.vulnerabilityClassifier.classify(combined);
      
      results.push(...classified);
    }
    
    return {
      vulnerabilities: results,
      summary: this.generateSummary(results),
      securityScore: this.calculateSecurityScore(results)
    };
  }
  
  private async analyzeAST(ast: AST, file: CodeFile): Promise<Vulnerability[]> {
    // Custom AST-based analysis
    // - Detect hardcoded secrets
    // - Find insecure patterns
    // - Identify data flow issues
  }
  
  private calculateSecurityScore(vulnerabilities: Vulnerability[]): number {
    // Scoring algorithm
    const weights = { CRITICAL: 25, HIGH: 10, MEDIUM: 5, LOW: 2, INFO: 1 };
    const totalDeductions = vulnerabilities.reduce((sum, v) => sum + weights[v.severity], 0);
    return Math.max(0, 100 - totalDeductions);
  }
}
```

#### 3.3.2 Semgrep Rule Configuration

```yaml
# Custom Semgrep Rules for SecureTrail

rules:
  - id: sql-injection-string-concat
    pattern: |
      $QUERY = "SELECT * FROM " + $INPUT
    message: SQL injection vulnerability detected
    severity: ERROR
    languages: [javascript, python]
    metadata:
      category: security
      owasp: A03:2021
      cwe: CWE-89
      
  - id: xss-innerHTML
    pattern: |
      $ELEMENT.innerHTML = $INPUT
    message: XSS vulnerability via innerHTML
    severity: ERROR
    languages: [javascript]
    metadata:
      category: security
      owasp: A03:2021
      cwe: CWE-79
      
  - id: hardcoded-secret
    pattern-regex: |
      (password|secret|api_key|token)\s*=\s*["'][^"']{8,}["']
    message: Hardcoded secret detected
    severity: WARNING
    languages: [javascript, python]
    metadata:
      category: security
      cwe: CWE-798
      
  - id: insecure-random
    pattern: |
      Math.random()
    message: Insecure random number generation
    severity: WARNING
    languages: [javascript]
    metadata:
      category: security
      cwe: CWE-330
```

#### 3.3.3 Vulnerability Classifier

```typescript
class VulnerabilityClassifier {
  async classify(rawVulnerabilities: RawVulnerability[]): Promise<Vulnerability[]> {
    return rawVulnerabilities.map(raw => ({
      id: generateId(),
      type: this.mapToVulnerabilityType(raw),
      severity: this.calculateSeverity(raw),
      confidence: this.calculateConfidence(raw),
      file: raw.file,
      line: raw.line,
      column: raw.column,
      codeSnippet: this.extractCodeSnippet(raw),
      description: this.generateDescription(raw),
      owaspCategory: this.mapToOWASP(raw),
      cweId: this.mapToCWE(raw),
      metadata: raw.metadata
    }));
  }
  
  private calculateSeverity(vuln: RawVulnerability): Severity {
    // Severity calculation logic
    // Factors: vulnerability type, context, exploitability
    const baseScore = this.getBaseSeverity(vuln.type);
    const contextScore = this.analyzeContext(vuln);
    const exploitScore = this.assessExploitability(vuln);
    
    const finalScore = (baseScore + contextScore + exploitScore) / 3;
    
    if (finalScore >= 9) return 'CRITICAL';
    if (finalScore >= 7) return 'HIGH';
    if (finalScore >= 4) return 'MEDIUM';
    if (finalScore >= 1) return 'LOW';
    return 'INFO';
  }
  
  private mapToOWASP(vuln: RawVulnerability): string {
    const owaspMapping = {
      'SQL_INJECTION': 'A03:2021',
      'XSS': 'A03:2021',
      'BROKEN_AUTH': 'A07:2021',
      'SENSITIVE_DATA': 'A02:2021',
      'XXE': 'A05:2021',
      'BROKEN_ACCESS': 'A01:2021',
      'SECURITY_MISCONFIG': 'A05:2021',
      'INSECURE_DESERIALIZATION': 'A08:2021',
      'VULNERABLE_COMPONENTS': 'A06:2021',
      'INSUFFICIENT_LOGGING': 'A09:2021'
    };
    return owaspMapping[vuln.type] || 'Unknown';
  }
}
```


---

## 4. Data Architecture

### 4.1 Database Schema Design

#### 4.1.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                              │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐
│      users       │         │    analyses      │
├──────────────────┤         ├──────────────────┤
│ id (PK)          │────────<│ user_id (FK)     │
│ email (UNIQUE)   │    1:N  │ id (PK)          │
│ password_hash    │         │ status           │
│ name             │         │ source           │
│ role             │         │ source_url       │
│ oauth_provider   │         │ language         │
│ oauth_id         │         │ security_score   │
│ email_verified   │         │ total_files      │
│ preferences      │         │ total_lines      │
│ created_at       │         │ progress         │
│ updated_at       │         │ error_message    │
│ last_login_at    │         │ created_at       │
└──────────────────┘         │ completed_at     │
                             └──────────────────┘
                                      │
                                      │ 1:N
                                      ↓
                             ┌──────────────────┐
                             │ vulnerabilities  │
                             ├──────────────────┤
                             │ id (PK)          │
                             │ analysis_id (FK) │
                             │ type             │
                             │ severity         │
                             │ file             │
                             │ line             │
                             │ column           │
                             │ code_snippet     │
                             │ description      │
                             │ explanation      │
                             │ attack_scenario  │
                             │ impact           │
                             │ fix              │
                             │ secure_code      │
                             │ owasp_category   │
                             │ cwe_id           │
                             │ confidence       │
                             │ false_positive   │
                             │ resolved         │
                             │ created_at       │
                             └──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│   code_files     │         │ analysis_reports │
├──────────────────┤         ├──────────────────┤
│ id (PK)          │         │ id (PK)          │
│ analysis_id (FK) │────────<│ analysis_id (FK) │
│ file_name        │    1:N  │ format           │
│ file_path        │         │ s3_key           │
│ language         │         │ size             │
│ size             │         │ generated_at     │
│ lines_of_code    │         │ expires_at       │
│ s3_key           │         └──────────────────┘
│ hash             │
│ created_at       │
└──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│ learning_progress│         │   audit_logs     │
├──────────────────┤         ├──────────────────┤
│ id (PK)          │         │ id (PK)          │
│ user_id (FK)     │         │ user_id (FK)     │
│ vulnerability_type│        │ action           │
│ encounter_count  │         │ resource         │
│ resolved_count   │         │ resource_id      │
│ last_encountered │         │ ip_address       │
│ mastery_level    │         │ user_agent       │
└──────────────────┘         │ status           │
                             │ details          │
┌──────────────────┐         │ created_at       │
│  usage_metrics   │         └──────────────────┘
├──────────────────┤
│ id (PK)          │         ┌──────────────────┐
│ user_id (FK)     │         │   sessions       │
│ date             │         ├──────────────────┤
│ analysis_count   │         │ id (PK)          │
│ tokens_used      │         │ user_id (FK)     │
│ api_calls        │         │ token            │
│ storage_used     │         │ ip_address       │
└──────────────────┘         │ user_agent       │
                             │ expires_at       │
                             │ created_at       │
                             └──────────────────┘
```

#### 4.1.2 Table Definitions

**users table**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'student',
  oauth_provider VARCHAR(50),
  oauth_id VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  
  CONSTRAINT valid_role CHECK (role IN ('student', 'educator', 'admin')),
  CONSTRAINT valid_oauth CHECK (
    (oauth_provider IS NULL AND oauth_id IS NULL AND password_hash IS NOT NULL) OR
    (oauth_provider IS NOT NULL AND oauth_id IS NOT NULL)
  )
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);
```

**analyses table**
```sql
CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  source VARCHAR(50) NOT NULL,
  source_url TEXT,
  language VARCHAR(50),
  security_score INTEGER CHECK (security_score >= 0 AND security_score <= 100),
  total_files INTEGER DEFAULT 0,
  total_lines INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT valid_source CHECK (source IN ('upload', 'github'))
);

CREATE INDEX idx_analyses_user_id ON analyses(user_id);
CREATE INDEX idx_analyses_status ON analyses(status);
CREATE INDEX idx_analyses_created_at ON analyses(created_at DESC);
CREATE INDEX idx_analyses_user_status ON analyses(user_id, status);
```

**vulnerabilities table**
```sql
CREATE TABLE vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  file VARCHAR(500) NOT NULL,
  line INTEGER NOT NULL,
  column INTEGER,
  code_snippet TEXT NOT NULL,
  description TEXT NOT NULL,
  explanation TEXT,
  attack_scenario TEXT,
  impact TEXT,
  fix TEXT,
  secure_code TEXT,
  owasp_category VARCHAR(50),
  cwe_id VARCHAR(50),
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  false_positive BOOLEAN DEFAULT FALSE,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_severity CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'))
);

CREATE INDEX idx_vulnerabilities_analysis_id ON vulnerabilities(analysis_id);
CREATE INDEX idx_vulnerabilities_type ON vulnerabilities(type);
CREATE INDEX idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX idx_vulnerabilities_resolved ON vulnerabilities(resolved);
CREATE INDEX idx_vulnerabilities_analysis_severity ON vulnerabilities(analysis_id, severity);
```

**code_files table**
```sql
CREATE TABLE code_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  language VARCHAR(50),
  size INTEGER NOT NULL,
  lines_of_code INTEGER,
  s3_key VARCHAR(500) NOT NULL,
  hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_code_files_analysis_id ON code_files(analysis_id);
CREATE INDEX idx_code_files_hash ON code_files(hash);
```

**learning_progress table**
```sql
CREATE TABLE learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vulnerability_type VARCHAR(100) NOT NULL,
  encounter_count INTEGER DEFAULT 0,
  resolved_count INTEGER DEFAULT 0,
  last_encountered TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  
  UNIQUE(user_id, vulnerability_type)
);

CREATE INDEX idx_learning_progress_user_id ON learning_progress(user_id);
CREATE INDEX idx_learning_progress_type ON learning_progress(vulnerability_type);
```

**analysis_reports table**
```sql
CREATE TABLE analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  format VARCHAR(10) NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  size INTEGER NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  
  CONSTRAINT valid_format CHECK (format IN ('pdf', 'json'))
);

CREATE INDEX idx_analysis_reports_analysis_id ON analysis_reports(analysis_id);
CREATE INDEX idx_analysis_reports_expires_at ON analysis_reports(expires_at);
```

**audit_logs table**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(20) NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_status CHECK (status IN ('success', 'failure'))
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource, resource_id);
```

**usage_metrics table**
```sql
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  analysis_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  storage_used BIGINT DEFAULT 0,
  
  UNIQUE(user_id, date)
);

CREATE INDEX idx_usage_metrics_user_date ON usage_metrics(user_id, date DESC);
```

**sessions table**
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

### 4.2 Data Access Patterns

#### 4.2.1 Common Queries

**Get User Dashboard Summary**
```sql
-- Optimized query for dashboard
SELECT 
  u.id,
  u.name,
  u.email,
  COUNT(DISTINCT a.id) as total_analyses,
  AVG(a.security_score) as average_score,
  COUNT(DISTINCT v.id) FILTER (WHERE v.severity = 'CRITICAL') as critical_count,
  COUNT(DISTINCT v.id) FILTER (WHERE v.severity = 'HIGH') as high_count,
  COUNT(DISTINCT v.id) FILTER (WHERE v.severity = 'MEDIUM') as medium_count,
  COUNT(DISTINCT v.id) FILTER (WHERE v.severity = 'LOW') as low_count
FROM users u
LEFT JOIN analyses a ON u.id = a.user_id AND a.status = 'completed'
LEFT JOIN vulnerabilities v ON a.id = v.analysis_id AND v.resolved = FALSE
WHERE u.id = $1
GROUP BY u.id, u.name, u.email;
```

**Get Analysis with Vulnerabilities**
```sql
-- Fetch analysis with all vulnerabilities
SELECT 
  a.*,
  json_agg(
    json_build_object(
      'id', v.id,
      'type', v.type,
      'severity', v.severity,
      'file', v.file,
      'line', v.line,
      'description', v.description,
      'resolved', v.resolved
    ) ORDER BY 
      CASE v.severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
      END
  ) as vulnerabilities
FROM analyses a
LEFT JOIN vulnerabilities v ON a.id = v.analysis_id
WHERE a.id = $1
GROUP BY a.id;
```

**Get Learning Progress**
```sql
-- Calculate user's learning progress
SELECT 
  lp.vulnerability_type,
  lp.encounter_count,
  lp.resolved_count,
  lp.mastery_level,
  ROUND((lp.resolved_count::DECIMAL / NULLIF(lp.encounter_count, 0)) * 100, 2) as resolution_rate
FROM learning_progress lp
WHERE lp.user_id = $1
ORDER BY lp.mastery_level DESC, lp.encounter_count DESC;
```

**Get Vulnerability Trends**
```sql
-- Get vulnerability trends over time
SELECT 
  DATE_TRUNC('week', a.created_at) as week,
  v.severity,
  COUNT(*) as count
FROM analyses a
JOIN vulnerabilities v ON a.id = v.analysis_id
WHERE a.user_id = $1
  AND a.created_at >= NOW() - INTERVAL '3 months'
  AND a.status = 'completed'
GROUP BY week, v.severity
ORDER BY week DESC, v.severity;
```

#### 4.2.2 Data Access Layer (Repository Pattern)

```typescript
// Base Repository
abstract class BaseRepository<T> {
  constructor(protected db: Database) {}
  
  abstract tableName: string;
  
  async findById(id: string): Promise<T | null> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }
  
  async create(data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const result = await this.db.query(
      `INSERT INTO ${this.tableName} (${keys.join(', ')}) 
       VALUES (${placeholders}) 
       RETURNING *`,
      values
    );
    return result.rows[0];
  }
  
  async update(id: string, data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
    
    const result = await this.db.query(
      `UPDATE ${this.tableName} 
       SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  }
  
  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rowCount > 0;
  }
}

// User Repository
class UserRepository extends BaseRepository<User> {
  tableName = 'users';
  
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }
  
  async findByOAuth(provider: string, oauthId: string): Promise<User | null> {
    const result = await this.db.query(
      'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
      [provider, oauthId]
    );
    return result.rows[0] || null;
  }
  
  async updateLastLogin(userId: string): Promise<void> {
    await this.db.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  }
}

// Analysis Repository
class AnalysisRepository extends BaseRepository<Analysis> {
  tableName = 'analyses';
  
  async findByUserId(userId: string, pagination: Pagination): Promise<PaginatedResult<Analysis>> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    
    const [dataResult, countResult] = await Promise.all([
      this.db.query(
        `SELECT * FROM analyses 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      this.db.query(
        'SELECT COUNT(*) FROM analyses WHERE user_id = $1',
        [userId]
      )
    ]);
    
    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    };
  }
  
  async updateStatus(analysisId: string, status: AnalysisStatus, progress?: number): Promise<void> {
    const updates: string[] = ['status = $2'];
    const values: any[] = [analysisId, status];
    
    if (progress !== undefined) {
      updates.push('progress = $3');
      values.push(progress);
    }
    
    if (status === 'completed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }
    
    await this.db.query(
      `UPDATE analyses SET ${updates.join(', ')} WHERE id = $1`,
      values
    );
  }
}

// Vulnerability Repository
class VulnerabilityRepository extends BaseRepository<Vulnerability> {
  tableName = 'vulnerabilities';
  
  async findByAnalysisId(
    analysisId: string, 
    filters?: VulnerabilityFilter
  ): Promise<Vulnerability[]> {
    let query = 'SELECT * FROM vulnerabilities WHERE analysis_id = $1';
    const params: any[] = [analysisId];
    let paramIndex = 2;
    
    if (filters?.severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(filters.severity);
      paramIndex++;
    }
    
    if (filters?.type) {
      query += ` AND type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }
    
    if (filters?.resolved !== undefined) {
      query += ` AND resolved = $${paramIndex}`;
      params.push(filters.resolved);
      paramIndex++;
    }
    
    query += ' ORDER BY CASE severity WHEN \'CRITICAL\' THEN 1 WHEN \'HIGH\' THEN 2 WHEN \'MEDIUM\' THEN 3 WHEN \'LOW\' THEN 4 ELSE 5 END';
    
    const result = await this.db.query(query, params);
    return result.rows;
  }
  
  async markResolved(vulnId: string): Promise<void> {
    await this.db.query(
      'UPDATE vulnerabilities SET resolved = TRUE WHERE id = $1',
      [vulnId]
    );
  }
  
  async getStatsByType(userId: string): Promise<VulnerabilityStats[]> {
    const result = await this.db.query(
      `SELECT 
        v.type,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE v.resolved = TRUE) as resolved_count,
        COUNT(*) FILTER (WHERE v.severity = 'CRITICAL') as critical_count,
        COUNT(*) FILTER (WHERE v.severity = 'HIGH') as high_count
       FROM vulnerabilities v
       JOIN analyses a ON v.analysis_id = a.id
       WHERE a.user_id = $1
       GROUP BY v.type
       ORDER BY total_count DESC`,
      [userId]
    );
    return result.rows;
  }
}
```

### 4.3 Caching Strategy

#### 4.3.1 Redis Cache Structure

```typescript
// Cache Keys
const CACHE_KEYS = {
  USER_SESSION: (userId: string) => `session:${userId}`,
  USER_PROFILE: (userId: string) => `user:${userId}:profile`,
  ANALYSIS_RESULT: (analysisId: string) => `analysis:${analysisId}:result`,
  DASHBOARD_SUMMARY: (userId: string) => `dashboard:${userId}:summary`,
  AI_EXPLANATION: (vulnHash: string) => `ai:explanation:${vulnHash}`,
  RATE_LIMIT: (userId: string) => `ratelimit:${userId}`,
  VULNERABILITY_LIST: (analysisId: string) => `analysis:${analysisId}:vulnerabilities`
};

// Cache TTLs (in seconds)
const CACHE_TTL = {
  SESSION: 86400, // 24 hours
  USER_PROFILE: 3600, // 1 hour
  ANALYSIS_RESULT: 3600, // 1 hour
  DASHBOARD_SUMMARY: 300, // 5 minutes
  AI_EXPLANATION: 604800, // 7 days
  RATE_LIMIT: 3600, // 1 hour
  VULNERABILITY_LIST: 3600 // 1 hour
};

// Cache Service
class CacheService {
  constructor(private redis: Redis) {}
  
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }
  
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
  
  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  // Cache-aside pattern
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) return cached;
    
    const fresh = await fetcher();
    await this.set(key, fresh, ttl);
    return fresh;
  }
}
```

#### 4.3.2 Cache Invalidation Strategy

```typescript
class CacheInvalidationService {
  constructor(private cache: CacheService) {}
  
  // Invalidate user-related caches
  async invalidateUserCaches(userId: string): Promise<void> {
    await Promise.all([
      this.cache.delete(CACHE_KEYS.USER_PROFILE(userId)),
      this.cache.delete(CACHE_KEYS.DASHBOARD_SUMMARY(userId)),
      this.cache.deletePattern(`analysis:*:${userId}:*`)
    ]);
  }
  
  // Invalidate analysis-related caches
  async invalidateAnalysisCaches(analysisId: string, userId: string): Promise<void> {
    await Promise.all([
      this.cache.delete(CACHE_KEYS.ANALYSIS_RESULT(analysisId)),
      this.cache.delete(CACHE_KEYS.VULNERABILITY_LIST(analysisId)),
      this.cache.delete(CACHE_KEYS.DASHBOARD_SUMMARY(userId))
    ]);
  }
  
  // Invalidate on vulnerability update
  async invalidateVulnerabilityCaches(vulnId: string, analysisId: string, userId: string): Promise<void> {
    await Promise.all([
      this.cache.delete(CACHE_KEYS.VULNERABILITY_LIST(analysisId)),
      this.cache.delete(CACHE_KEYS.ANALYSIS_RESULT(analysisId)),
      this.cache.delete(CACHE_KEYS.DASHBOARD_SUMMARY(userId))
    ]);
  }
}
```


---

## 5. API Design

### 5.1 REST API Specification

#### 5.1.1 API Versioning Strategy
- URL-based versioning: `/api/v1/...`
- Version in Accept header as fallback
- Deprecation policy: 6 months notice
- Backward compatibility within major versions

#### 5.1.2 Authentication & Authorization

**JWT Token Structure**
```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-uuid",
    "email": "user@example.com",
    "role": "student",
    "iat": 1708012800,
    "exp": 1708099200
  }
}
```

**Authorization Header**
```
Authorization: Bearer <jwt-token>
```

**Rate Limiting Headers**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1708016400
```

#### 5.1.3 API Endpoints Specification

**Authentication Endpoints**

```yaml
POST /api/v1/auth/register:
  summary: Register a new user
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          required: [email, password, name]
          properties:
            email:
              type: string
              format: email
            password:
              type: string
              minLength: 8
            name:
              type: string
            role:
              type: string
              enum: [student, educator]
              default: student
  responses:
    201:
      description: User created successfully
      content:
        application/json:
          schema:
            type: object
            properties:
              userId:
                type: string
                format: uuid
              email:
                type: string
              token:
                type: string
              expiresIn:
                type: integer
    400:
      description: Invalid input
    409:
      description: Email already exists

POST /api/v1/auth/login:
  summary: Authenticate user
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          required: [email, password]
          properties:
            email:
              type: string
            password:
              type: string
  responses:
    200:
      description: Login successful
      content:
        application/json:
          schema:
            type: object
            properties:
              userId:
                type: string
              token:
                type: string
              refreshToken:
                type: string
              expiresIn:
                type: integer
    401:
      description: Invalid credentials
    429:
      description: Too many login attempts

POST /api/v1/auth/refresh:
  summary: Refresh access token
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          required: [refreshToken]
          properties:
            refreshToken:
              type: string
  responses:
    200:
      description: Token refreshed
    401:
      description: Invalid refresh token

POST /api/v1/auth/logout:
  summary: Logout user
  security:
    - bearerAuth: []
  responses:
    200:
      description: Logout successful
    401:
      description: Unauthorized

GET /api/v1/auth/oauth/{provider}/url:
  summary: Get OAuth authorization URL
  parameters:
    - name: provider
      in: path
      required: true
      schema:
        type: string
        enum: [google, github]
  responses:
    200:
      description: OAuth URL generated
      content:
        application/json:
          schema:
            type: object
            properties:
              url:
                type: string
              state:
                type: string

POST /api/v1/auth/oauth/{provider}/callback:
  summary: Handle OAuth callback
  parameters:
    - name: provider
      in: path
      required: true
      schema:
        type: string
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          required: [code, state]
          properties:
            code:
              type: string
            state:
              type: string
  responses:
    200:
      description: OAuth authentication successful
```

**Analysis Endpoints**

```yaml
POST /api/v1/analyses/upload:
  summary: Upload code files for analysis
  security:
    - bearerAuth: []
  requestBody:
    required: true
    content:
      multipart/form-data:
        schema:
          type: object
          required: [files]
          properties:
            files:
              type: array
              items:
                type: string
                format: binary
            language:
              type: string
              enum: [javascript, typescript, python]
  responses:
    202:
      description: Analysis queued
      content:
        application/json:
          schema:
            type: object
            properties:
              analysisId:
                type: string
                format: uuid
              status:
                type: string
                enum: [pending, processing]
              estimatedTime:
                type: integer
                description: Estimated completion time in seconds
    400:
      description: Invalid files
    413:
      description: File size exceeds limit
    429:
      description: Rate limit exceeded

POST /api/v1/analyses/github:
  summary: Analyze GitHub repository
  security:
    - bearerAuth: []
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          required: [repoUrl]
          properties:
            repoUrl:
              type: string
              format: uri
            branch:
              type: string
              default: main
  responses:
    202:
      description: Analysis queued
    400:
      description: Invalid repository URL
    403:
      description: Repository access denied

GET /api/v1/analyses/{analysisId}:
  summary: Get analysis results
  security:
    - bearerAuth: []
  parameters:
    - name: analysisId
      in: path
      required: true
      schema:
        type: string
        format: uuid
  responses:
    200:
      description: Analysis results
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/AnalysisResult'
    404:
      description: Analysis not found
    403:
      description: Access denied

GET /api/v1/analyses/{analysisId}/status:
  summary: Get analysis status
  security:
    - bearerAuth: []
  parameters:
    - name: analysisId
      in: path
      required: true
      schema:
        type: string
  responses:
    200:
      description: Analysis status
      content:
        application/json:
          schema:
            type: object
            properties:
              status:
                type: string
                enum: [pending, processing, completed, failed]
              progress:
                type: integer
                minimum: 0
                maximum: 100
              message:
                type: string
              currentFile:
                type: string

GET /api/v1/analyses:
  summary: List user's analyses
  security:
    - bearerAuth: []
  parameters:
    - name: page
      in: query
      schema:
        type: integer
        default: 1
    - name: limit
      in: query
      schema:
        type: integer
        default: 20
        maximum: 100
    - name: status
      in: query
      schema:
        type: string
        enum: [pending, processing, completed, failed]
    - name: sortBy
      in: query
      schema:
        type: string
        enum: [createdAt, securityScore]
        default: createdAt
    - name: order
      in: query
      schema:
        type: string
        enum: [asc, desc]
        default: desc
  responses:
    200:
      description: List of analyses
      content:
        application/json:
          schema:
            type: object
            properties:
              data:
                type: array
                items:
                  $ref: '#/components/schemas/AnalysisSummary'
              pagination:
                $ref: '#/components/schemas/Pagination'

DELETE /api/v1/analyses/{analysisId}:
  summary: Delete analysis
  security:
    - bearerAuth: []
  parameters:
    - name: analysisId
      in: path
      required: true
      schema:
        type: string
  responses:
    204:
      description: Analysis deleted
    404:
      description: Analysis not found
    403:
      description: Access denied
```

**Vulnerability Endpoints**

```yaml
GET /api/v1/analyses/{analysisId}/vulnerabilities:
  summary: Get vulnerabilities for analysis
  security:
    - bearerAuth: []
  parameters:
    - name: analysisId
      in: path
      required: true
      schema:
        type: string
    - name: severity
      in: query
      schema:
        type: string
        enum: [CRITICAL, HIGH, MEDIUM, LOW, INFO]
    - name: type
      in: query
      schema:
        type: string
    - name: resolved
      in: query
      schema:
        type: boolean
  responses:
    200:
      description: List of vulnerabilities
      content:
        application/json:
          schema:
            type: array
            items:
              $ref: '#/components/schemas/Vulnerability'

GET /api/v1/vulnerabilities/{vulnId}:
  summary: Get vulnerability details
  security:
    - bearerAuth: []
  parameters:
    - name: vulnId
      in: path
      required: true
      schema:
        type: string
  responses:
    200:
      description: Vulnerability details
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/VulnerabilityDetail'

GET /api/v1/vulnerabilities/{vulnId}/explanation:
  summary: Get AI-generated explanation
  security:
    - bearerAuth: []
  parameters:
    - name: vulnId
      in: path
      required: true
      schema:
        type: string
    - name: level
      in: query
      schema:
        type: string
        enum: [beginner, intermediate, advanced]
        default: beginner
  responses:
    200:
      description: Detailed explanation
      content:
        application/json:
          schema:
            type: object
            properties:
              explanation:
                type: string
              attackScenario:
                type: string
              impact:
                type: string
              prevention:
                type: string
              resources:
                type: array
                items:
                  type: string

PATCH /api/v1/vulnerabilities/{vulnId}/resolve:
  summary: Mark vulnerability as resolved
  security:
    - bearerAuth: []
  parameters:
    - name: vulnId
      in: path
      required: true
      schema:
        type: string
  responses:
    200:
      description: Vulnerability marked as resolved
    404:
      description: Vulnerability not found

POST /api/v1/vulnerabilities/{vulnId}/false-positive:
  summary: Report false positive
  security:
    - bearerAuth: []
  parameters:
    - name: vulnId
      in: path
      required: true
      schema:
        type: string
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          required: [reason]
          properties:
            reason:
              type: string
  responses:
    200:
      description: False positive reported
```

**Dashboard Endpoints**

```yaml
GET /api/v1/dashboard/summary:
  summary: Get dashboard summary
  security:
    - bearerAuth: []
  responses:
    200:
      description: Dashboard summary
      content:
        application/json:
          schema:
            type: object
            properties:
              totalAnalyses:
                type: integer
              averageScore:
                type: number
              scoreImprovement:
                type: number
              recentAnalyses:
                type: array
                items:
                  $ref: '#/components/schemas/AnalysisSummary'
              vulnerabilityBreakdown:
                type: object
                properties:
                  critical:
                    type: integer
                  high:
                    type: integer
                  medium:
                    type: integer
                  low:
                    type: integer
                  info:
                    type: integer
              learningProgress:
                type: integer
                minimum: 0
                maximum: 100

GET /api/v1/dashboard/trends:
  summary: Get vulnerability trends
  security:
    - bearerAuth: []
  parameters:
    - name: period
      in: query
      schema:
        type: string
        enum: [week, month, quarter, year]
        default: month
  responses:
    200:
      description: Trend data
      content:
        application/json:
          schema:
            type: object
            properties:
              labels:
                type: array
                items:
                  type: string
              datasets:
                type: array
                items:
                  type: object
                  properties:
                    label:
                      type: string
                    data:
                      type: array
                      items:
                        type: integer

GET /api/v1/dashboard/learning-progress:
  summary: Get learning progress
  security:
    - bearerAuth: []
  responses:
    200:
      description: Learning progress data
      content:
        application/json:
          schema:
            type: array
            items:
              type: object
              properties:
                vulnerabilityType:
                  type: string
                encounterCount:
                  type: integer
                resolvedCount:
                  type: integer
                masteryLevel:
                  type: integer
                resolutionRate:
                  type: number
```

**Report Endpoints**

```yaml
POST /api/v1/reports/generate:
  summary: Generate analysis report
  security:
    - bearerAuth: []
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          required: [analysisId, format]
          properties:
            analysisId:
              type: string
              format: uuid
            format:
              type: string
              enum: [pdf, json]
  responses:
    202:
      description: Report generation queued
      content:
        application/json:
          schema:
            type: object
            properties:
              reportId:
                type: string
              status:
                type: string
                enum: [pending, processing]

GET /api/v1/reports/{reportId}:
  summary: Get report
  security:
    - bearerAuth: []
  parameters:
    - name: reportId
      in: path
      required: true
      schema:
        type: string
  responses:
    200:
      description: Report file
      content:
        application/pdf:
          schema:
            type: string
            format: binary
        application/json:
          schema:
            type: object

GET /api/v1/reports/{reportId}/download:
  summary: Download report
  security:
    - bearerAuth: []
  parameters:
    - name: reportId
      in: path
      required: true
      schema:
        type: string
  responses:
    200:
      description: Report download
      headers:
        Content-Disposition:
          schema:
            type: string
            example: attachment; filename="security-report.pdf"

POST /api/v1/reports/{reportId}/share:
  summary: Create shareable link
  security:
    - bearerAuth: []
  parameters:
    - name: reportId
      in: path
      required: true
      schema:
        type: string
  requestBody:
    content:
      application/json:
        schema:
          type: object
          properties:
            expiresIn:
              type: integer
              description: Expiration time in hours
              default: 24
  responses:
    200:
      description: Share link created
      content:
        application/json:
          schema:
            type: object
            properties:
              shareUrl:
                type: string
              expiresAt:
                type: string
                format: date-time
```

**User Endpoints**

```yaml
GET /api/v1/users/profile:
  summary: Get user profile
  security:
    - bearerAuth: []
  responses:
    200:
      description: User profile
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/UserProfile'

PUT /api/v1/users/profile:
  summary: Update user profile
  security:
    - bearerAuth: []
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          properties:
            name:
              type: string
            preferences:
              type: object
              properties:
                explanationLevel:
                  type: string
                  enum: [beginner, intermediate, advanced]
                emailNotifications:
                  type: boolean
                theme:
                  type: string
                  enum: [light, dark, auto]
  responses:
    200:
      description: Profile updated

GET /api/v1/users/usage:
  summary: Get usage statistics
  security:
    - bearerAuth: []
  responses:
    200:
      description: Usage statistics
      content:
        application/json:
          schema:
            type: object
            properties:
              currentPeriod:
                type: object
                properties:
                  analysisCount:
                    type: integer
                  analysisLimit:
                    type: integer
                  tokensUsed:
                    type: integer
                  storageUsed:
                    type: integer
              history:
                type: array
                items:
                  type: object
```

### 5.2 API Response Formats

#### 5.2.1 Success Response Format

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2026-02-15T10:30:00Z",
    "requestId": "req-uuid"
  }
}
```

#### 5.2.2 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error details
    },
    "field": "fieldName" // For validation errors
  },
  "meta": {
    "timestamp": "2026-02-15T10:30:00Z",
    "requestId": "req-uuid"
  }
}
```

#### 5.2.3 Pagination Response Format

```json
{
  "success": true,
  "data": [
    // Array of items
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 5.3 Error Codes

```typescript
enum ErrorCode {
  // Authentication Errors (1000-1099)
  INVALID_CREDENTIALS = 'AUTH_1001',
  TOKEN_EXPIRED = 'AUTH_1002',
  TOKEN_INVALID = 'AUTH_1003',
  UNAUTHORIZED = 'AUTH_1004',
  EMAIL_ALREADY_EXISTS = 'AUTH_1005',
  WEAK_PASSWORD = 'AUTH_1006',
  
  // Validation Errors (2000-2099)
  INVALID_INPUT = 'VAL_2001',
  MISSING_REQUIRED_FIELD = 'VAL_2002',
  INVALID_FILE_TYPE = 'VAL_2003',
  FILE_TOO_LARGE = 'VAL_2004',
  INVALID_URL = 'VAL_2005',
  
  // Resource Errors (3000-3099)
  RESOURCE_NOT_FOUND = 'RES_3001',
  RESOURCE_ALREADY_EXISTS = 'RES_3002',
  RESOURCE_DELETED = 'RES_3003',
  
  // Rate Limiting (4000-4099)
  RATE_LIMIT_EXCEEDED = 'RATE_4001',
  QUOTA_EXCEEDED = 'RATE_4002',
  
  // Analysis Errors (5000-5099)
  ANALYSIS_FAILED = 'ANALYSIS_5001',
  ANALYSIS_TIMEOUT = 'ANALYSIS_5002',
  UNSUPPORTED_LANGUAGE = 'ANALYSIS_5003',
  
  // Server Errors (9000-9099)
  INTERNAL_SERVER_ERROR = 'SERVER_9001',
  SERVICE_UNAVAILABLE = 'SERVER_9002',
  DATABASE_ERROR = 'SERVER_9003'
}
```


---

## 6. Security Architecture

### 6.1 Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                           │
└─────────────────────────────────────────────────────────────┘

Layer 1: Network Security
├─ AWS WAF (Web Application Firewall)
├─ DDoS Protection (AWS Shield)
├─ VPC with Security Groups
├─ Network ACLs
└─ Private Subnets for Backend

Layer 2: Application Security
├─ Input Validation & Sanitization
├─ Output Encoding
├─ CSRF Protection
├─ XSS Prevention
├─ SQL Injection Prevention
└─ Rate Limiting

Layer 3: Authentication & Authorization
├─ AWS Cognito User Pools
├─ JWT Token-based Auth
├─ OAuth 2.0 Integration
├─ MFA Support
├─ Role-Based Access Control (RBAC)
└─ Session Management

Layer 4: Data Security
├─ Encryption at Rest (AES-256)
├─ Encryption in Transit (TLS 1.3)
├─ AWS KMS for Key Management
├─ Secure Secret Storage (AWS Secrets Manager)
└─ Data Anonymization

Layer 5: Monitoring & Auditing
├─ CloudWatch Logs
├─ Security Event Logging
├─ Audit Trail
├─ Anomaly Detection
└─ Incident Response
```

### 6.2 Authentication Implementation

#### 6.2.1 Password Security

```typescript
import bcrypt from 'bcrypt';
import { z } from 'zod';

// Password validation schema
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

class PasswordService {
  private readonly SALT_ROUNDS = 12;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  
  async hashPassword(password: string): Promise<string> {
    // Validate password strength
    passwordSchema.parse(password);
    
    // Hash with bcrypt
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }
  
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
  
  async checkLoginAttempts(userId: string): Promise<boolean> {
    const key = `login_attempts:${userId}`;
    const attempts = await redis.get(key);
    
    if (attempts && parseInt(attempts) >= this.MAX_LOGIN_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      if (ttl > 0) {
        throw new Error(`Account locked. Try again in ${Math.ceil(ttl / 60)} minutes`);
      }
    }
    
    return true;
  }
  
  async recordLoginAttempt(userId: string, success: boolean): Promise<void> {
    const key = `login_attempts:${userId}`;
    
    if (success) {
      await redis.del(key);
    } else {
      await redis.incr(key);
      await redis.expire(key, this.LOCKOUT_DURATION / 1000);
    }
  }
}
```

#### 6.2.2 JWT Token Management

```typescript
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

interface TokenPayload {
  sub: string; // user ID
  email: string;
  role: string;
  iat: number;
  exp: number;
  jti: string; // JWT ID for revocation
}

class TokenService {
  private readonly ACCESS_TOKEN_EXPIRY = '24h';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly PRIVATE_KEY: string;
  private readonly PUBLIC_KEY: string;
  
  constructor() {
    // Load RSA keys from AWS Secrets Manager
    this.PRIVATE_KEY = process.env.JWT_PRIVATE_KEY!;
    this.PUBLIC_KEY = process.env.JWT_PUBLIC_KEY!;
  }
  
  generateAccessToken(user: User): string {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      jti: uuidv4()
    };
    
    return jwt.sign(payload, this.PRIVATE_KEY, {
      algorithm: 'RS256',
      expiresIn: this.ACCESS_TOKEN_EXPIRY
    });
  }
  
  generateRefreshToken(userId: string): string {
    const payload = {
      sub: userId,
      type: 'refresh',
      jti: uuidv4()
    };
    
    return jwt.sign(payload, this.PRIVATE_KEY, {
      algorithm: 'RS256',
      expiresIn: this.REFRESH_TOKEN_EXPIRY
    });
  }
  
  verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.PUBLIC_KEY, {
        algorithms: ['RS256']
      }) as TokenPayload;
      
      // Check if token is revoked
      if (this.isTokenRevoked(decoded.jti)) {
        throw new Error('Token has been revoked');
      }
      
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
  
  async revokeToken(jti: string): Promise<void> {
    const key = `revoked_token:${jti}`;
    await redis.set(key, '1', 'EX', 24 * 60 * 60); // 24 hours
  }
  
  private async isTokenRevoked(jti: string): Promise<boolean> {
    const key = `revoked_token:${jti}`;
    const revoked = await redis.get(key);
    return revoked === '1';
  }
}
```

#### 6.2.3 OAuth Integration

```typescript
class OAuthService {
  private readonly GOOGLE_CLIENT_ID: string;
  private readonly GOOGLE_CLIENT_SECRET: string;
  private readonly GITHUB_CLIENT_ID: string;
  private readonly GITHUB_CLIENT_SECRET: string;
  private readonly REDIRECT_URI: string;
  
  async getGoogleAuthUrl(): Promise<string> {
    const state = this.generateState();
    await this.storeState(state);
    
    const params = new URLSearchParams({
      client_id: this.GOOGLE_CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state
    });
    
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  
  async handleGoogleCallback(code: string, state: string): Promise<User> {
    // Verify state
    await this.verifyState(state);
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: this.GOOGLE_CLIENT_ID,
        client_secret: this.GOOGLE_CLIENT_SECRET,
        redirect_uri: this.REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });
    
    const tokens = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    
    const googleUser = await userResponse.json();
    
    // Find or create user
    let user = await userRepository.findByOAuth('google', googleUser.id);
    
    if (!user) {
      user = await userRepository.create({
        email: googleUser.email,
        name: googleUser.name,
        oauthProvider: 'google',
        oauthId: googleUser.id,
        emailVerified: true
      });
    }
    
    return user;
  }
  
  private generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  private async storeState(state: string): Promise<void> {
    await redis.set(`oauth_state:${state}`, '1', 'EX', 600); // 10 minutes
  }
  
  private async verifyState(state: string): Promise<void> {
    const key = `oauth_state:${state}`;
    const exists = await redis.get(key);
    
    if (!exists) {
      throw new Error('Invalid or expired state');
    }
    
    await redis.del(key);
  }
}
```

### 6.3 Input Validation & Sanitization

```typescript
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

// Validation schemas
const schemas = {
  email: z.string().email(),
  url: z.string().url(),
  uuid: z.string().uuid(),
  
  codeUpload: z.object({
    files: z.array(z.object({
      name: z.string().max(255),
      size: z.number().max(10 * 1024 * 1024), // 10MB
      type: z.enum([
        'application/javascript',
        'text/javascript',
        'application/x-python',
        'text/x-python',
        'text/plain'
      ])
    })),
    language: z.enum(['javascript', 'typescript', 'python']).optional()
  }),
  
  githubRepo: z.object({
    repoUrl: z.string().url().refine(url => {
      return url.includes('github.com');
    }, 'Must be a GitHub URL'),
    branch: z.string().max(100).default('main')
  }),
  
  userProfile: z.object({
    name: z.string().min(1).max(255),
    preferences: z.object({
      explanationLevel: z.enum(['beginner', 'intermediate', 'advanced']),
      emailNotifications: z.boolean(),
      theme: z.enum(['light', 'dark', 'auto'])
    }).optional()
  })
};

class ValidationService {
  validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors);
      }
      throw error;
    }
  }
  
  sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre'],
      ALLOWED_ATTR: []
    });
  }
  
  sanitizeFilename(filename: string): string {
    // Remove path traversal attempts
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
  
  validateGitHubUrl(url: string): boolean {
    if (!validator.isURL(url)) return false;
    
    const githubPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/;
    return githubPattern.test(url);
  }
  
  sanitizeSqlInput(input: string): string {
    // This is a backup - we use parameterized queries
    return input.replace(/['";\\]/g, '');
  }
}

// Middleware for request validation
function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Validation failed',
            details: error.errors
          }
        });
      } else {
        next(error);
      }
    }
  };
}
```

### 6.4 Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

class RateLimitService {
  private redis: Redis;
  
  // General API rate limit
  generalLimiter = rateLimit({
    store: new RedisStore({
      client: this.redis,
      prefix: 'rl:general:'
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 requests per hour
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.'
      }
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  
  // Strict rate limit for authentication
  authLimiter = rateLimit({
    store: new RedisStore({
      client: this.redis,
      prefix: 'rl:auth:'
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    skipSuccessfulRequests: true,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts. Please try again later.'
      }
    }
  });
  
  // Analysis upload rate limit
  analysisLimiter = rateLimit({
    store: new RedisStore({
      client: this.redis,
      prefix: 'rl:analysis:'
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 analyses per hour
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Analysis quota exceeded. Please upgrade or try again later.'
      }
    }
  });
  
  // Custom rate limiter based on user tier
  async checkUserQuota(userId: string, action: string): Promise<boolean> {
    const user = await userRepository.findById(userId);
    const quotas = this.getQuotaLimits(user.role);
    
    const key = `quota:${userId}:${action}:${this.getCurrentPeriod()}`;
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, 24 * 60 * 60); // 24 hours
    }
    
    if (current > quotas[action]) {
      throw new Error('Quota exceeded');
    }
    
    return true;
  }
  
  private getQuotaLimits(role: string): Record<string, number> {
    const quotas = {
      student: {
        analyses: 10,
        reports: 5,
        storage: 100 * 1024 * 1024 // 100MB
      },
      educator: {
        analyses: 50,
        reports: 25,
        storage: 500 * 1024 * 1024 // 500MB
      },
      admin: {
        analyses: Infinity,
        reports: Infinity,
        storage: Infinity
      }
    };
    
    return quotas[role] || quotas.student;
  }
  
  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }
}
```

### 6.5 Security Headers

```typescript
import helmet from 'helmet';

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.securetrail.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  frameguard: {
    action: 'deny'
  }
});

// CORS configuration
export const corsOptions = {
  origin: (origin: string, callback: Function) => {
    const allowedOrigins = [
      'https://securetrail.com',
      'https://www.securetrail.com',
      'https://app.securetrail.com'
    ];
    
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000');
    }
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400 // 24 hours
};
```

### 6.6 Audit Logging

```typescript
class AuditLogger {
  async log(event: AuditEvent): Promise<void> {
    const auditLog = {
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      status: event.status,
      details: event.details,
      timestamp: new Date()
    };
    
    // Store in database
    await db.query(
      `INSERT INTO audit_logs 
       (user_id, action, resource, resource_id, ip_address, user_agent, status, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        auditLog.userId,
        auditLog.action,
        auditLog.resource,
        auditLog.resourceId,
        auditLog.ipAddress,
        auditLog.userAgent,
        auditLog.status,
        JSON.stringify(auditLog.details),
        auditLog.timestamp
      ]
    );
    
    // Also log to CloudWatch for real-time monitoring
    await cloudWatchLogger.log({
      level: event.status === 'success' ? 'info' : 'warn',
      message: `${event.action} on ${event.resource}`,
      ...auditLog
    });
  }
  
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    await this.log({
      ...event,
      action: `SECURITY_${event.type}`,
      resource: 'security'
    });
    
    // Alert on critical security events
    if (event.severity === 'critical') {
      await this.sendSecurityAlert(event);
    }
  }
  
  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    // Send to SNS topic for security team
    await sns.publish({
      TopicArn: process.env.SECURITY_ALERT_TOPIC_ARN,
      Subject: `Security Alert: ${event.type}`,
      Message: JSON.stringify(event, null, 2)
    });
  }
}

// Audit logging middleware
function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    
    await auditLogger.log({
      userId: req.user?.id,
      action: `${req.method} ${req.path}`,
      resource: req.path.split('/')[3] || 'unknown',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: res.statusCode < 400 ? 'success' : 'failure',
      details: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration
      }
    });
  });
  
  next();
}
```


---

## 7. AI/ML Architecture

### 7.1 Amazon Bedrock Integration

#### 7.1.1 Model Selection Strategy

```typescript
enum BedrockModel {
  CLAUDE_3_SONNET = 'anthropic.claude-3-sonnet-20240229-v1:0',
  CLAUDE_3_HAIKU = 'anthropic.claude-3-haiku-20240307-v1:0',
  TITAN_TEXT_EXPRESS = 'amazon.titan-text-express-v1'
}

class ModelSelector {
  selectModel(context: AnalysisContext): BedrockModel {
    // Use Haiku for simple explanations (faster, cheaper)
    if (context.explanationLevel === 'beginner' && context.vulnerabilityCount < 5) {
      return BedrockModel.CLAUDE_3_HAIKU;
    }
    
    // Use Sonnet for complex analysis (better reasoning)
    if (context.vulnerabilityType === 'COMPLEX' || context.codeComplexity > 0.7) {
      return BedrockModel.CLAUDE_3_SONNET;
    }
    
    // Default to Haiku for cost optimization
    return BedrockModel.CLAUDE_3_HAIKU;
  }
}
```

#### 7.1.2 Bedrock Service Implementation

```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

class BedrockService {
  private client: BedrockRuntimeClient;
  private modelSelector: ModelSelector;
  
  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.modelSelector = new ModelSelector();
  }
  
  async generateExplanation(
    vulnerability: Vulnerability,
    context: ExplanationContext
  ): Promise<VulnerabilityExplanation> {
    // Check cache first
    const cacheKey = this.generateCacheKey(vulnerability);
    const cached = await cache.get<VulnerabilityExplanation>(cacheKey);
    if (cached) return cached;
    
    // Build prompt
    const prompt = this.buildExplanationPrompt(vulnerability, context);
    
    // Select appropriate model
    const model = this.modelSelector.selectModel({
      explanationLevel: context.level,
      vulnerabilityType: vulnerability.type,
      vulnerabilityCount: 1,
      codeComplexity: this.calculateComplexity(vulnerability.codeSnippet)
    });
    
    // Invoke Bedrock
    const response = await this.invokeModel(model, prompt);
    
    // Parse and validate response
    const explanation = this.parseExplanation(response);
    
    // Cache the result
    await cache.set(cacheKey, explanation, CACHE_TTL.AI_EXPLANATION);
    
    return explanation;
  }
  
  private async invokeModel(model: BedrockModel, prompt: string): Promise<string> {
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more consistent output
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };
    
    const command = new InvokeModelCommand({
      modelId: model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });
    
    try {
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      // Track token usage
      await this.trackTokenUsage({
        model,
        inputTokens: responseBody.usage?.input_tokens || 0,
        outputTokens: responseBody.usage?.output_tokens || 0
      });
      
      return responseBody.content[0].text;
    } catch (error) {
      console.error('Bedrock invocation error:', error);
      throw new Error('Failed to generate AI explanation');
    }
  }
  
  private buildExplanationPrompt(
    vulnerability: Vulnerability,
    context: ExplanationContext
  ): string {
    const levelInstructions = {
      beginner: 'Explain in simple terms suitable for someone new to security. Avoid jargon.',
      intermediate: 'Provide a balanced explanation with some technical details.',
      advanced: 'Give a detailed technical explanation with implementation specifics.'
    };
    
    return `You are a security mentor helping developers learn about vulnerabilities.

VULNERABILITY DETAILS:
Type: ${vulnerability.type}
Severity: ${vulnerability.severity}
File: ${vulnerability.file}
Line: ${vulnerability.line}

CODE SNIPPET:
\`\`\`
${vulnerability.codeSnippet}
\`\`\`

TASK:
Generate a comprehensive security explanation at ${context.level} level.
${levelInstructions[context.level]}

REQUIRED SECTIONS:
1. EXPLANATION: What is this vulnerability and why does it exist?
2. ATTACK_SCENARIO: How would an attacker exploit this? Provide a realistic example.
3. IMPACT: What are the potential consequences?
4. FIX: Step-by-step remediation guide
5. SECURE_CODE: Provide the corrected version of the code
6. PREVENTION: Best practices to avoid this in the future
7. RESOURCES: 2-3 relevant learning resources (URLs)

FORMAT:
Return a JSON object with these exact keys: explanation, attackScenario, impact, fix, secureCode, prevention, resources

CONSTRAINTS:
- Keep explanation under 300 words
- Make attack scenario realistic and specific
- Provide working, secure code
- Focus on practical, actionable advice
- Do not include any markdown formatting in the JSON values`;
  }
  
  private parseExplanation(response: string): VulnerabilityExplanation {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      const required = ['explanation', 'attackScenario', 'impact', 'fix', 'secureCode', 'prevention'];
      for (const field of required) {
        if (!parsed[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      return {
        explanation: this.sanitizeText(parsed.explanation),
        attackScenario: this.sanitizeText(parsed.attackScenario),
        impact: this.sanitizeText(parsed.impact),
        fix: this.sanitizeText(parsed.fix),
        secureCode: parsed.secureCode, // Don't sanitize code
        prevention: this.sanitizeText(parsed.prevention),
        resources: Array.isArray(parsed.resources) ? parsed.resources : []
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      throw new Error('Invalid AI response format');
    }
  }
  
  private sanitizeText(text: string): string {
    // Remove any potential XSS vectors
    return text
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  }
  
  private generateCacheKey(vulnerability: Vulnerability): string {
    // Create hash of vulnerability characteristics
    const data = `${vulnerability.type}:${vulnerability.file}:${vulnerability.line}:${vulnerability.codeSnippet}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  private calculateComplexity(code: string): number {
    // Simple complexity metric based on code characteristics
    const lines = code.split('\n').length;
    const nestingLevel = (code.match(/\{/g) || []).length;
    const keywords = (code.match(/\b(if|for|while|switch|try|catch)\b/g) || []).length;
    
    return Math.min(1, (lines * 0.01 + nestingLevel * 0.1 + keywords * 0.15));
  }
  
  private async trackTokenUsage(usage: TokenUsage): Promise<void> {
    await db.query(
      `INSERT INTO ai_usage_metrics (model, input_tokens, output_tokens, timestamp)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [usage.model, usage.inputTokens, usage.outputTokens]
    );
  }
}
```

#### 7.1.3 Batch Processing for Multiple Vulnerabilities

```typescript
class BatchAIProcessor {
  private bedrock: BedrockService;
  private readonly BATCH_SIZE = 5;
  private readonly CONCURRENT_REQUESTS = 3;
  
  async processVulnerabilities(
    vulnerabilities: Vulnerability[],
    context: ExplanationContext
  ): Promise<Map<string, VulnerabilityExplanation>> {
    const results = new Map<string, VulnerabilityExplanation>();
    
    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < vulnerabilities.length; i += this.BATCH_SIZE) {
      const batch = vulnerabilities.slice(i, i + this.BATCH_SIZE);
      
      // Process batch with concurrency limit
      const batchPromises = batch.map(vuln =>
        this.processWithRetry(vuln, context)
          .then(explanation => ({ vuln, explanation }))
          .catch(error => ({ vuln, error }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Collect results
      for (const result of batchResults) {
        if ('explanation' in result) {
          results.set(result.vuln.id, result.explanation);
        } else {
          console.error(`Failed to process vulnerability ${result.vuln.id}:`, result.error);
          // Store a fallback explanation
          results.set(result.vuln.id, this.getFallbackExplanation(result.vuln));
        }
      }
      
      // Rate limiting between batches
      if (i + this.BATCH_SIZE < vulnerabilities.length) {
        await this.delay(1000); // 1 second delay
      }
    }
    
    return results;
  }
  
  private async processWithRetry(
    vulnerability: Vulnerability,
    context: ExplanationContext,
    maxRetries: number = 3
  ): Promise<VulnerabilityExplanation> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.bedrock.generateExplanation(vulnerability, context);
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    
    throw new Error('Max retries exceeded');
  }
  
  private getFallbackExplanation(vulnerability: Vulnerability): VulnerabilityExplanation {
    // Provide basic explanation when AI fails
    return {
      explanation: `A ${vulnerability.severity} severity ${vulnerability.type} vulnerability was detected.`,
      attackScenario: 'Detailed attack scenario unavailable.',
      impact: 'This vulnerability could potentially be exploited by attackers.',
      fix: 'Please review the code and apply security best practices.',
      secureCode: '// Secure code example unavailable',
      prevention: 'Follow OWASP guidelines for secure coding.',
      resources: [
        'https://owasp.org/www-project-top-ten/',
        `https://cwe.mitre.org/data/definitions/${vulnerability.cweId}.html`
      ]
    };
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 7.2 Prompt Engineering

#### 7.2.1 Prompt Templates

```typescript
class PromptTemplateManager {
  private templates: Map<string, PromptTemplate>;
  
  constructor() {
    this.templates = new Map([
      ['sql_injection', {
        systemPrompt: 'You are an expert in SQL injection vulnerabilities and database security.',
        userPromptTemplate: `Analyze this SQL injection vulnerability:

Code: {code}
Context: {context}

Explain:
1. How the SQL injection occurs
2. What data could be accessed or modified
3. How to use parameterized queries to fix it
4. Additional security measures (input validation, least privilege)`,
        examples: [
          {
            input: 'SELECT * FROM users WHERE id = ' + userId,
            output: 'This concatenates user input directly into SQL...'
          }
        ]
      }],
      
      ['xss', {
        systemPrompt: 'You are an expert in XSS vulnerabilities and web security.',
        userPromptTemplate: `Analyze this XSS vulnerability:

Code: {code}
Context: {context}

Explain:
1. How the XSS attack works
2. What an attacker could do (steal cookies, redirect, etc.)
3. How to properly encode/sanitize output
4. Content Security Policy recommendations`,
        examples: []
      }],
      
      ['hardcoded_secret', {
        systemPrompt: 'You are an expert in secrets management and secure configuration.',
        userPromptTemplate: `Analyze this hardcoded secret:

Code: {code}
Type: {secretType}

Explain:
1. Why hardcoding secrets is dangerous
2. How secrets should be stored (environment variables, secret managers)
3. How to rotate the compromised secret
4. Best practices for secrets management`,
        examples: []
      }]
    ]);
  }
  
  getTemplate(vulnerabilityType: string): PromptTemplate {
    return this.templates.get(vulnerabilityType.toLowerCase()) || this.getDefaultTemplate();
  }
  
  private getDefaultTemplate(): PromptTemplate {
    return {
      systemPrompt: 'You are a security expert helping developers understand vulnerabilities.',
      userPromptTemplate: `Analyze this security vulnerability:

Type: {type}
Code: {code}
Context: {context}

Provide a comprehensive explanation suitable for developers.`,
      examples: []
    };
  }
  
  buildPrompt(template: PromptTemplate, variables: Record<string, string>): string {
    let prompt = template.userPromptTemplate;
    
    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    
    return prompt;
  }
}
```

#### 7.2.2 Prompt Optimization

```typescript
class PromptOptimizer {
  optimizePrompt(prompt: string): string {
    // Remove unnecessary whitespace
    let optimized = prompt.replace(/\s+/g, ' ').trim();
    
    // Truncate very long code snippets
    optimized = this.truncateCodeSnippets(optimized, 500);
    
    // Remove comments from code (they add tokens but little value)
    optimized = this.removeCodeComments(optimized);
    
    return optimized;
  }
  
  private truncateCodeSnippets(prompt: string, maxLength: number): string {
    const codeBlockRegex = /```[\s\S]*?```/g;
    
    return prompt.replace(codeBlockRegex, (match) => {
      if (match.length <= maxLength) return match;
      
      const truncated = match.substring(0, maxLength);
      return truncated + '\n... (truncated)\n```';
    });
  }
  
  private removeCodeComments(prompt: string): string {
    // Remove single-line comments
    let cleaned = prompt.replace(/\/\/.*$/gm, '');
    
    // Remove multi-line comments
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remove Python comments
    cleaned = cleaned.replace(/#.*$/gm, '');
    
    return cleaned;
  }
  
  estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}
```

### 7.3 AI Response Validation

```typescript
class AIResponseValidator {
  validate(response: VulnerabilityExplanation): ValidationResult {
    const errors: string[] = [];
    
    // Check required fields
    if (!response.explanation || response.explanation.length < 50) {
      errors.push('Explanation too short or missing');
    }
    
    if (!response.secureCode || response.secureCode.length < 10) {
      errors.push('Secure code example missing or too short');
    }
    
    // Check for hallucinations (common AI issues)
    if (this.containsHallucinations(response)) {
      errors.push('Response contains potential hallucinations');
    }
    
    // Check for inappropriate content
    if (this.containsInappropriateContent(response)) {
      errors.push('Response contains inappropriate content');
    }
    
    // Validate code syntax
    if (!this.isValidCode(response.secureCode)) {
      errors.push('Secure code has syntax errors');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private containsHallucinations(response: VulnerabilityExplanation): boolean {
    // Check for common AI hallucination patterns
    const hallucinationPatterns = [
      /as an ai/i,
      /i cannot/i,
      /i don't have access/i,
      /\[citation needed\]/i,
      /\[source:\s*\]/i
    ];
    
    const fullText = JSON.stringify(response);
    return hallucinationPatterns.some(pattern => pattern.test(fullText));
  }
  
  private containsInappropriateContent(response: VulnerabilityExplanation): boolean {
    // Basic content filtering
    const inappropriatePatterns = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onclick=/i
    ];
    
    const fullText = JSON.stringify(response);
    return inappropriatePatterns.some(pattern => pattern.test(fullText));
  }
  
  private isValidCode(code: string): boolean {
    // Basic syntax validation
    try {
      // Check for balanced brackets
      const brackets = { '{': '}', '[': ']', '(': ')' };
      const stack: string[] = [];
      
      for (const char of code) {
        if (char in brackets) {
          stack.push(char);
        } else if (Object.values(brackets).includes(char)) {
          const last = stack.pop();
          if (!last || brackets[last] !== char) {
            return false;
          }
        }
      }
      
      return stack.length === 0;
    } catch {
      return false;
    }
  }
}
```

### 7.4 Cost Optimization

```typescript
class AIcostOptimizer {
  private readonly COST_PER_1K_TOKENS = {
    [BedrockModel.CLAUDE_3_SONNET]: { input: 0.003, output: 0.015 },
    [BedrockModel.CLAUDE_3_HAIKU]: { input: 0.00025, output: 0.00125 },
    [BedrockModel.TITAN_TEXT_EXPRESS]: { input: 0.0002, output: 0.0006 }
  };
  
  async estimateCost(
    vulnerabilities: Vulnerability[],
    model: BedrockModel
  ): Promise<number> {
    let totalCost = 0;
    
    for (const vuln of vulnerabilities) {
      const prompt = this.buildPrompt(vuln);
      const inputTokens = this.estimateTokens(prompt);
      const outputTokens = 2000; // Max output tokens
      
      const costs = this.COST_PER_1K_TOKENS[model];
      const cost = (inputTokens / 1000 * costs.input) + (outputTokens / 1000 * costs.output);
      
      totalCost += cost;
    }
    
    return totalCost;
  }
  
  async optimizeBatch(vulnerabilities: Vulnerability[]): Promise<OptimizedBatch> {
    // Group similar vulnerabilities to reuse explanations
    const groups = this.groupSimilarVulnerabilities(vulnerabilities);
    
    // Process one from each group, reuse for others
    const uniqueVulns = groups.map(group => group[0]);
    
    return {
      toProcess: uniqueVulns,
      reuseMap: this.buildReuseMap(groups),
      estimatedSavings: this.calculateSavings(vulnerabilities.length, uniqueVulns.length)
    };
  }
  
  private groupSimilarVulnerabilities(vulnerabilities: Vulnerability[]): Vulnerability[][] {
    const groups: Map<string, Vulnerability[]> = new Map();
    
    for (const vuln of vulnerabilities) {
      // Create similarity key based on type and code pattern
      const key = `${vuln.type}:${this.extractPattern(vuln.codeSnippet)}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(vuln);
    }
    
    return Array.from(groups.values());
  }
  
  private extractPattern(code: string): string {
    // Extract code pattern by removing variable names
    return code
      .replace(/\b[a-z][a-zA-Z0-9]*\b/g, 'VAR')
      .replace(/["'].*?["']/g, 'STR')
      .replace(/\d+/g, 'NUM');
  }
  
  private buildReuseMap(groups: Vulnerability[][]): Map<string, string> {
    const map = new Map<string, string>();
    
    for (const group of groups) {
      const sourceId = group[0].id;
      for (let i = 1; i < group.length; i++) {
        map.set(group[i].id, sourceId);
      }
    }
    
    return map;
  }
  
  private calculateSavings(total: number, unique: number): number {
    const avgCostPerVuln = 0.01; // $0.01 per vulnerability
    return (total - unique) * avgCostPerVuln;
  }
}
```


---

## 8. Frontend Architecture

### 8.1 Technology Stack Details

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "zustand": "^4.4.7",
    "@tanstack/react-query": "^5.14.0",
    "axios": "^1.6.2",
    "tailwindcss": "^3.3.6",
    "@radix-ui/react-*": "latest",
    "lucide-react": "^0.294.0",
    "recharts": "^2.10.3",
    "react-syntax-highlighter": "^15.5.0",
    "react-dropzone": "^14.2.3",
    "date-fns": "^2.30.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vite": "^5.0.7",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.55.0",
    "prettier": "^3.1.1",
    "vitest": "^1.0.4",
    "@testing-library/react": "^14.1.2"
  }
}
```

### 8.2 Project Structure

```
frontend/
├── public/
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── api/
│   │   ├── client.ts              # Axios instance configuration
│   │   ├── auth.ts                # Auth API calls
│   │   ├── analyses.ts            # Analysis API calls
│   │   ├── vulnerabilities.ts     # Vulnerability API calls
│   │   └── dashboard.ts           # Dashboard API calls
│   ├── components/
│   │   ├── ui/                    # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   ├── analysis/
│   │   │   ├── FileUploader.tsx
│   │   │   ├── AnalysisProgress.tsx
│   │   │   ├── VulnerabilityList.tsx
│   │   │   └── VulnerabilityDetail.tsx
│   │   ├── dashboard/
│   │   │   ├── SecurityScoreCard.tsx
│   │   │   ├── TrendChart.tsx
│   │   │   └── RecentAnalyses.tsx
│   │   └── auth/
│   │       ├── LoginForm.tsx
│   │       ├── RegisterForm.tsx
│   │       └── OAuthButtons.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useAnalysis.ts
│   │   ├── useVulnerabilities.ts
│   │   └── useDashboard.ts
│   ├── pages/
│   │   ├── Landing.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Analysis.tsx
│   │   ├── Learning.tsx
│   │   ├── Reports.tsx
│   │   └── Profile.tsx
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── uiStore.ts
│   │   └── preferencesStore.ts
│   ├── types/
│   │   ├── api.ts
│   │   ├── models.ts
│   │   └── enums.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── tsconfig.json
├── vite.config.ts
└── package.json
```

### 8.3 State Management Implementation

```typescript
// authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      login: async (credentials) => {
        const response = await authAPI.login(credentials);
        set({
          user: response.user,
          token: response.token,
          isAuthenticated: true
        });
      },
      
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false
        });
      },
      
      setUser: (user) => set({ user })
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user
      })
    }
  )
);

// React Query hooks
export function useAnalyses() {
  return useQuery({
    queryKey: ['analyses'],
    queryFn: analysisAPI.getAll,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}

export function useAnalysisById(id: string) {
  return useQuery({
    queryKey: ['analysis', id],
    queryFn: () => analysisAPI.getById(id),
    enabled: !!id
  });
}

export function useUploadCode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: analysisAPI.upload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
    }
  });
}
```

---

## 9. Backend Architecture

### 9.1 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   ├── aws.ts
│   │   └── env.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── analysisController.ts
│   │   ├── vulnerabilityController.ts
│   │   ├── dashboardController.ts
│   │   └── reportController.ts
│   ├── services/
│   │   ├── authService.ts
│   │   ├── analysisService.ts
│   │   ├── aiService.ts
│   │   ├── reportService.ts
│   │   └── githubService.ts
│   ├── repositories/
│   │   ├── userRepository.ts
│   │   ├── analysisRepository.ts
│   │   └── vulnerabilityRepository.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   ├── errorHandler.ts
│   │   ├── rateLimit.ts
│   │   └── audit.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Analysis.ts
│   │   └── Vulnerability.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── analyses.ts
│   │   ├── vulnerabilities.ts
│   │   ├── dashboard.ts
│   │   └── reports.ts
│   ├── workers/
│   │   ├── analysisWorker.ts
│   │   ├── aiWorker.ts
│   │   └── reportWorker.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   └── helpers.ts
│   ├── types/
│   │   ├── express.d.ts
│   │   └── index.ts
│   ├── app.ts
│   └── server.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── tsconfig.json
├── package.json
└── README.md
```

### 9.2 Express Application Setup

```typescript
// app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { securityHeaders, corsOptions } from './config/security';
import { errorHandler } from './middleware/errorHandler';
import { auditMiddleware } from './middleware/audit';
import { rateLimitService } from './services/rateLimitService';
import routes from './routes';

const app = express();

// Security middleware
app.use(helmet(securityHeaders));
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Rate limiting
app.use(rateLimitService.generalLimiter);

// Audit logging
app.use(auditMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1', routes);

// Error handling
app.use(errorHandler);

export default app;

// server.ts
import app from './app';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected');
    
    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  // Close connections
  process.exit(0);
});

startServer();
```

---

## 10. Infrastructure Design

### 10.1 AWS Infrastructure as Code (Terraform)

```hcl
# main.tf
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "securetrail-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "SecureTrail"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# VPC Configuration
module "vpc" {
  source = "./modules/vpc"
  
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]
  public_subnets     = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets    = ["10.0.10.0/24", "10.0.11.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = false
}

# RDS PostgreSQL
module "database" {
  source = "./modules/rds"
  
  identifier        = "securetrail-db"
  engine            = "postgres"
  engine_version    = "14.10"
  instance_class    = "db.t3.medium"
  allocated_storage = 100
  
  db_name  = "securetrail"
  username = var.db_username
  password = var.db_password
  
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnets
  multi_az           = true
  backup_retention   = 7
  
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
}

# ElastiCache Redis
module "redis" {
  source = "./modules/elasticache"
  
  cluster_id         = "securetrail-redis"
  engine             = "redis"
  node_type          = "cache.t3.medium"
  num_cache_nodes    = 2
  parameter_group    = "default.redis7"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
}

# S3 Buckets
resource "aws_s3_bucket" "code_uploads" {
  bucket = "securetrail-code-uploads-${var.environment}"
}

resource "aws_s3_bucket_encryption" "code_uploads" {
  bucket = aws_s3_bucket.code_uploads.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "code_uploads" {
  bucket = aws_s3_bucket.code_uploads.id
  
  rule {
    id     = "delete-old-code"
    status = "Enabled"
    
    expiration {
      days = 30
    }
  }
}

# ECS Cluster for Backend
module "ecs" {
  source = "./modules/ecs"
  
  cluster_name = "securetrail-cluster"
  
  service_name     = "securetrail-api"
  task_cpu         = "1024"
  task_memory      = "2048"
  desired_count    = 2
  
  container_image  = var.backend_image
  container_port   = 3000
  
  vpc_id           = module.vpc.vpc_id
  private_subnets  = module.vpc.private_subnets
  
  environment_variables = {
    NODE_ENV     = var.environment
    DATABASE_URL = module.database.connection_string
    REDIS_URL    = module.redis.endpoint
  }
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"
  
  name            = "securetrail-alb"
  vpc_id          = module.vpc.vpc_id
  public_subnets  = module.vpc.public_subnets
  
  target_group_port = 3000
  health_check_path = "/health"
  
  certificate_arn = var.ssl_certificate_arn
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "S3-Frontend"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.frontend.cloudfront_access_identity_path
    }
  }
  
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Frontend"
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    acm_certificate_arn      = var.ssl_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.3_2021"
  }
}

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "securetrail-users"
  
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }
  
  mfa_configuration = "OPTIONAL"
  
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
  
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = false
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/ecs/securetrail-api"
  retention_in_days = 30
}

# SQS Queues
resource "aws_sqs_queue" "analysis_queue" {
  name                       = "securetrail-analysis-queue"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 86400
  receive_wait_time_seconds  = 10
  visibility_timeout_seconds = 300
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "dlq" {
  name = "securetrail-dlq"
}

# Outputs
output "alb_dns_name" {
  value = module.alb.dns_name
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

output "database_endpoint" {
  value     = module.database.endpoint
  sensitive = true
}
```

### 10.2 Deployment Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: securetrail-api
  ECS_SERVICE: securetrail-api
  ECS_CLUSTER: securetrail-cluster

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm test
      
      - name: Run security scan
        run: npm audit

  build-and-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build, tag, and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
      
      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment

  deploy-frontend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install and build
        run: |
          cd frontend
          npm ci
          npm run build
      
      - name: Deploy to S3
        uses: jakejarvis/s3-sync-action@master
        with:
          args: --delete
        env:
          AWS_S3_BUCKET: ${{ secrets.AWS_S3_BUCKET }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: ${{ env.AWS_REGION }}
          SOURCE_DIR: 'frontend/dist'
      
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

---

## 11. Monitoring & Observability

### 11.1 CloudWatch Dashboards

```typescript
// monitoring/cloudwatch-dashboard.ts
import { CloudWatchClient, PutDashboardCommand } from '@aws-sdk/client-cloudwatch';

const dashboardBody = {
  widgets: [
    {
      type: 'metric',
      properties: {
        metrics: [
          ['AWS/ECS', 'CPUUtilization', { stat: 'Average' }],
          ['.', 'MemoryUtilization', { stat: 'Average' }]
        ],
        period: 300,
        stat: 'Average',
        region: 'us-east-1',
        title: 'ECS Resource Utilization'
      }
    },
    {
      type: 'metric',
      properties: {
        metrics: [
          ['AWS/ApplicationELB', 'TargetResponseTime', { stat: 'Average' }],
          ['.', 'RequestCount', { stat: 'Sum' }],
          ['.', 'HTTPCode_Target_5XX_Count', { stat: 'Sum' }]
        ],
        period: 300,
        stat: 'Average',
        region: 'us-east-1',
        title: 'API Performance'
      }
    },
    {
      type: 'metric',
      properties: {
        metrics: [
          ['AWS/RDS', 'DatabaseConnections', { stat: 'Average' }],
          ['.', 'ReadLatency', { stat: 'Average' }],
          ['.', 'WriteLatency', { stat: 'Average' }]
        ],
        period: 300,
        stat: 'Average',
        region: 'us-east-1',
        title: 'Database Performance'
      }
    },
    {
      type: 'log',
      properties: {
        query: `
          SOURCE '/aws/ecs/securetrail-api'
          | fields @timestamp, @message
          | filter @message like /ERROR/
          | sort @timestamp desc
          | limit 20
        `,
        region: 'us-east-1',
        title: 'Recent Errors'
      }
    }
  ]
};

export async function createDashboard() {
  const client = new CloudWatchClient({ region: 'us-east-1' });
  
  const command = new PutDashboardCommand({
    DashboardName: 'SecureTrail-Production',
    DashboardBody: JSON.stringify(dashboardBody)
  });
  
  await client.send(command);
}
```

### 11.2 Custom Metrics

```typescript
// utils/metrics.ts
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

class MetricsService {
  private client: CloudWatchClient;
  private namespace = 'SecureTrail';
  
  constructor() {
    this.client = new CloudWatchClient({ region: process.env.AWS_REGION });
  }
  
  async recordAnalysisCompleted(duration: number, vulnerabilityCount: number) {
    await this.putMetric('AnalysisCompleted', 1, 'Count');
    await this.putMetric('AnalysisDuration', duration, 'Milliseconds');
    await this.putMetric('VulnerabilitiesDetected', vulnerabilityCount, 'Count');
  }
  
  async recordAITokenUsage(tokens: number, cost: number) {
    await this.putMetric('AITokensUsed', tokens, 'Count');
    await this.putMetric('AICost', cost, 'None');
  }
  
  async recordUserAction(action: string) {
    await this.putMetric(`UserAction_${action}`, 1, 'Count');
  }
  
  private async putMetric(metricName: string, value: number, unit: string) {
    const command = new PutMetricDataCommand({
      Namespace: this.namespace,
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date()
        }
      ]
    });
    
    await this.client.send(command);
  }
}

export const metricsService = new MetricsService();
```

---

## 12. Implementation Roadmap

### Phase 1: MVP (Weeks 1-4)
**Week 1: Foundation**
- Set up AWS infrastructure (VPC, RDS, S3)
- Initialize frontend and backend projects
- Configure CI/CD pipeline
- Set up development environment

**Week 2: Core Backend**
- Implement authentication (Cognito integration)
- Build analysis service skeleton
- Integrate Semgrep for static analysis
- Set up database schema and migrations

**Week 3: AI Integration & Frontend**
- Integrate Amazon Bedrock
- Implement AI explanation generation
- Build frontend authentication flow
- Create dashboard layout

**Week 4: Integration & Testing**
- Connect frontend to backend APIs
- Implement file upload and analysis flow
- End-to-end testing
- Bug fixes and optimization

### Phase 2: Enhancement (Weeks 5-8)
- Advanced vulnerability detection
- Learning progress tracking
- Report generation
- GitHub integration
- Performance optimization

### Phase 3: Polish (Weeks 9-12)
- UI/UX improvements
- Additional language support
- Advanced analytics
- Documentation
- Production deployment

---

## 13. Success Criteria

### Technical Success Metrics
- ✅ Analysis completes in <10 seconds for small projects
- ✅ 99.5% uptime
- ✅ <500ms API response time (95th percentile)
- ✅ >90% vulnerability detection accuracy
- ✅ <$0.50 cost per analysis

### User Success Metrics
- ✅ 500 registered users in first 3 months
- ✅ 80% of users complete first analysis
- ✅ 4.5/5 user satisfaction rating
- ✅ 40% user retention after 30 days

---

## Appendix

### A. Glossary
- **AST**: Abstract Syntax Tree
- **OWASP**: Open Web Application Security Project
- **CWE**: Common Weakness Enumeration
- **JWT**: JSON Web Token
- **RBAC**: Role-Based Access Control

### B. References
- AWS Well-Architected Framework
- OWASP Top 10
- Amazon Bedrock Documentation
- Semgrep Documentation

### C. Document Control
- **Version**: 1.0
- **Last Updated**: February 15, 2026
- **Author**: Parth Chavan
- **Status**: Final

---

**End of Design Document**