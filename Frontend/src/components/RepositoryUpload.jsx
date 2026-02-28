import React, { useState, useRef } from 'react';
import { Upload, ChevronDown, Github, FileArchive, X, ArrowRight, Zap, GitBranch } from 'lucide-react';
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
      {/* Glass upload card */}
      <div
        className="rounded-2xl relative overflow-hidden transition-all"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(15,17,32,0.92) 0%, rgba(20,22,45,0.84) 60%, rgba(18,14,30,0.78) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,246,255,0.92) 60%, rgba(240,240,255,0.88) 100%)',
          backdropFilter: 'blur(20px)',
          border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(139,92,246,0.20)',
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.07)'
            : '0 6px 24px rgba(99,102,241,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        {/* Indigo top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px z-10"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.5), rgba(99,102,241,0.9), rgba(139,92,246,0.5), transparent)' }} />
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.018] pointer-events-none"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />

        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Repository Upload</h2>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Choose upload method</p>
            </div>
            {selectedRepository && (
              <button
                onClick={handleReset}
                className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors
                  ${isDark
                    ? 'text-slate-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.08]'
                    : 'text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200'}`}
              >
                <X size={12} /> Reset
              </button>
            )}
          </div>

          {!uploadMethod ? (
            /* ── Method Selection ── */
            <div className="space-y-3">
              {/* GitHub Option */}
              <button
                onClick={() => handleMethodSelect('github')}
                className="w-full text-left group transition-all duration-200 rounded-xl"
                style={{ outline: 'none' }}
              >
                <div
                  className="flex items-center gap-4 p-4 rounded-xl transition-all duration-200 group-hover:-translate-y-0.5"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.60)',
                    border: isDark
                      ? '1px solid rgba(255,255,255,0.08)'
                      : '1px solid rgba(59,130,246,0.18)',
                    boxShadow: isDark
                      ? 'none'
                      : '0 2px 8px rgba(59,130,246,0.06)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.border = isDark ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(59,130,246,0.40)';
                    e.currentTarget.style.boxShadow = isDark ? '0 0 18px rgba(59,130,246,0.12)' : '0 4px 16px rgba(59,130,246,0.14)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(59,130,246,0.18)';
                    e.currentTarget.style.boxShadow = isDark ? 'none' : '0 2px 8px rgba(59,130,246,0.06)';
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.10)',
                      border: '1px solid rgba(59,130,246,0.25)',
                      boxShadow: '0 0 16px rgba(59,130,246,0.18)',
                    }}
                  >
                    <Github size={22} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-bold mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Connect GitHub</p>
                    <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Login and select a repository from your GitHub account
                    </p>
                  </div>
                  <ArrowRight size={14}
                    className={`flex-shrink-0 transition-all duration-200 opacity-0 -translate-x-1
                      group-hover:opacity-60 group-hover:translate-x-0
                      ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                </div>
              </button>

              {/* ZIP Option */}
              <button
                onClick={() => handleMethodSelect('zip')}
                className="w-full text-left group transition-all duration-200 rounded-xl"
                style={{ outline: 'none' }}
              >
                <div
                  className="flex items-center gap-4 p-4 rounded-xl transition-all duration-200 group-hover:-translate-y-0.5"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.60)',
                    border: isDark
                      ? '1px solid rgba(255,255,255,0.08)'
                      : '1px solid rgba(139,92,246,0.18)',
                    boxShadow: isDark
                      ? 'none'
                      : '0 2px 8px rgba(139,92,246,0.06)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.border = isDark ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(139,92,246,0.40)';
                    e.currentTarget.style.boxShadow = isDark ? '0 0 18px rgba(139,92,246,0.12)' : '0 4px 16px rgba(139,92,246,0.14)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(139,92,246,0.18)';
                    e.currentTarget.style.boxShadow = isDark ? 'none' : '0 2px 8px rgba(139,92,246,0.06)';
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.10)',
                      border: '1px solid rgba(139,92,246,0.25)',
                      boxShadow: '0 0 16px rgba(139,92,246,0.18)',
                    }}
                  >
                    <FileArchive size={21} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-bold mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Upload ZIP File</p>
                    <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Upload a ZIP archive containing your project code
                    </p>
                  </div>
                  <ArrowRight size={14}
                    className={`flex-shrink-0 transition-all duration-200 opacity-0 -translate-x-1
                      group-hover:opacity-60 group-hover:translate-x-0
                      ${isDark ? 'text-violet-400' : 'text-violet-500'}`} />
                </div>
              </button>
            </div>

          ) : uploadMethod === 'zip' && !selectedRepository ? (
            /* ── ZIP Dropzone ── */
            <>
              <div
                className="rounded-xl p-8 mb-5 text-center relative overflow-hidden cursor-pointer group"
                style={{
                  background: isDark ? 'rgba(139,92,246,0.04)' : 'rgba(139,92,246,0.04)',
                  border: isDark ? '2px dashed rgba(139,92,246,0.25)' : '2px dashed rgba(139,92,246,0.30)',
                }}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                {/* Glow orb */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-32 h-32 rounded-full blur-3xl opacity-20"
                    style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }} />
                </div>

                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4
                               transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.12)',
                      border: '1px solid rgba(139,92,246,0.30)',
                      boxShadow: '0 0 20px rgba(139,92,246,0.22)',
                    }}
                  >
                    <Upload size={24} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
                  </div>

                  <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {uploading ? 'Uploading…' : 'Drop your ZIP here'}
                  </p>
                  <p className={`text-[11px] mb-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    {uploading ? `${uploadProgress}% complete` : 'or click to browse — max 100 MB'}
                  </p>

                  {uploading ? (
                    /* Progress bar */
                    <div className={`w-full max-w-[200px] h-1.5 rounded-full overflow-hidden
                      ${isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${uploadProgress}%`,
                          background: 'linear-gradient(90deg, #8b5cf6, #6366f1)',
                          boxShadow: '0 0 8px rgba(139,92,246,0.5)',
                        }}
                      />
                    </div>
                  ) : (
                    <span
                      className="px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors"
                      style={{
                        background: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.10)',
                        border: '1px solid rgba(139,92,246,0.28)',
                        color: isDark ? '#c4b5fd' : '#7c3aed',
                      }}
                    >
                      Select ZIP File
                    </span>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
              </div>

              <button
                onClick={() => setUploadMethod(null)}
                className={`w-full py-2 text-[12px] font-medium flex items-center justify-center gap-1
                  ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
              >
                ← Back to method selection
              </button>
            </>

          ) : selectedRepository ? (
            /* ── Selected repository ── */
            <>
              <div
                className="rounded-xl p-4 mb-5"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.65)',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(59,130,246,0.18)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.10)',
                      border: '1px solid rgba(59,130,246,0.25)',
                    }}
                  >
                    {selectedRepository.type !== 'zip'
                      ? <Github size={18} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                      : <FileArchive size={18} className={isDark ? 'text-violet-400' : 'text-violet-600'} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5
                      ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Selected Repository</p>
                    <p className={`text-[13px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedRepository.name}
                    </p>
                    {selectedRepository.files_count && (
                      <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {selectedRepository.files_count} files extracted
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Branch Selection */}
              {selectedRepository.type !== 'zip' && (
                <div className="mb-5">
                  <label className={`flex items-center gap-1.5 text-[11px] font-semibold mb-2
                    ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <GitBranch size={11} />
                    Branch
                  </label>
                  <div className="relative">
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className={`w-full px-4 py-2.5 pr-10 rounded-xl appearance-none text-[13px]
                        focus:outline-none transition-all
                        ${isDark
                          ? 'bg-white/[0.04] border border-white/[0.08] text-white focus:border-indigo-500/40'
                          : 'bg-white/80 border border-slate-200 text-slate-700 focus:border-indigo-400/60'}`}
                    >
                      <option value={selectedRepository.default_branch}>
                        {selectedRepository.default_branch}
                      </option>
                      <option value="develop">develop</option>
                      <option value="feature">feature</option>
                      <option value="staging">staging</option>
                    </select>
                    <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none
                      ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  </div>
                </div>
              )}

              {/* Start scan CTA */}
              <button
                onClick={handleStartScan}
                className="w-full py-3.5 rounded-xl font-bold text-[13px] text-white
                           flex items-center justify-center gap-2
                           transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed, #6d28d9)',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.35), 0 1px 0 rgba(255,255,255,0.1) inset',
                }}
              >
                <Zap size={14} />
                Start Security Scan
              </button>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default RepositoryUpload;
