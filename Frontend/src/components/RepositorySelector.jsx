import React, { useState, useEffect } from 'react';
import { Search, Star, Lock, Globe, ChevronRight } from 'lucide-react';
import { repositoryAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useTheme } from '../context/ThemeContext';

const RepositorySelector = ({ onSelect, onBack }) => {
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepo, setSelectedRepo] = useState(null);
  const { isDark } = useTheme();

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      setLoading(true);
      const response = await repositoryAPI.listRepositories();
      setRepositories(response.data);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      toast.error('Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const filteredRepos = repositories.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectRepo = (repo) => {
    setSelectedRepo(repo);
  };

  const handleConfirm = () => {
    if (selectedRepo) {
      onSelect(selectedRepo);
    }
  };

  return (
    <div className={`rounded-lg shadow-md p-6
      ${isDark ? 'bg-[#161929] border border-white/5' : 'bg-white'}`}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Select Repository</h2>
          <button
            onClick={onBack}
            className={`text-sm ${isDark ? 'text-slate-400 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
          >
            ← Back
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2
            ${isDark ? 'text-slate-500' : 'text-gray-400'}`} size={20} />
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
              ${isDark
                ? 'border-white/10 bg-white/5 text-white placeholder-slate-500'
                : 'border-gray-300 bg-white text-gray-900'}`}
          />
        </div>
      </div>

      {/* Repository List */}
      <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
        {loading ? (
          <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Loading repositories...</div>
        ) : filteredRepos.length === 0 ? (
          <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>No repositories found</div>
        ) : (
          filteredRepos.map((repo) => (
            <div
              key={repo.id}
              onClick={() => handleSelectRepo(repo)}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedRepo?.id === repo.id
                  ? isDark ? 'border-blue-500/50 bg-blue-500/10' : 'border-blue-500 bg-blue-50'
                  : isDark
                    ? 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{repo.name}</h3>
                    {repo.private ? (
                      <Lock size={14} className={isDark ? 'text-slate-500' : 'text-gray-500'} />
                    ) : (
                      <Globe size={14} className={isDark ? 'text-slate-500' : 'text-gray-500'} />
                    )}
                  </div>
                  {repo.description && (
                    <p className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{repo.description}</p>
                  )}
                  <div className={`flex items-center gap-4 text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                    {repo.language && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        {repo.language}
                      </span>
                    )}
                    <span>Branch: {repo.default_branch}</span>
                  </div>
                </div>
                <ChevronRight className={isDark ? 'text-slate-600' : 'text-gray-400'} size={20} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirm Button */}
      {selectedRepo && (
        <button
          onClick={handleConfirm}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Select {selectedRepo.name}
        </button>
      )}
    </div>
  );
};

export default RepositorySelector;
