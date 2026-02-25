import React, { useState, useRef, useEffect } from 'react';
import { Upload, ChevronDown, Github, FileArchive, X } from 'lucide-react';
import { toast } from 'react-toastify';
import RepositorySelector from './RepositorySelector';
import { uploadAPI, repositoryAPI, authAPI } from '../services/api';

const RepositoryUpload = () => {
  const [uploadMethod, setUploadMethod] = useState(null); // 'github' or 'zip'
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [selectedRepository, setSelectedRepository] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Auto-show repository selector if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('github_token');
    const user = localStorage.getItem('github_user');
    
    if (token && user) {
      setUploadMethod('github');
      setShowRepoSelector(true);
      const userData = JSON.parse(user);
      toast.success(`Welcome back, ${userData.login || userData.name}!`);
    }
  }, []);

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
        toast.success(response.data.message);
        setSelectedRepository({
          name: response.data.repository_name,
          files_count: response.data.files_count,
          type: 'zip'
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
      if (selectedRepository.type === 'zip') {
        toast.info('Starting security scan for ZIP upload...');
        // Here you would call the scan API
      } else {
        // Clone GitHub repository
        const response = await repositoryAPI.cloneRepository(
          selectedRepository.full_name,
          selectedBranch
        );
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Failed to start scan');
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Repository Upload</h2>
          {selectedRepository && (
            <button
              onClick={handleReset}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              <X size={16} />
              Reset
            </button>
          )}
        </div>

        {!uploadMethod ? (
          /* Method Selection */
          <div className="space-y-4">
            <p className="text-gray-600 mb-4">Choose upload method:</p>
            
            {/* GitHub Option */}
            <button
              onClick={() => handleMethodSelect('github')}
              className="w-full p-6 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  <Github className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">Connect GitHub</h3>
                  <p className="text-sm text-gray-600">
                    Login and select repository from your GitHub account
                  </p>
                </div>
              </div>
            </button>

            {/* ZIP Option */}
            <button
              onClick={() => handleMethodSelect('zip')}
              className="w-full p-6 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  <FileArchive className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">Upload ZIP File</h3>
                  <p className="text-sm text-gray-600">
                    Upload a ZIP file containing your project code
                  </p>
                </div>
              </div>
            </button>
          </div>
        ) : uploadMethod === 'zip' && !selectedRepository ? (
          /* ZIP Upload Area */
          <>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-6 text-center">
              <div className="flex flex-col items-center justify-center">
                <Upload className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Upload ZIP File</p>
                <p className="text-sm text-gray-500 mb-4">Maximum file size: 100MB</p>
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
                  className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {uploading ? `Uploading... ${uploadProgress}%` : 'Select ZIP File'}
                </button>
              </div>
            </div>
            <button
              onClick={() => setUploadMethod(null)}
              className="w-full py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back to method selection
            </button>
          </>
        ) : selectedRepository ? (
          /* Selected Repository Display */
          <>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Selected Repository</p>
                  <h3 className="font-semibold text-gray-800">{selectedRepository.name}</h3>
                  {selectedRepository.files_count && (
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedRepository.files_count} files extracted
                    </p>
                  )}
                </div>
                {selectedRepository.type !== 'zip' && (
                  <Github className="text-gray-600" size={32} />
                )}
              </div>
            </div>

            {/* Branch Selection (only for GitHub repos) */}
            {selectedRepository.type !== 'zip' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Selection
                </label>
                <div className="relative">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg appearance-none bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={selectedRepository.default_branch}>
                      {selectedRepository.default_branch}
                    </option>
                    <option value="develop">develop</option>
                    <option value="feature">feature</option>
                    <option value="staging">staging</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Start Security Scan Button */}
            <button
              onClick={handleStartScan}
              className="w-full py-3 bg-[#2D3748] text-white rounded-lg font-medium hover:bg-[#1A202C] transition-colors"
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
