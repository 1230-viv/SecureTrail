import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { scanAPI } from '../services/api';
import {
  Sparkles, Send, Loader2, AlertCircle, CheckCircle2, BookOpen,
  Code, Shield, ChevronDown, Bot, User, ArrowRight, PlayCircle,
  FileCode, FlaskConical, Brain,
} from 'lucide-react';

const LearningCoachPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [showScanSelector, setShowScanSelector] = useState(false);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recommendedCourses, setRecommendedCourses] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  // Load scan details and vulnerabilities
  useEffect(() => {
    if (selectedScan) {
      loadScanDetails(selectedScan);
    }
  }, [selectedScan]);

  const loadScanDetails = async (scan) => {
    try {
      // Simulate loading vulnerabilities from scan
      const mockVulnerabilities = [
        {
          id: 1,
          title: 'JWT signed with weak algorithm',
          severity: 'critical',
          category: 'authentication',
          description: 'JWT tokens are being signed with "none" algorithm, allowing token forgery',
          file: 'api/auth.py',
          line: 77,
        },
        {
          id: 2,
          title: 'SQL Injection vulnerability',
          severity: 'high',
          category: 'injection',
          description: 'User input is concatenated directly into SQL query without parameterization',
          file: 'database/queries.py',
          line: 145,
        },
        {
          id: 3,
          title: 'Missing MIME type validation',
          severity: 'high',
          category: 'file-upload',
          description: 'File uploads only check extension, not actual MIME type',
          file: 'routes/upload.py',
          line: 52,
        },
      ];

      setVulnerabilities(mockVulnerabilities);

      // Generate AI welcome message
      const welcomeMessage = {
        id: Date.now(),
        type: 'ai',
        content: `Hello! I've analyzed your repository **${scan.repository_name}** and found **${scan.total_vulnerabilities} vulnerabilities**.

Here's what I found:
- **${scan.critical_count || 0}** Critical issues
- **${scan.high_count || 0}** High severity issues  
- **${scan.medium_count || 0}** Medium severity issues

I can help you understand these vulnerabilities and recommend courses to fix them. What would you like to learn about?`,
        timestamp: new Date(),
      };

      setMessages([welcomeMessage]);

      // Generate course recommendations
      const courses = [
        {
          id: 11,
          title: 'JWT Security Best Practices',
          reason: 'Fixes JWT weak algorithm vulnerability',
          severity: 'critical',
        },
        {
          id: 1,
          title: 'SQL Injection Prevention',
          reason: 'Addresses SQL injection in database queries',
          severity: 'high',
        },
        {
          id: 10,
          title: 'File Upload Security',
          reason: 'Covers MIME type validation and secure uploads',
          severity: 'high',
        },
      ];

      setRecommendedCourses(courses);
    } catch (error) {
      console.error('Failed to load scan details:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = generateAIResponse(inputMessage);
      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const generateAIResponse = (query) => {
    const lowerQuery = query.toLowerCase();

    let response = '';

    if (lowerQuery.includes('jwt') || lowerQuery.includes('token')) {
      response = `Great question about JWT security! 

**The Issue:**
Your code is using the "none" algorithm to sign JWT tokens. This is extremely dangerous because it allows anyone to create valid tokens without a secret key.

**How to Fix:**
1. Always use strong algorithms like **HS256** or **RS256**
2. Never use the "none" algorithm in production
3. Store your secret key securely (use environment variables)

**Example Fix:**
\`\`\`python
# ❌ VULNERABLE
token = jwt.encode(payload, None, algorithm='none')

# ✅ SECURE
token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
\`\`\`

Would you like me to recommend a course on JWT security?`;
    } else if (lowerQuery.includes('sql') || lowerQuery.includes('injection')) {
      response = `SQL Injection is one of the most common vulnerabilities! Let me explain:

**The Problem:**
Your code concatenates user input directly into SQL queries, allowing attackers to inject malicious SQL commands.

**Vulnerable Code Example:**
\`\`\`python
query = f"SELECT * FROM users WHERE username = '{user_input}'"
\`\`\`

**How to Fix:**
Use **parameterized queries** or **prepared statements**:

\`\`\`python
# ✅ SECURE
query = "SELECT * FROM users WHERE username = %s"
cursor.execute(query, (user_input,))
\`\`\`

**Why This Works:**
The database treats user input as data, not as SQL code, preventing injection attacks.

I recommend taking the **SQL Injection Prevention** course for hands-on practice!`;
    } else if (lowerQuery.includes('file') || lowerQuery.includes('upload')) {
      response = `File upload vulnerabilities can be serious! Here's what's happening:

**The Issue:**
Your code only checks file extensions (like .jpg, .png) but not the actual file content. Attackers can rename malicious files.

**The Risk:**
- Upload executable files (.php, .jsp)
- Execute code on your server
- Gain unauthorized access

**Solution:**
1. **Validate MIME types** using libraries
2. **Scan file content**, not just extension
3. **Store uploads outside web root**
4. **Rename files** to prevent execution

**Secure Example:**
\`\`\`python
import magic

# Check actual MIME type
mime = magic.from_buffer(file_content, mime=True)
if mime not in ['image/jpeg', 'image/png']:
    raise ValueError('Invalid file type')
\`\`\`

Check out the **File Upload Security** course to learn more!`;
    } else if (lowerQuery.includes('course') || lowerQuery.includes('learn')) {
      response = `I have recommended **3 courses** based on your vulnerabilities:

1. **JWT Security Best Practices** - Fixes your critical authentication issue
2. **SQL Injection Prevention** - Addresses database security
3. **File Upload Security** - Covers secure file handling

You can start any course by clicking on it below. Each course includes:
- 📹 Video lessons
- 📖 Reading materials  
- 🧪 Hands-on labs

Which one would you like to start with?`;
    } else {
      response = `I understand you're asking about "${query}". 

Based on your scan results, I recommend focusing on these critical areas:

1. **JWT Security** - Your most critical vulnerability
2. **SQL Injection** - Common but dangerous
3. **File Upload Security** - Important for data protection

Feel free to ask me specific questions about any vulnerability, or I can recommend courses to help you fix them!

**Example questions:**
- "How do I fix the JWT vulnerability?"
- "What is SQL injection?"
- "Show me how to secure file uploads"`;
    }

    return {
      id: Date.now(),
      type: 'ai',
      content: response,
      timestamp: new Date(),
    };
  };

  const handleCourseClick = (courseId) => {
    navigate(`/course/${courseId}`);
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
                  ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                  : 'bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200'
              }`}
            >
              <Brain size={12} className={isDark ? 'text-purple-400' : 'text-purple-600'} />
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                  isDark ? 'text-purple-400' : 'text-purple-600'
                }`}
              >
                AI Learning Coach
              </span>
            </div>
          </div>
          <h1 className={`text-[32px] font-extrabold tracking-tight leading-none mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            AI Learning Coach
          </h1>
          <p className={`text-[15px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Get personalized security guidance based on your scan results
          </p>
        </div>

        {/* Scan Selector */}
        {scans.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <button
                onClick={() => setShowScanSelector(!showScanSelector)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  isDark
                    ? 'bg-[#1a1d2e]/60 border-white/[0.1] hover:border-white/[0.2] text-white'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <AlertCircle size={16} className={isDark ? 'text-purple-400' : 'text-purple-600'} />
                  <div className="text-left">
                    <p className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedScan
                        ? selectedScan.repository_name || 'Unnamed Repository'
                        : 'Select a scan to analyze'}
                    </p>
                    {selectedScan && (
                      <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        {selectedScan.total_vulnerabilities || 0} vulnerabilities found
                      </p>
                    )}
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`transition-transform ${showScanSelector ? 'rotate-180' : ''} ${
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
                            ? 'bg-purple-500/15'
                            : 'bg-purple-50'
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
                          {scan.total_vulnerabilities || 0} vulnerabilities •{' '}
                          {new Date(scan.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {selectedScan?.job_id === scan.job_id && (
                        <CheckCircle2 size={16} className={isDark ? 'text-purple-400' : 'text-purple-600'} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        {selectedScan && (
          <div className="grid grid-cols-12 gap-6">
            {/* Chat Area */}
            <div className="col-span-12 lg:col-span-8">
              <div
                className={`rounded-2xl border ${
                  isDark ? 'bg-[#1a1d2e]/60 border-white/[0.06]' : 'bg-white border-slate-200'
                }`}
              >
                {/* Chat Messages */}
                <div className="h-[600px] overflow-y-auto p-6 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.type === 'ai'
                            ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                            : isDark
                            ? 'bg-indigo-500'
                            : 'bg-indigo-600'
                        }`}
                      >
                        {message.type === 'ai' ? (
                          <Bot size={16} className="text-white" />
                        ) : (
                          <User size={16} className="text-white" />
                        )}
                      </div>

                      {/* Message Content */}
                      <div
                        className={`flex-1 rounded-2xl p-4 ${
                          message.type === 'ai'
                            ? isDark
                              ? 'bg-[#0f1120]'
                              : 'bg-slate-50'
                            : isDark
                            ? 'bg-indigo-500/15 border border-indigo-500/30'
                            : 'bg-indigo-50 border border-indigo-200'
                        }`}
                      >
                        <div
                          className={`text-[14px] leading-relaxed whitespace-pre-wrap ${
                            isDark ? 'text-slate-300' : 'text-slate-700'
                          }`}
                          dangerouslySetInnerHTML={{
                            __html: message.content
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-black/20 font-mono text-xs">$1</code>')
                              .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="mt-2 p-3 rounded-lg bg-black/30 overflow-x-auto"><code class="text-xs font-mono">$2</code></pre>'),
                          }}
                        />
                        <p className={`text-[10px] mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Bot size={16} className="text-white" />
                      </div>
                      <div className={`rounded-2xl p-4 ${isDark ? 'bg-[#0f1120]' : 'bg-slate-50'}`}>
                        <Loader2 size={16} className="animate-spin text-purple-500" />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className={`border-t p-4 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask me anything about your vulnerabilities..."
                      className={`flex-1 px-4 py-3 rounded-xl text-[14px] border transition-colors ${
                        isDark
                          ? 'bg-[#0f1120] border-white/[0.06] text-white placeholder-slate-500 focus:border-purple-500/50'
                          : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-300'
                      }`}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoading}
                      className="px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 
                                 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                  <p className={`text-[11px] mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    💡 Try: "How do I fix JWT vulnerability?" or "Explain SQL injection"
                  </p>
                </div>
              </div>
            </div>

            {/* Sidebar - Recommended Courses & Vulnerabilities */}
            <div className="col-span-12 lg:col-span-4 space-y-4">
              {/* Recommended Courses */}
              <div
                className={`rounded-2xl border p-5 ${
                  isDark ? 'bg-[#1a1d2e]/60 border-white/[0.06]' : 'bg-white border-slate-200'
                }`}
              >
                <h3 className={`text-[16px] font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Recommended Courses
                </h3>
                <div className="space-y-3">
                  {recommendedCourses.map((course) => (
                    <button
                      key={course.id}
                      onClick={() => handleCourseClick(course.id)}
                      className={`w-full p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                        isDark
                          ? 'bg-[#0f1120] border-white/[0.06] hover:border-purple-500/30'
                          : 'bg-slate-50 border-slate-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {course.title}
                        </h4>
                        <ArrowRight size={14} className={isDark ? 'text-purple-400' : 'text-purple-600'} />
                      </div>
                      <p className={`text-[11px] mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {course.reason}
                      </p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          course.severity === 'critical'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-orange-500/15 text-orange-400'
                        }`}
                      >
                        {course.severity}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vulnerabilities */}
              <div
                className={`rounded-2xl border p-5 ${
                  isDark ? 'bg-[#1a1d2e]/60 border-white/[0.06]' : 'bg-white border-slate-200'
                }`}
              >
                <h3 className={`text-[16px] font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Key Vulnerabilities
                </h3>
                <div className="space-y-3">
                  {vulnerabilities.map((vuln) => (
                    <div
                      key={vuln.id}
                      className={`p-3 rounded-lg ${isDark ? 'bg-[#0f1120]' : 'bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h4 className={`text-[12px] font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {vuln.title}
                        </h4>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                            vuln.severity === 'critical'
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-orange-500/15 text-orange-400'
                          }`}
                        >
                          {vuln.severity}
                        </span>
                      </div>
                      <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                        {vuln.file}:{vuln.line}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!selectedScan && scans.length > 0 && (
          <div
            className={`rounded-2xl border p-12 text-center ${
              isDark ? 'bg-[#1a1d2e]/60 border-white/[0.06]' : 'bg-white border-slate-200'
            }`}
          >
            <Brain size={48} className={`mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Select a scan to start learning
            </h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Choose a repository scan above and I'll help you understand and fix the vulnerabilities
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningCoachPage;
