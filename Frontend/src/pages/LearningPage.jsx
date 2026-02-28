import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { scanAPI } from '../services/api';
import {
  BookOpen, Play, FileText, FlaskConical, Clock, Award,
  TrendingUp, Filter, Search, ChevronRight, Sparkles,
  Shield, Code, Lock, Database, Upload, Key, AlertTriangle,
  CheckCircle, Brain,
} from 'lucide-react';

// Course catalog
const COURSES = [
  {
    id: 1,
    title: 'SQL Injection Prevention',
    description: 'Learn to identify and prevent SQL injection vulnerabilities in your applications',
    category: 'Injection Attacks',
    difficulty: 'Intermediate',
    duration: '4 hours',
    modules: 4,
    videos: 12,
    readings: 8,
    labs: 5,
    icon: Database,
    color: 'blue',
    relatedVulnerabilities: ['sql-injection', 'database', 'injection'],
  },
  {
    id: 2,
    title: 'Secure Authentication Implementation',
    description: 'Master authentication security, password hashing, and session management',
    category: 'Authentication',
    difficulty: 'Advanced',
    duration: '6 hours',
    modules: 5,
    videos: 15,
    readings: 10,
    labs: 7,
    icon: Lock,
    color: 'purple',
    relatedVulnerabilities: ['authentication', 'password', 'session'],
  },
  {
    id: 3,
    title: 'Cross-Site Scripting (XSS) Defense',
    description: 'Understand XSS attacks and learn effective prevention techniques',
    category: 'Web Security',
    difficulty: 'Intermediate',
    duration: '3 hours',
    modules: 3,
    videos: 10,
    readings: 6,
    labs: 4,
    icon: Code,
    color: 'red',
    relatedVulnerabilities: ['xss', 'cross-site', 'scripting'],
  },
  {
    id: 4,
    title: 'API Security Best Practices',
    description: 'Secure your REST APIs with authentication, rate limiting, and validation',
    category: 'API Security',
    difficulty: 'Intermediate',
    duration: '5 hours',
    modules: 4,
    videos: 14,
    readings: 9,
    labs: 6,
    icon: Shield,
    color: 'green',
    relatedVulnerabilities: ['api', 'rest', 'rate-limit'],
  },
  {
    id: 5,
    title: 'CSRF Protection Techniques',
    description: 'Prevent Cross-Site Request Forgery attacks in modern web applications',
    category: 'Web Security',
    difficulty: 'Beginner',
    duration: '2 hours',
    modules: 2,
    videos: 6,
    readings: 4,
    labs: 3,
    icon: Shield,
    color: 'orange',
    relatedVulnerabilities: ['csrf', 'cross-site', 'forgery'],
  },
  {
    id: 6,
    title: 'Secure File Upload Handling',
    description: 'Implement secure file upload systems with proper validation and storage',
    category: 'File Security',
    difficulty: 'Intermediate',
    duration: '3 hours',
    modules: 3,
    videos: 9,
    readings: 5,
    labs: 4,
    icon: Upload,
    color: 'pink',
    relatedVulnerabilities: ['file-upload', 'mime-type', 'validation'],
  },
  {
    id: 7,
    title: 'Cryptography Fundamentals',
    description: 'Learn encryption, hashing, and cryptographic best practices',
    category: 'Cryptography',
    difficulty: 'Advanced',
    duration: '8 hours',
    modules: 6,
    videos: 20,
    readings: 15,
    labs: 10,
    icon: Key,
    color: 'indigo',
    relatedVulnerabilities: ['encryption', 'hashing', 'crypto'],
  },
  {
    id: 8,
    title: 'CORS Configuration Guide',
    description: 'Properly configure Cross-Origin Resource Sharing for secure APIs',
    category: 'Web Security',
    difficulty: 'Beginner',
    duration: '2 hours',
    modules: 2,
    videos: 7,
    readings: 4,
    labs: 2,
    icon: Shield,
    color: 'teal',
    relatedVulnerabilities: ['cors', 'cross-origin', 'api'],
  },
  {
    id: 9,
    title: 'Secrets Management',
    description: 'Securely manage API keys, tokens, and sensitive configuration',
    category: 'DevSecOps',
    difficulty: 'Intermediate',
    duration: '4 hours',
    modules: 3,
    videos: 11,
    readings: 7,
    labs: 5,
    icon: Key,
    color: 'yellow',
    relatedVulnerabilities: ['secrets', 'api-key', 'credentials'],
  },
  {
    id: 10,
    title: 'File Upload Security',
    description: 'Advanced techniques for securing file upload functionality',
    category: 'File Security',
    difficulty: 'Advanced',
    duration: '5 hours',
    modules: 4,
    videos: 13,
    readings: 8,
    labs: 6,
    icon: Upload,
    color: 'cyan',
    relatedVulnerabilities: ['file-upload', 'mime', 'validation'],
  },
  {
    id: 11,
    title: 'JWT Security Best Practices',
    description: 'Implement secure JSON Web Token authentication and authorization',
    category: 'Authentication',
    difficulty: 'Advanced',
    duration: '4 hours',
    modules: 4,
    videos: 12,
    readings: 8,
    labs: 5,
    icon: Lock,
    color: 'violet',
    relatedVulnerabilities: ['jwt', 'token', 'authentication'],
  },
];

const LearningPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [showScanSelector, setShowScanSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [recommendedCourses, setRecommendedCourses] = useState([]);

  // Fetch user's scan history
  useEffect(() => {
    const fetchScans = async () => {
      try {
        const { data } = await scanAPI.getJobs();
        const jobList = Array.isArray(data) ? data : data.jobs || [];
        const completedScans = jobList.filter(
          (job) => job.status === 'completed' || job.status?.toLowerCase?.() === 'completed'
        );
        setScans(completedScans);
      } catch (error) {
        console.error('Failed to fetch scans:', error);
      }
    };
    fetchScans();
  }, []);

  // Generate AI recommendations based on selected scan
  useEffect(() => {
    if (selectedScan) {
      // Simulate AI analysis and course recommendations
      const mockRecommendations = [
        { courseId: 11, reason: 'Detected JWT vulnerabilities in your code', priority: 'high' },
        { courseId: 1, reason: 'SQL injection risks found in database queries', priority: 'high' },
        { courseId: 10, reason: 'File upload security issues detected', priority: 'medium' },
      ];
      setRecommendedCourses(mockRecommendations);
    }
  }, [selectedScan]);

  const categories = ['all', 'Authentication', 'Web Security', 'API Security', 'File Security', 'Cryptography', 'DevSecOps'];

  const filteredCourses = COURSES.filter((course) => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || course.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCourseClick = (courseId) => {
    navigate(`/course/${courseId}`);
  };

  const difficultyColors = {
    Beginner: isDark ? 'text-green-400 bg-green-500/15' : 'text-green-600 bg-green-50',
    Intermediate: isDark ? 'text-yellow-400 bg-yellow-500/15' : 'text-yellow-600 bg-yellow-50',
    Advanced: isDark ? 'text-red-400 bg-red-500/15' : 'text-red-600 bg-red-50',
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f4f6fb]'}`}>
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div
              className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                isDark
                  ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30'
                  : 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200'
              }`}
            >
              <Sparkles size={12} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                  isDark ? 'text-indigo-400' : 'text-indigo-600'
                }`}
              >
                AI-Powered Learning
              </span>
            </div>
          </div>
          <h1 className={`text-[32px] font-extrabold tracking-tight leading-none mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Learning Insights
          </h1>
          <p className={`text-[15px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Master security concepts with AI-recommended courses based on your scan results
          </p>
        </div>

        {/* AI Coach Banner */}
        <div
          className={`mb-6 rounded-2xl border p-6 cursor-pointer transition-all hover:scale-[1.01] ${
            isDark
              ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30 hover:border-purple-500/50'
              : 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:border-purple-300'
          }`}
          onClick={() => navigate('/coach')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Brain size={24} className="text-white" />
              </div>
              <div>
                <h3 className={`text-[16px] font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Try AI Learning Coach
                </h3>
                <p className={`text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Ask questions about vulnerabilities and get instant, personalized guidance
                </p>
              </div>
            </div>
            <ChevronRight size={20} className={isDark ? 'text-purple-400' : 'text-purple-600'} />
          </div>
        </div>

        {/* Scan Selector */}
        {scans.length > 0 && (
          <div className="mb-6">
            <label className={`block text-[13px] font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Select a scan for AI recommendations
            </label>
            <div className="relative">
              <button
                onClick={() => setShowScanSelector(!showScanSelector)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  isDark
                    ? 'bg-[#1a1d2e]/60 border-white/[0.1] hover:border-white/[0.2] text-white'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
                }`}
              >
                <span className="text-[14px]">
                  {selectedScan ? selectedScan.repository_name || 'Unnamed Repository' : 'No scan selected'}
                </span>
                <ChevronRight
                  size={16}
                  className={`transition-transform ${showScanSelector ? 'rotate-90' : ''} ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                />
              </button>

              {showScanSelector && (
                <div
                  className={`absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-xl z-10 max-h-64 overflow-y-auto ${
                    isDark ? 'bg-[#1a1d2e] border-white/[0.1]' : 'bg-white border-slate-200'
                  }`}
                >
                  {scans.map((scan) => (
                    <button
                      key={scan.job_id}
                      onClick={() => {
                        setSelectedScan(scan);
                        setShowScanSelector(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 transition-colors text-left ${
                        selectedScan?.job_id === scan.job_id
                          ? isDark
                            ? 'bg-indigo-500/15'
                            : 'bg-indigo-50'
                          : isDark
                          ? 'hover:bg-white/[0.05]'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {scan.repository_name || 'Unnamed Repository'}
                        </p>
                        <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          {scan.total_vulnerabilities || 0} vulnerabilities • {new Date(scan.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {selectedScan?.job_id === scan.job_id && (
                        <CheckCircle size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Recommendations */}
        {selectedScan && recommendedCourses.length > 0 && (
          <div
            className={`mb-6 rounded-2xl border p-5 ${
              isDark ? 'bg-[#1a1d2e]/60 border-white/[0.06]' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
              <h3 className={`text-[16px] font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                AI Recommended for You
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendedCourses.map((rec) => {
                const course = COURSES.find((c) => c.id === rec.courseId);
                if (!course) return null;
                const Icon = course.icon;
                return (
                  <button
                    key={course.id}
                    onClick={() => handleCourseClick(course.id)}
                    className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                      isDark
                        ? 'bg-[#0f1120] border-white/[0.06] hover:border-indigo-500/30'
                        : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg bg-${course.color}-500/15 flex items-center justify-center flex-shrink-0`}>
                        <Icon size={18} className={`text-${course.color}-500`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-[14px] font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {course.title}
                        </h4>
                        <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {rec.reason}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border text-[14px] transition-colors ${
                isDark
                  ? 'bg-[#1a1d2e]/60 border-white/[0.1] text-white placeholder-slate-500 focus:border-white/[0.2]'
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-300'
              }`}
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-all ${
                selectedCategory === category
                  ? 'bg-indigo-600 text-white'
                  : isDark
                  ? 'bg-[#1a1d2e]/60 text-slate-400 hover:text-white'
                  : 'bg-white text-slate-600 hover:text-slate-900'
              }`}
            >
              {category === 'all' ? 'All Courses' : category}
            </button>
          ))}
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const Icon = course.icon;
            return (
              <button
                key={course.id}
                onClick={() => handleCourseClick(course.id)}
                className={`rounded-2xl border p-6 text-left transition-all hover:scale-[1.02] ${
                  isDark
                    ? 'bg-[#1a1d2e]/60 border-white/[0.06] hover:border-white/[0.1]'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Icon and Category */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-${course.color}-500/15 flex items-center justify-center`}>
                    <Icon size={22} className={`text-${course.color}-500`} />
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${difficultyColors[course.difficulty]}`}
                  >
                    {course.difficulty}
                  </span>
                </div>

                {/* Title and Description */}
                <h3 className={`text-[16px] font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {course.title}
                </h3>
                <p className={`text-[13px] mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {course.description}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    <Play size={12} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                    <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                      {course.videos} videos
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText size={12} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                    <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                      {course.readings} readings
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FlaskConical size={12} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                    <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                      {course.labs} labs
                    </span>
                  </div>
                </div>

                {/* Duration and Start Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Clock size={12} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                    <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                      {course.duration}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-indigo-600">
                    <span className="text-[12px] font-semibold">Start Learning</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LearningPage;
