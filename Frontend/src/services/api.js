import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('github_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  getGitHubLoginUrl: () => api.get('/api/auth/github/login'),
  getGoogleLoginUrl: () => api.get('/api/auth/google/login'),
  logout: () => api.post('/api/auth/logout'),
};

export const repositoryAPI = {
  listRepositories: () => api.get('/api/repository/list'),
  cloneRepository: (repoFullName, branch = 'main') => 
    api.post('/api/repository/clone', null, {
      params: { repo_full_name: repoFullName, branch }
    }),
};

export const uploadAPI = {
  uploadZip: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post('/api/upload/zip', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
  },
};

export default api;
