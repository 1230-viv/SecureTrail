import React, { useState, useEffect } from 'react';
import { Search, Star, Lock, Globe, ChevronRight } from 'lucide-react';
import { repositoryAPI } from '../services/api';
import { toast } from 'react-toastify';

const RepositorySelector = ({ onSelect, onBack }) => {
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepo, setSelectedRepo] = useState(null);

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
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-800">Select Repository</h2>
          <button
            onClick={onBack}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            ← Back
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Repository List */}
      <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading repositories...</div>
        ) : filteredRepos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No repositories found</div>
        ) : (
          filteredRepos.map((repo) => (
            <div
              key={repo.id}
              onClick={() => handleSelectRepo(repo)}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedRepo?.id === repo.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800">{repo.name}</h3>
                    {repo.private ? (
                      <Lock size={14} className="text-gray-500" />
                    ) : (
                      <Globe size={14} className="text-gray-500" />
                    )}
                  </div>
                  {repo.description && (
                    <p className="text-sm text-gray-600 mb-2">{repo.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {repo.language && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        {repo.language}
                      </span>
                    )}
                    <span>Branch: {repo.default_branch}</span>
                  </div>
                </div>
                <ChevronRight className="text-gray-400" size={20} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirm Button */}
      {selectedRepo && (
        <button
          onClick={handleConfirm}
          className="w-full py-3 bg-[#2D3748] text-white rounded-lg font-medium hover:bg-[#1A202C] transition-colors"
        >
          Select {selectedRepo.name}
        </button>
      )}
    </div>
  );
};

export default RepositorySelector;
