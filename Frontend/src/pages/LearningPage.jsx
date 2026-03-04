import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { scanAPI } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Play, FileText, FlaskConical, Clock, Award,
  TrendingUp, Filter, Search, ChevronRight, Sparkles,
  Shield, Code, Lock, Database, Upload, Key, AlertTriangle,
  CheckCircle, Brain, X, ArrowRight, Zap, Target,
  ChevronDown, ScanLine, Star, Layers, BookMarked,
} from 'lucide-react';

/* ─── Course Catalog (unchanged) ────────────────────────────────────────────── */
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

/* ─── Color maps ─────────────────────────────────────────────────────────────── */
const COLOR_MAP = {
  blue:   { hex: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.28)'  },
  purple: { hex: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.28)'  },
  red:    { hex: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.28)'   },
  green:  { hex: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.28)'  },
  orange: { hex: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.28)'  },
  pink:   { hex: '#ec4899', bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.28)'  },
  indigo: { hex: '#6366f1', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.28)'  },
  teal:   { hex: '#14b8a6', bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.28)'  },
  yellow: { hex: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.28)'   },
  cyan:   { hex: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.28)'   },
  violet: { hex: '#7c3aed', bg: 'rgba(124,58,237,0.12)',  border: 'rgba(124,58,237,0.28)'  },
};

const DIFFICULTY_CFG = {
  Beginner:     { hex: '#10b981', bg: 'rgba(16,185,129,0.14)',  border: 'rgba(16,185,129,0.3)'  },
  Intermediate: { hex: '#f59e0b', bg: 'rgba(245,158,11,0.14)',  border: 'rgba(245,158,11,0.3)'  },
  Advanced:     { hex: '#ef4444', bg: 'rgba(239,68,68,0.14)',   border: 'rgba(239,68,68,0.3)'   },
};

const CATEGORIES = ['all', 'Authentication', 'Web Security', 'API Security', 'File Security', 'Cryptography', 'DevSecOps'];

const CATEGORY_ICONS = {
  all:           Layers,
  Authentication: Lock,
  'Web Security':  Shield,
  'API Security':  Zap,
  'File Security': Upload,
  Cryptography:   Key,
  DevSecOps:      Target,
};

/* ─── CourseCard ─────────────────────────────────────────────────────────────── */
const CourseCard = ({ course, index, isDark, onClick, isRecommended }) => {
  const [hovered, setHovered] = useState(false);
  const Icon = course.icon;
  const cc   = COLOR_MAP[course.color] || COLOR_MAP.blue;
  const dc   = DIFFICULTY_CFG[course.difficulty] || DIFFICULTY_CFG.Beginner;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.055, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -5 }}
      onClick={() => onClick(course.id)}
      style={{
        borderRadius: 20, overflow: 'hidden', position: 'relative',
        background: isDark ? 'rgba(17,24,39,0.9)' : 'rgba(255,255,255,0.98)',
        border: `1px solid ${hovered ? cc.border : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
        boxShadow: hovered
          ? `0 16px 48px ${cc.hex}22, 0 0 0 1px ${cc.border}`
          : isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.05)',
        cursor: 'pointer', backdropFilter: 'blur(16px)',
        transition: 'border 0.25s, box-shadow 0.25s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Colored top stripe */}
      <div style={{
        height: 3, flexShrink: 0,
        background: `linear-gradient(90deg, ${cc.hex}, ${cc.hex}80)`,
        opacity: hovered ? 1 : 0.6, transition: 'opacity 0.25s',
      }} />

      {/* Recommended ribbon */}
      {isRecommended && (
        <div style={{
          position: 'absolute', top: 14, right: -22,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
          textTransform: 'uppercase', padding: '3px 28px',
          transform: 'rotate(45deg)',
          boxShadow: '0 2px 8px rgba(99,102,241,0.5)',
        }}>
          AI Pick
        </div>
      )}

      <div style={{ padding: '20px 20px 22px', display: 'flex', flexDirection: 'column', flex: 1, gap: 0 }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <motion.div
            whileHover={{ scale: 1.08, rotate: 4 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: cc.bg, border: `1px solid ${cc.border}`,
              boxShadow: hovered ? `0 0 18px ${cc.hex}40` : 'none',
              transition: 'box-shadow 0.25s',
            }}
          >
            <Icon size={20} style={{ color: cc.hex }} />
          </motion.div>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 100,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: dc.hex, background: dc.bg, border: `1px solid ${dc.border}`,
          }}>
            {course.difficulty}
          </span>
        </div>

        {/* Title + description */}
        <h3 style={{
          fontSize: 15, fontWeight: 800, lineHeight: 1.3, marginBottom: 8,
          color: hovered ? cc.hex : isDark ? '#f1f5f9' : '#0f172a',
          transition: 'color 0.2s',
        }}>
          {course.title}
        </h3>
        <p style={{
          fontSize: 12, lineHeight: 1.65, marginBottom: 16, flex: 1,
          color: isDark ? '#64748b' : '#94a3b8',
        }}>
          {course.description}
        </p>

        {/* Meta stats */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap',
        }}>
          {[
            { icon: Play,        val: `${course.videos} videos`   },
            { icon: FileText,    val: `${course.readings} reads`   },
            { icon: FlaskConical,val: `${course.labs} labs`        },
          ].map(({ icon: MIcon, val }) => (
            <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MIcon size={11} style={{ color: isDark ? '#475569' : '#94a3b8', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8', fontWeight: 500 }}>
                {val}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 14,
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Clock size={11} style={{ color: isDark ? '#475569' : '#94a3b8' }} />
            <span style={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8', fontWeight: 500 }}>
              {course.duration}
            </span>
          </div>
          <motion.div
            animate={{ x: hovered ? 0 : -4, opacity: hovered ? 1 : 0.5 }}
            transition={{ duration: 0.2 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 800, color: cc.hex,
            }}
          >
            Start Learning <ArrowRight size={13} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

/* ─── LearningPage ───────────────────────────────────────────────────────────── */
const LearningPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  /* ── State (logic unchanged) ──────────────────────────────────────────────── */
  const [scans,               setScans]               = useState([]);
  const [selectedScan,        setSelectedScan]        = useState(null);
  const [showScanSelector,    setShowScanSelector]    = useState(false);
  const [searchQuery,         setSearchQuery]         = useState('');
  const [selectedCategory,    setSelectedCategory]    = useState('all');
  const [recommendedCourses,  setRecommendedCourses]  = useState([]);

  /* ── Fetch scans (logic unchanged) ──────────────────────────────────────── */
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

  /* ── AI recommendations (logic unchanged) ────────────────────────────────── */
  useEffect(() => {
    if (selectedScan) {
      const mockRecommendations = [
        { courseId: 11, reason: 'Detected JWT vulnerabilities in your code', priority: 'high' },
        { courseId: 1,  reason: 'SQL injection risks found in database queries', priority: 'high' },
        { courseId: 10, reason: 'File upload security issues detected', priority: 'medium' },
      ];
      setRecommendedCourses(mockRecommendations);
    }
  }, [selectedScan]);

  /* ── Derived filters (logic unchanged) ───────────────────────────────────── */
  const filteredCourses = COURSES.filter((course) => {
    const matchesSearch  = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           course.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || course.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCourseClick = (courseId) => {
    navigate(`/course/${courseId}`);
  };

  const recommendedIds = new Set(recommendedCourses.map(r => r.courseId));

  /* ── Styling helpers ─────────────────────────────────────────────────────── */
  const bg      = isDark ? '#0d0f17' : '#f4f6fb';
  const cardBg  = isDark ? 'rgba(17,24,39,0.9)' : 'rgba(255,255,255,0.98)';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <div style={{ minHeight: '100vh', background: bg, position: 'relative', overflow: 'hidden' }}>

      {/* ── Ambient orbs ──────────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }} aria-hidden>
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.09, 0.05] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: -100, right: -100, width: 600, height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,1), transparent 70%)',
          }}
        />
        <div style={{
          position: 'absolute', bottom: 0, left: -200, width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.07), transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', top: '40%', left: '40%', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.04), transparent 70%)',
        }} />
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 28px', position: 'relative', zIndex: 1 }}>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1 — HERO
        ══════════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: 36 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,340px)', gap: 24, alignItems: 'center' }}>

            {/* Left — headline */}
            <div>
              {/* Badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 14px', borderRadius: 100, marginBottom: 18,
                background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                border: `1px solid ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.22)'}`,
                boxShadow: isDark ? '0 0 18px rgba(99,102,241,0.18)' : 'none',
              }}>
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                >
                  <Sparkles size={11} style={{ color: '#6366f1' }} />
                </motion.div>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: isDark ? '#818cf8' : '#6366f1',
                }}>
                  AI-Powered Learning
                </span>
              </div>

              <h1 style={{
                fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 900,
                letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 12px',
              }}>
                <span style={{
                  backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  AI-Powered
                </span>{' '}
                <span style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                  Security Learning
                </span>
              </h1>
              <p style={{
                fontSize: 14, lineHeight: 1.7, maxWidth: 500,
                color: isDark ? '#64748b' : '#64748b', margin: '0 0 22px',
              }}>
                Master cybersecurity concepts with personalized learning paths based on your vulnerability scans.
              </p>

              {/* Stats strip */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                {[
                  { icon: BookMarked, val: `${COURSES.length}`,  label: 'courses available' },
                  { icon: FlaskConical, val: '50+',              label: 'hands-on labs'     },
                  { icon: Award,        val: 'AI',               label: 'personalized paths'},
                ].map(({ icon: SI, val, label }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 + i * 0.07 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                    }}>
                      <SI size={13} style={{ color: '#6366f1' }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a' }}>{val}</span>
                    <span style={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8' }}>{label}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right — AI Coach CTA */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4, scale: 1.015 }}
              onClick={() => navigate('/coach')}
              style={{
                borderRadius: 20, padding: '22px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.15) 100%)'
                  : 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(139,92,246,0.1) 100%)',
                border: `1px solid ${isDark ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.22)'}`,
                boxShadow: isDark ? '0 8px 32px rgba(99,102,241,0.18)' : '0 4px 20px rgba(99,102,241,0.12)',
              }}
            >
              {/* Background glow */}
              <div style={{
                position: 'absolute', top: -20, right: -20, width: 140, height: 140, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%)',
                pointerEvents: 'none',
              }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <motion.div
                    animate={{ boxShadow: ['0 0 0 0 rgba(139,92,246,0.3)', '0 0 0 10px rgba(139,92,246,0)', '0 0 0 0 rgba(139,92,246,0.3)'] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    style={{
                      width: 48, height: 48, borderRadius: 16, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                      boxShadow: '0 4px 16px rgba(139,92,246,0.4)',
                    }}
                  >
                    <Brain size={22} style={{ color: '#fff' }} />
                  </motion.div>
                  <div>
                    <div style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: isDark ? '#a78bfa' : '#7c3aed', marginBottom: 3,
                    }}>
                      AI Learning Coach
                    </div>
                    <h3 style={{
                      fontSize: 15, fontWeight: 800, margin: 0,
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    }}>
                      Try AI Learning Coach
                    </h3>
                  </div>
                </div>
                <p style={{
                  fontSize: 12, lineHeight: 1.6, marginBottom: 14,
                  color: isDark ? '#94a3b8' : '#64748b',
                }}>
                  Ask questions about vulnerabilities and get instant, personalized security guidance powered by AI.
                </p>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 800,
                  color: isDark ? '#a78bfa' : '#7c3aed',
                }}>
                  Start chatting <ArrowRight size={13} />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2 — SCAN CONTEXT CARD
        ══════════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: 28 }}
        >
          <div style={{
            borderRadius: 18, overflow: 'visible', position: 'relative',
            background: cardBg, border: `1px solid ${borderC}`,
            backdropFilter: 'blur(16px)',
            boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.25)' : '0 4px 20px rgba(99,102,241,0.07)',
          }}>
            {/* Top accent line */}
            <div style={{
              height: 3, borderRadius: '18px 18px 0 0',
              background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6) 40%, rgba(139,92,246,0.7) 70%, transparent)',
            }} />

            <div style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                {/* Left label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ScanLine size={14} style={{ color: '#6366f1' }} />
                  <span style={{
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: isDark ? '#475569' : '#94a3b8',
                  }}>
                    Scan Context
                  </span>
                  {selectedScan && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100,
                      background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)',
                    }}>
                      Active
                    </span>
                  )}
                </div>

                {/* Selected scan info */}
                {selectedScan && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                        {selectedScan.repository_name || 'Unnamed Repository'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      {[
                        { label: 'Vulnerabilities', val: selectedScan.total_vulnerabilities || 0, color: selectedScan.total_vulnerabilities > 0 ? '#ef4444' : '#10b981' },
                        { label: 'Scanned', val: new Date(selectedScan.created_at).toLocaleDateString(), color: isDark ? '#94a3b8' : '#64748b' },
                      ].map(({ label, val, color }) => (
                        <div key={label}>
                          <div style={{ fontSize: 9, color: isDark ? '#475569' : '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setSelectedScan(null); setRecommendedCourses([]); }}
                      style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                        color: '#ef4444', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                        fontSize: 10, fontWeight: 700,
                      }}
                    >
                      <X size={10} /> Clear
                    </motion.button>
                  </div>
                )}

                {/* Scan selector dropdown (only if scans exist) */}
                {scans.length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setShowScanSelector(!showScanSelector)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.07)',
                        border: `1px solid ${isDark ? 'rgba(99,102,241,0.28)' : 'rgba(99,102,241,0.2)'}`,
                        color: isDark ? '#818cf8' : '#6366f1',
                        boxShadow: showScanSelector ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
                      }}
                    >
                      <ScanLine size={12} />
                      {selectedScan ? 'Change Scan' : 'Select Scan'}
                      <ChevronDown size={12} style={{ transform: showScanSelector ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </motion.button>

                    <AnimatePresence>
                      {showScanSelector && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.97 }}
                          transition={{ duration: 0.18 }}
                          style={{
                            position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 280, zIndex: 50,
                            borderRadius: 14, overflow: 'hidden',
                            background: isDark ? 'rgba(17,24,39,0.98)' : '#fff',
                            border: `1px solid ${borderC}`,
                            boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 32px rgba(0,0,0,0.12)',
                            backdropFilter: 'blur(20px)',
                            maxHeight: 260, overflowY: 'auto',
                          }}
                        >
                          {scans.map((scan, i) => (
                            <motion.button
                              key={scan.job_id}
                              whileHover={{ backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)' }}
                              onClick={() => { setSelectedScan(scan); setShowScanSelector(false); }}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '11px 16px', background: selectedScan?.job_id === scan.job_id
                                  ? isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)'
                                  : 'transparent',
                                border: 'none', borderBottom: i < scans.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` : 'none',
                                cursor: 'pointer', textAlign: 'left',
                              }}
                            >
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a', marginBottom: 2 }}>
                                  {scan.repository_name || 'Unnamed Repository'}
                                </p>
                                <p style={{ fontSize: 10, color: isDark ? '#475569' : '#94a3b8' }}>
                                  {scan.total_vulnerabilities || 0} vulnerabilities · {new Date(scan.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              {selectedScan?.job_id === scan.job_id && (
                                <CheckCircle size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                              )}
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Empty state */}
              {!selectedScan && scans.length === 0 && (
                <div style={{
                  marginTop: 16, padding: '16px', borderRadius: 12,
                  border: `1.5px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  }}>
                    <ScanLine size={16} style={{ color: isDark ? '#334155' : '#cbd5e1' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#64748b' : '#94a3b8', marginBottom: 2 }}>
                      No scan selected yet
                    </p>
                    <p style={{ fontSize: 11, color: isDark ? '#334155' : '#cbd5e1' }}>
                      Run a security scan first to get AI-personalized course recommendations.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════════════
            AI RECOMMENDATIONS (when scan selected)
        ══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {selectedScan && recommendedCourses.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              style={{ marginBottom: 28 }}
            >
              <div style={{
                borderRadius: 18, padding: '20px',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.1))'
                  : 'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(139,92,246,0.06))',
                border: `1px solid ${isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.18)'}`,
                boxShadow: isDark ? '0 4px 24px rgba(99,102,241,0.12)' : '0 4px 20px rgba(99,102,241,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Sparkles size={15} style={{ color: '#6366f1' }} />
                  </motion.div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#e2e8f0' : '#0f172a' }}>
                    AI Recommended for You
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 100,
                    background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)',
                  }}>
                    Based on your scan
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {recommendedCourses.map((rec, i) => {
                    const course = COURSES.find(c => c.id === rec.courseId);
                    if (!course) return null;
                    const Icon = course.icon;
                    const cc   = COLOR_MAP[course.color] || COLOR_MAP.blue;
                    return (
                      <motion.button
                        key={course.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                        whileHover={{ y: -3, scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleCourseClick(course.id)}
                        style={{
                          padding: '14px', borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                          background: isDark ? 'rgba(17,24,39,0.8)' : 'rgba(255,255,255,0.9)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                          boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.04)',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = cc.border; e.currentTarget.style.boxShadow = `0 4px 16px ${cc.hex}25`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'; e.currentTarget.style.boxShadow = isDark ? '0 2px 12px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.04)'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: cc.bg, border: `1px solid ${cc.border}`,
                          }}>
                            <Icon size={16} style={{ color: cc.hex }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontSize: 12, fontWeight: 800, marginBottom: 3,
                              color: isDark ? '#f1f5f9' : '#0f172a',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {course.title}
                            </p>
                            <p style={{ fontSize: 10, lineHeight: 1.5, color: isDark ? '#475569' : '#94a3b8' }}>
                              {rec.reason}
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3 — SEARCH + FILTER
        ══════════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: 24 }}
        >
          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search size={15} style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: isDark ? '#475569' : '#cbd5e1', pointerEvents: 'none',
            }} />
            <input
              type="text"
              placeholder="Search courses by title or topic…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', paddingLeft: 42, paddingRight: searchQuery ? 38 : 16,
                paddingTop: 11, paddingBottom: 11,
                borderRadius: 12, fontSize: 13, fontWeight: 400,
                background: isDark ? 'rgba(17,24,39,0.9)' : 'rgba(255,255,255,0.98)',
                border: `1px solid ${borderC}`,
                color: isDark ? '#f1f5f9' : '#1e293b',
                outline: 'none', boxSizing: 'border-box',
                backdropFilter: 'blur(16px)',
                boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.2s',
              }}
              onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = borderC; e.target.style.boxShadow = isDark ? '0 2px 12px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.04)'; }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                  color: isDark ? '#475569' : '#94a3b8', display: 'flex', alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category pill filters */}
          <div style={{
            display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <Filter size={12} style={{ color: isDark ? '#475569' : '#94a3b8', flexShrink: 0 }} />
            {CATEGORIES.map(cat => {
              const isActive = selectedCategory === cat;
              const CatIcon  = CATEGORY_ICONS[cat] || BookOpen;
              return (
                <motion.button
                  key={cat}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 13px', borderRadius: 100, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                    background: isActive
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                      : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
                    color: isActive ? '#fff' : isDark ? '#64748b' : '#64748b',
                    boxShadow: isActive
                      ? '0 2px 14px rgba(99,102,241,0.4)'
                      : isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                    border: isActive ? 'none : 1px solid transparent' : `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                  }}
                >
                  <CatIcon size={11} />
                  {cat === 'all' ? 'All Courses' : cat}
                </motion.button>
              );
            })}

            {/* Result count */}
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 700,
              color: isDark ? '#334155' : '#94a3b8',
            }}>
              {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
            </span>
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4 — COURSE GRID
        ══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {filteredCourses.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '80px 24px', gap: 14,
              }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.06)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.15)'}`,
                }}
              >
                <Search size={26} style={{ color: isDark ? '#334155' : '#94a3b8' }} />
              </motion.div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: 6 }}>
                  No courses found
                </p>
                <p style={{ fontSize: 13, color: isDark ? '#475569' : '#94a3b8' }}>
                  Try adjusting your search query or clearing the category filter.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                style={{
                  padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                  border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                }}
              >
                Clear Filters
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 20,
              }}
            >
              {filteredCourses.map((course, i) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  index={i}
                  isDark={isDark}
                  onClick={handleCourseClick}
                  isRecommended={recommendedIds.has(course.id)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LearningPage;
