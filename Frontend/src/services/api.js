import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach GitHub token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('github_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  getGitHubLoginUrl: () => api.get('/api/auth/github/login'),
  getGoogleLoginUrl: () => api.get('/api/auth/google/login'),
  logout: () => api.post('/api/auth/logout'),
};

// ── Repository ────────────────────────────────────────────────────────────────
export const repositoryAPI = {
  /** List repos for the authenticated GitHub user */
  listRepositories: () => api.get('/api/repository/list'),

  /**
   * Clone a GitHub repo and queue it for scanning.
   * Returns { job_id, repository_name, message }
   */
  scanRepository: (repoFullName, branch = 'main') =>
    api.post('/api/repository/scan', null, {
      params: { repo_full_name: repoFullName, branch },
    }),

  /**
   * Get repository statistics and scan history
   * Returns { repositories: [], stats: {} }
   */
  getRepositoryStats: (userId) => api.get('/api/repository/stats', {
    params: userId ? { user_id: userId } : {},
  }),

  /**
   * Get all scans for a specific repository
   */
  getRepositoryScans: (repositoryName) => 
    api.get(`/api/repository/${repositoryName}/scans`),
};

// ── Upload ────────────────────────────────────────────────────────────────────
export const uploadAPI = {
  /**
   * Upload a ZIP and immediately queue a scan pipeline.
   * Returns { success, job_id, repository_name, files_count, message }
   */
  uploadZip: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/api/upload/zip', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(pct);
        }
      },
    });
  },
};

// ── Learning System ─────────────────────────────────────────────────────────
export const learningAPI = {
  /**
   * Learning summary for a single scan (with comparison to previous scan).
   * Returns { health_score, score_delta, categories, improved/worsened/new/resolved, roadmap, ... }
   */
  getSummary: (jobId) => api.get(`/api/learning/summary/${jobId}`),

  /**
   * Cross-scan progress for a repository.
   * Returns { score_history, trend, improvement_pct, category_trends, ... }
   */
  getProgress: (repoName) =>
    api.get(`/api/learning/progress/${encodeURIComponent(repoName)}`),

  /**
   * AI mentor deep-dive insights for a scan's top findings.
   * Returns { learning_summary, priority_order, deep_dive, source, cached }
   */
  getInsights: (jobId, forceRefresh = false) =>
    api.get(`/api/learning/insights/${jobId}`, {
      params: forceRefresh ? { force_refresh: true } : {},
    }),

  /**
   * Current security maturity level + badge status.
   * Optional repoName scopes to that repository.
   */
  getMaturity: (repoName) =>
    api.get('/api/learning/maturity', {
      params: repoName ? { repo_name: repoName } : {},
    }),

  /** All known vulnerability categories with label, color, icon. */
  getCategories: () => api.get('/api/learning/categories'),
};

// ── Scan (polling + results) ───────────────────────────────────────────────────
export const scanAPI = {
  /**
   * Poll the status of a running scan job.
   * Returns { job_id, status, progress, stage, repository_name, created_at, updated_at }
   */
  getStatus: (jobId) => api.get(`/api/scan/status/${jobId}`),

  /**
   * Fetch the completed ScanReport.
   * Returns the full ScanReport JSON once status === "completed" | "partial".
   */
  getResult: (jobId) => api.get(`/api/scan/result/${jobId}`),

  /**
   * Fetch the list of all scan jobs (most recent first).
   * Returns [{ job_id, status, progress, stage, repository_name, created_at, updated_at }, ...]
   */
  getJobs: () => api.get('/api/scan/jobs'),

  /**
   * Generate and download the executive-level Markdown security report.
   * Returns the raw Markdown text as a string.
   */
  getReport: (jobId) => api.get(`/api/scan/report/${jobId}`, { responseType: 'text' }),
};

export default api;
