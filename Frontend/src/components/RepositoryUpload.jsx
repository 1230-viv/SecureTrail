import React, { useState, useRef } from 'react';
import { Upload, ChevronDown, Github, FileArchive, X } from 'lucide-react';
import { toast } from 'react-toastify';
import RepositorySelector from './RepositorySelector';
import { uploadAPI, repositoryAPI, authAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

/**
 * RepositoryUpload
 *
 * Props
 *   onScanStarted({ job_id, repository_name }) — called once a scan is queued on the backend
 */
const RepositoryUpload = ({ onScanStarted }) => {
  const [uploadMethod, setUploadMethod] = useState(null); // 'github' or 'zip'
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [selectedRepository, setSelectedRepository] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const { isDark } = useTheme();

  const handleMethodSelect = async (method) => {
    if (method === 'github') {
      setUploadMethod('github');
      
      // Check if already logged in
      const token = localStorage.getItem('github_token');
      if (token) {
        setShowRepoSelector(true);
      } else {
        // Automatically trigger GitHub OAuth
        try {
          const response = await authAPI.getGitHubLoginUrl();
          const { auth_url } = response.data;
          
          // Open OAuth in same window
          window.location.href = auth_url;
        } catch (error) {
          console.error('GitHub auth error:', error);
          toast.error('Failed to connect to GitHub');
        }
      }
    } else {
      setUploadMethod('zip');
    }
  };

  const handleRepositorySelect = async (repo) => {
    setSelectedRepository(repo);
    setShowRepoSelector(false);
    setSelectedBranch(repo.default_branch);
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.zip')) {
      toast.error('Only ZIP files are allowed');
      return;
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      toast.error('File size must be less than 100MB');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const response = await uploadAPI.uploadZip(file, (progress) => {
        setUploadProgress(progress);
      });

      if (response.data.success) {
        toast.success('ZIP uploaded — scan queued!');
        // Scan already started on backend; hand off to parent immediately
        onScanStarted?.({
          job_id: response.data.job_id,
          repository_name: response.data.repository_name,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleStartScan = async () => {
    if (!selectedRepository) {
      toast.warning('Please select a repository first');
      return;
    }

    try {
      // GitHub repository — clone + scan via backend
      toast.info('Queuing security scan…');
      const response = await repositoryAPI.scanRepository(
        selectedRepository.full_name,
        selectedBranch
      );
      if (response.data.success) {
        toast.success('Scan queued!');
        onScanStarted?.({
          job_id: response.data.job_id,
          repository_name: response.data.repository_name,
        });
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error(error.response?.data?.detail || 'Failed to start scan');
    }
  };

  const handleReset = () => {
    setUploadMethod(null);
    setSelectedRepository(null);
    setSelectedBranch('main');
  };

  // If showing repository selector
  if (showRepoSelector) {
    return (
      <RepositorySelector
        onSelect={handleRepositorySelect}
        onBack={() => {
          setShowRepoSelector(false);
          setUploadMethod(null);
        }}
      />
    );
  }

  return (
    <>
      <div className={`rounded-2xl p-6 border backdrop-blur-xl transition-all
        ${isDark
          ? 'bg-white/[0.03] border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
          : 'bg-white/70 border-white/60 shadow-[0_8px_32px_rgba(99,102,241,0.08)]'}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Repository Upload</h2>
          {selectedRepository && (
            <button
              onClick={handleReset}
              className={`text-sm flex items-center gap-1
                ${isDark ? 'text-slate-400 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
            >
              <X size={16} />
              Reset
            </button>
          )}
        </div>

        {!uploadMethod ? (
          /* Method Selection */
          <div className="space-y-4">
            <p className={`mb-4 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Choose upload method:</p>
            
            {/* GitHub Option */}
            <button
              onClick={() => handleMethodSelect('github')}
              className={`w-full p-6 border-2 rounded-xl backdrop-blur-md transition-all text-left group
                ${isDark
                  ? 'border-white/[0.08] bg-white/[0.02] hover:border-blue-500/40 hover:bg-blue-500/[0.06]'
                  : 'border-white/60 bg-white/50 hover:border-blue-400 hover:bg-blue-50/80'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-colors
                  ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                  <Github className={isDark ? 'text-white' : 'text-slate-700'} size={24} />
                </div>
                <div>
                  <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>Connect GitHub</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    Login and select repository from your GitHub account
                  </p>
                </div>
              </div>
            </button>

            {/* ZIP Option */}
            <button
              onClick={() => handleMethodSelect('zip')}
              className={`w-full p-6 border-2 rounded-xl backdrop-blur-md transition-all text-left group
                ${isDark
                  ? 'border-white/[0.08] bg-white/[0.02] hover:border-violet-500/40 hover:bg-violet-500/[0.06]'
                  : 'border-white/60 bg-white/50 hover:border-violet-400 hover:bg-violet-50/80'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:bg-violet-600 transition-colors
                  ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                  <FileArchive className={isDark ? 'text-white' : 'text-slate-700'} size={24} />
                </div>
                <div>
                  <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>Upload ZIP File</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    Upload a ZIP file containing your project code
                  </p>
                </div>
              </div>
            </button>
          </div>
        ) : uploadMethod === 'zip' && !selectedRepository ? (
          /* ZIP Upload Area */
          <>
            <div className={`border-2 border-dashed rounded-xl p-8 mb-6 text-center backdrop-blur-md
              ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-blue-200 bg-blue-50/30'}`}>
              <div className="flex flex-col items-center justify-center">
                <Upload className={`w-12 h-12 mb-4 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                <p className={`mb-2 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Upload ZIP File</p>
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Maximum file size: 100MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={`px-6 py-2.5 border rounded-xl font-medium transition-all disabled:opacity-50
                    ${isDark
                      ? 'bg-white/[0.06] border-white/[0.1] text-slate-200 hover:bg-white/[0.1] hover:border-white/[0.15]'
                      : 'bg-white/80 border-white/60 text-slate-700 hover:bg-white shadow-sm'}`}
                >
                  {uploading ? `Uploading... ${uploadProgress}%` : 'Select ZIP File'}
                </button>
              </div>
            </div>
            <button
              onClick={() => setUploadMethod(null)}
              className={`w-full py-2 ${isDark ? 'text-slate-400 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
            >
              ← Back to method selection
            </button>
          </>
        ) : selectedRepository ? (
          /* Selected Repository Display */
          <>
            <div className={`rounded-xl p-4 mb-6 border backdrop-blur-md
              ${isDark
                ? 'bg-white/[0.03] border-white/[0.08]'
                : 'bg-white/60 border-white/60'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Selected Repository</p>
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{selectedRepository.name}</h3>
                  {selectedRepository.files_count && (
                    <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                      {selectedRepository.files_count} files extracted
                    </p>
                  )}
                </div>
                {selectedRepository.type !== 'zip' && (
                  <Github className={isDark ? 'text-slate-500' : 'text-gray-600'} size={32} />
                )}
              </div>
            </div>

            {/* Branch Selection (only for GitHub repos) */}
            {selectedRepository.type !== 'zip' && (
              <div className="mb-6">
                <label className={`block text-sm font-medium mb-2
                  ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Branch Selection
                </label>
                <div className="relative">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className={`w-full px-4 py-2.5 pr-10 border rounded-xl appearance-none backdrop-blur-md
                      focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-transparent transition-all
                      ${isDark
                        ? 'border-white/[0.08] bg-white/[0.04] text-white'
                        : 'border-white/60 bg-white/70 text-gray-700'}`}
                  >
                    <option value={selectedRepository.default_branch}>
                      {selectedRepository.default_branch}
                    </option>
                    <option value="develop">develop</option>
                    <option value="feature">feature</option>
                    <option value="staging">staging</option>
                  </select>
                  <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none
                    ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                </div>
              </div>
            )}

            {/* Start Security Scan Button */}
            <button
              onClick={handleStartScan}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold
                hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30
                active:scale-[0.98]"
            >
              Start Security Scan
            </button>
          </>
        ) : null}
      </div>
    </>
  );
};

export default RepositoryUpload;
