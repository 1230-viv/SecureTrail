import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { repositoryAPI } from '../services/api';
import {
  Search, Filter, ChevronDown, ChevronRight, Play, MoreVertical,
  GitBranch, Clock, Shield, TrendingUp, Activity, AlertCircle,
  CheckCircle2, XCircle, Folder, RefreshCw, Trash2, Eye,
} from 'lucide-react';

const RepositoriesPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    activeScans: 0,
    highRisk: 0,
    lastScanTime: '-',
  });
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      setLoading(true);
      console.log('Fetching repositories from API...');
      const { data } = await repositoryAPI.getRepositoryStats();
      console.log('API Response:', data);
      
      // Set repositories and stats from backend response
      setRepositories(data.repositories || []);
      setStats({
        total: data.stats.total_repositories,
        activeScans: data.stats.active_scans,
        highRisk: data.stats.high_risk_repos,
        lastScanTime: data.stats.last_scan_hours < 1 ? 'Just now' : `${data.stats.last_scan_hours}h`,
      });
      console.log('Repositories loaded:', data.repositories?.length || 0);
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
      console.error('Error details:', error.response?.data || error.message);
      // Show empty state on error
      setRepositories([]);
      setStats({
        total: 0,
        activeScans: 0,
        highRisk: 0,
        lastScanTime: '-',
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevel = (repo) => {
    // Use backend-calculated risk level
    const level = repo.risk_level || 'Low';
    const colorMap = {
      'Critical': 'red',
      'High': 'orange',
      'Medium': 'yellow',
      'Low': 'green',
    };
    return { level, color: colorMap[level] || 'green' };
  };

  const getSecurityScore = (repo) => {
    // Use backend-calculated security score
    return repo.security_score || 0;
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const filteredRepos = repositories.filter((repo) => {
    const matchesSearch = repo.repository_name.toLowerCase().includes(searchQuery.toLowerCase());
    const riskLevel = getRiskLevel(repo).level.toLowerCase();
    const matchesFilter = filterRisk === 'all' || riskLevel === filterRisk.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  const handleViewResults = (repo) => {
    if (repo.job_id) {
      navigate(`/results/${repo.job_id}`);
    }
  };

  const handleRescan = async (repo) => {
    // TODO: Implement rescan functionality
    console.log('Rescanning:', repo.repository_name);
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f4f6fb]'}`}>
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className={`text-[32px] font-extrabold tracking-tight leading-none mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Repositories
          </h1>
          <p className={`text-[15px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Manage and monitor connected repositories
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Total Repositories */}
          <div
            className={`rounded-2xl border p-5 ${
              isDark ? 'bg-[#1a1d2e]/60 border-white/[0.06]' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center`}>
                <Folder size={18} className="text-blue-500" />
              </div>
              <div className={`px-2 py-1 rounded-lg ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <TrendingUp size={12} className="text-blue-500" />
              </div>
            </div>
            <div>
              <h3 className={`text-[28px] font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {stats.total}
              </h3>
              <p className={`text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Total Repositories
              </p>
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                +2 this week
              </p>
            </div>
          </div>

          {/* Active Scans */}
          <div
            className={`rounded-2xl border p-5 ${
              isDark ? 'bg-[#1a1d2e]/60 border-white/[0.06]' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center`}>
                <Activity size={18} className="text-cyan-500" />
              </div>
              <div className={`px-2 py-1 rounded-lg ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
                <Activity size={12} className="text-cyan-500" />
              </div>
            </div>
            <div>
              <h3 className={`text-[28px] font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {stats.activeScans}
              </h3>
              <p className={`text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Active Scans
              </p>
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                Running now
              </p>
            </div>
          </div>

          {/* High Risk Repos */}
          <div
            className={`rounded-2xl border p-5 ${
              isDark ? 'bg-[#1a1d2e]/60 border-white/[0.06]' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center`}>
                <AlertCircle size={18} className="text-red-500" />
              </div>
              <div className={`px-2 py-1 rounded-lg ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                <TrendingUp size={12} className="text-red-500" />
              </div>
            </div>
            <div>
              <h3 className={`text-[28px] font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {stats.highRisk}
              </h3>
              <p className={`text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                High Risk Repos
              </p>
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                -1 from last week
              </p>
            </div>
          </div>

          {/* Last Scan Time */}
          <div
            className={`rounded-2xl border p-5 ${
              isDark ? 'bg-[#1a1d2e]/60 border-white/[0.06]' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center`}>
                <Clock size={18} className="text-green-500" />
              </div>
              <div className={`px-2 py-1 rounded-lg ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
                <CheckCircle2 size={12} className="text-green-500" />
              </div>
            </div>
            <div>
              <h3 className={`text-[28px] font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {stats.lastScanTime}
              </h3>
              <p className={`text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Last Scan Time
              </p>
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                Highest 2 hours
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border text-[14px] transition-colors ${
                isDark
                  ? 'bg-[#1a1d2e]/60 border-white/[0.1] text-white placeholder-slate-500 focus:border-white/[0.2]'
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-300'
              }`}
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={`px-4 py-3 rounded-xl border text-[14px] font-medium flex items-center gap-2 transition-colors ${
                isDark
                  ? 'bg-[#1a1d2e]/60 border-white/[0.1] text-white hover:border-white/[0.2]'
                  : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
              }`}
            >
              <Filter size={16} />
              Filter
              <ChevronDown size={14} className={showFilterMenu ? 'rotate-180' : ''} />
            </button>
            {showFilterMenu && (
              <div
                className={`absolute top-full right-0 mt-2 w-48 rounded-xl border shadow-xl z-10 ${
                  isDark ? 'bg-[#1a1d2e] border-white/[0.1]' : 'bg-white border-slate-200'
                }`}
              >
                {['all', 'critical', 'high', 'medium', 'low'].map((risk) => (
                  <button
                    key={risk}
                    onClick={() => {
                      setFilterRisk(risk);
                      setShowFilterMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-[13px] transition-colors ${
                      filterRisk === risk
                        ? isDark
                          ? 'bg-indigo-500/15 text-white'
                          : 'bg-indigo-50 text-slate-900'
                        : isDark
                        ? 'text-slate-400 hover:bg-white/[0.05]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {risk === 'all' ? 'All Risks' : `${risk.charAt(0).toUpperCase() + risk.slice(1)} Risk`}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={fetchRepositories}
            className={`px-4 py-3 rounded-xl border text-[14px] font-medium flex items-center gap-2 transition-colors ${
              isDark
                ? 'bg-[#1a1d2e]/60 border-white/[0.1] text-white hover:border-white/[0.2]'
                : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
            }`}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Repositories Table */}
        <div
          className={`rounded-2xl border overflow-hidden ${
            isDark ? 'bg-[#1a1d2e]/60 border-white/[0.06]' : 'bg-white border-slate-200'
          }`}
        >
          {/* Table Header */}
          <div
            className={`grid grid-cols-12 gap-4 px-6 py-4 border-b text-[11px] font-semibold uppercase tracking-wider ${
              isDark ? 'border-white/[0.06] text-slate-500' : 'border-slate-200 text-slate-600'
            }`}
          >
            <div className="col-span-3">Repository</div>
            <div className="col-span-2">Branch</div>
            <div className="col-span-2">Last Scan</div>
            <div className="col-span-2">Risk Level</div>
            <div className="col-span-2">Security Score</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {/* Table Body */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={24} className={`animate-spin ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="text-center py-12">
              <Folder size={48} className={`mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
              <h3 className={`text-[16px] font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                No repositories found
              </h3>
              <p className={`text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Start by scanning a repository to see it here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {filteredRepos.map((repo, index) => {
                const risk = getRiskLevel(repo);
                const score = getSecurityScore(repo);
                
                return (
                  <div
                    key={index}
                    className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors ${
                      isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Repository Name */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white font-bold text-[14px]">
                          {repo.repository_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[14px] font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {repo.repository_name}
                        </p>
                        <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          {repo.scan_count} scan{repo.scan_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Branch */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-1.5">
                        <GitBranch size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                        <span className={`text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {repo.branch}
                        </span>
                      </div>
                    </div>

                    {/* Last Scan */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                        <span className={`text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {getTimeAgo(repo.last_scan_date)}
                        </span>
                      </div>
                    </div>

                    {/* Risk Level */}
                    <div className="col-span-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          risk.color === 'red'
                            ? 'bg-red-500/15 text-red-400'
                            : risk.color === 'orange'
                            ? 'bg-orange-500/15 text-orange-400'
                            : risk.color === 'yellow'
                            ? 'bg-yellow-500/15 text-yellow-400'
                            : 'bg-green-500/15 text-green-400'
                        }`}
                      >
                        {risk.level}
                      </span>
                    </div>

                    {/* Security Score */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full transition-all ${
                              score >= 80
                                ? 'bg-green-500'
                                : score >= 60
                                ? 'bg-yellow-500'
                                : score >= 40
                                ? 'bg-orange-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className={`text-[13px] font-semibold w-10 text-right ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {score}%
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewResults(repo)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isDark
                            ? 'hover:bg-white/[0.1] text-slate-400 hover:text-white'
                            : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                        }`}
                        title="View Results"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleRescan(repo)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isDark
                            ? 'hover:bg-white/[0.1] text-slate-400 hover:text-white'
                            : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                        }`}
                        title="Rescan"
                      >
                        <Play size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RepositoriesPage;
