import React, { useState, useRef } from 'react';
import {
  Upload, ChevronDown, Github, FileArchive, X, ArrowRight,
  Zap, GitBranch, CheckCircle2, Loader2, RotateCcw,
  ShieldCheck, ScanLine,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [uploadMethod,       setUploadMethod]       = useState(null); // 'github' or 'zip'
  const [selectedBranch,     setSelectedBranch]     = useState('main');
  const [showRepoSelector,   setShowRepoSelector]   = useState(false);
  const [selectedRepository, setSelectedRepository] = useState(null);
  const [uploading,          setUploading]          = useState(false);
  const [uploadProgress,     setUploadProgress]     = useState(0);
  const fileInputRef = useRef(null);
  const { isDark }   = useTheme();

  /* ── Handlers (logic unchanged) ─────────────────────────────────────────── */
  const handleMethodSelect = async (method) => {
    if (method === 'github') {
      setUploadMethod('github');
      const token = localStorage.getItem('github_token');
      if (token) {
        setShowRepoSelector(true);
      } else {
        try {
          const response = await authAPI.getGitHubLoginUrl();
          const { auth_url } = response.data;
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

    if (!file.name.endsWith('.zip')) {
      toast.error('Only ZIP files are allowed');
      return;
    }
    const maxSize = 100 * 1024 * 1024;
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
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStartScan = async () => {
    if (!selectedRepository) {
      toast.warning('Please select a repository first');
      return;
    }
    try {
      toast.info('Queuing security scan…');
      const response = await repositoryAPI.scanRepository(
        selectedRepository.full_name,
        selectedBranch,
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

  /* ── Repo selector overlay (unchanged) ─────────────────────────────────── */
  if (showRepoSelector) {
    return (
      <RepositorySelector
        onSelect={handleRepositorySelect}
        onBack={() => { setShowRepoSelector(false); setUploadMethod(null); }}
      />
    );
  }

  const cardBg  = isDark ? 'rgba(17,24,39,0.9)' : 'rgba(255,255,255,0.98)';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  /* ── Main card ─────────────────────────────────────────────────────────── */
  return (
    <div style={{
      borderRadius: 22, overflow: 'hidden', position: 'relative',
      background: cardBg,
      border: `1px solid ${borderC}`,
      backdropFilter: 'blur(24px)',
      boxShadow: isDark
        ? '0 12px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)'
        : '0 8px 40px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,1)',
    }}>
      {/* Gradient top accent */}
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.7) 30%, rgba(139,92,246,0.9) 60%, rgba(99,102,241,0.7) 85%, transparent)',
      }} />

      <div style={{ padding: '24px 24px 28px' }}>

        {/* ── Card header ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <ScanLine size={15} style={{ color: '#6366f1' }} />
              <h2 style={{
                fontSize: 16, fontWeight: 800, margin: 0,
                color: isDark ? '#f8fafc' : '#0f172a',
              }}>
                Repository Upload
              </h2>
            </div>
            <p style={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8', margin: 0 }}>
              {!uploadMethod
                ? 'Choose how you want to provide your code'
                : uploadMethod === 'github' && !selectedRepository
                  ? 'Connect your GitHub account'
                  : uploadMethod === 'zip' && !selectedRepository
                    ? 'Upload a ZIP archive of your project'
                    : 'Ready to scan'}
            </p>
          </div>
          {(uploadMethod || selectedRepository) && (
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={handleReset}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 9,
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${borderC}`,
                color: isDark ? '#64748b' : '#94a3b8', cursor: 'pointer',
              }}
            >
              <RotateCcw size={11} /> Reset
            </motion.button>
          )}
        </div>

        <AnimatePresence mode="wait">

          {/* ══ STATE 1: Method selection ══════════════════════════════════ */}
          {!uploadMethod && (
            <motion.div
              key="method-select"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
            >
              {/* GitHub card */}
              <MethodCard
                onClick={() => handleMethodSelect('github')}
                Icon={Github}
                iconColor="#3b82f6"
                iconBg="rgba(59,130,246,0.12)"
                iconBorder="rgba(59,130,246,0.28)"
                hoverBorder="rgba(59,130,246,0.55)"
                hoverGlow="rgba(59,130,246,0.2)"
                isDark={isDark}
                title="Connect GitHub"
                desc="Authorize and select any repo from your GitHub account"
                arrowColor="#3b82f6"
              />

              {/* ZIP card */}
              <MethodCard
                onClick={() => handleMethodSelect('zip')}
                Icon={FileArchive}
                iconColor="#8b5cf6"
                iconBg="rgba(139,92,246,0.12)"
                iconBorder="rgba(139,92,246,0.28)"
                hoverBorder="rgba(139,92,246,0.55)"
                hoverGlow="rgba(139,92,246,0.2)"
                isDark={isDark}
                title="Upload ZIP File"
                desc="Upload a ZIP archive containing your project source"
                arrowColor="#8b5cf6"
              />
            </motion.div>
          )}

          {/* ══ STATE 2: ZIP dropzone ══════════════════════════════════════ */}
          {uploadMethod === 'zip' && !selectedRepository && (
            <motion.div
              key="zip-drop"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {/* Drop zone */}
              <motion.div
                whileHover={!uploading ? { scale: 1.008 } : {}}
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{
                  borderRadius: 16, padding: '40px 24px', textAlign: 'center',
                  position: 'relative', overflow: 'hidden', cursor: uploading ? 'default' : 'pointer',
                  background: isDark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.04)',
                  border: `2px dashed ${isDark ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.35)'}`,
                  transition: 'all 0.2s',
                  marginBottom: 14,
                }}
                onMouseEnter={e => {
                  if (!uploading) {
                    e.currentTarget.style.borderColor = 'rgba(139,92,246,0.65)';
                    e.currentTarget.style.background = isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.07)';
                    e.currentTarget.style.boxShadow = '0 0 24px rgba(139,92,246,0.18)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isDark ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.35)';
                  e.currentTarget.style.background = isDark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.04)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Glow orb background */}
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                }}>
                  <div style={{
                    width: 160, height: 160, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(139,92,246,0.2), transparent 70%)',
                    filter: 'blur(20px)',
                  }} />
                </div>

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <motion.div
                    animate={uploading ? {} : { y: [0, -4, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      width: 56, height: 56, borderRadius: 18, margin: '0 auto 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isDark ? 'rgba(139,92,246,0.16)' : 'rgba(139,92,246,0.12)',
                      border: '1px solid rgba(139,92,246,0.35)',
                      boxShadow: '0 0 24px rgba(139,92,246,0.25)',
                    }}
                  >
                    {uploading
                      ? <Loader2 size={24} style={{ color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
                      : <Upload size={24} style={{ color: isDark ? '#a78bfa' : '#7c3aed' }} />
                    }
                  </motion.div>

                  <p style={{
                    fontSize: 14, fontWeight: 700, marginBottom: 4,
                    color: isDark ? '#e2e8f0' : '#1e293b',
                  }}>
                    {uploading ? 'Uploading…' : 'Drop your ZIP here'}
                  </p>
                  <p style={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8', marginBottom: 16 }}>
                    {uploading ? `${uploadProgress}% complete` : 'or click to browse — max 100 MB'}
                  </p>

                  {uploading ? (
                    <div style={{
                      width: 200, height: 6, borderRadius: 6, overflow: 'hidden', margin: '0 auto',
                      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    }}>
                      <motion.div
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.4 }}
                        style={{
                          height: '100%', borderRadius: 6,
                          background: 'linear-gradient(90deg, #8b5cf6, #6366f1)',
                          boxShadow: '0 0 10px rgba(139,92,246,0.6)',
                        }}
                      />
                    </div>
                  ) : (
                    <span style={{
                      display: 'inline-block', padding: '7px 18px', borderRadius: 10,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)',
                      border: '1px solid rgba(139,92,246,0.32)',
                      color: isDark ? '#c4b5fd' : '#7c3aed',
                    }}>
                      Select ZIP File
                    </span>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </motion.div>

              <button
                onClick={() => setUploadMethod(null)}
                style={{
                  width: '100%', padding: '8px', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: isDark ? '#475569' : '#94a3b8',
                }}
              >
                ← Back to method selection
              </button>
            </motion.div>
          )}

          {/* ══ STATE 3: Repository selected ═══════════════════════════════ */}
          {selectedRepository && (
            <motion.div
              key="repo-selected"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {/* Selected repo display */}
              <div style={{
                padding: '14px 16px', borderRadius: 14, marginBottom: 16,
                background: isDark ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.05)',
                border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.18)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.28)',
                  }}>
                    {selectedRepository.type !== 'zip'
                      ? <Github size={18} style={{ color: isDark ? '#60a5fa' : '#3b82f6' }} />
                      : <FileArchive size={18} style={{ color: isDark ? '#a78bfa' : '#7c3aed' }} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: isDark ? '#475569' : '#94a3b8', marginBottom: 2,
                    }}>
                      Selected Repository
                    </p>
                    <p style={{
                      fontSize: 14, fontWeight: 700, margin: 0,
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {selectedRepository.name}
                    </p>
                    {selectedRepository.files_count && (
                      <p style={{ fontSize: 11, marginTop: 2, color: isDark ? '#475569' : '#94a3b8' }}>
                        {selectedRepository.files_count} files extracted
                      </p>
                    )}
                  </div>
                  <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                </div>
              </div>

              {/* Branch selector */}
              {selectedRepository.type !== 'zip' && (
                <div style={{ marginBottom: 18 }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 700, marginBottom: 6,
                    color: isDark ? '#64748b' : '#64748b',
                  }}>
                    <GitBranch size={11} /> Branch
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      style={{
                        width: '100%', paddingLeft: 14, paddingRight: 36,
                        paddingTop: 10, paddingBottom: 10,
                        borderRadius: 10, fontSize: 13, fontWeight: 500,
                        outline: 'none', appearance: 'none', cursor: 'pointer',
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        color: isDark ? '#e2e8f0' : '#1e293b',
                        boxSizing: 'border-box',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
                      onBlur={e => { e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; }}
                    >
                      <option value={selectedRepository.default_branch}>{selectedRepository.default_branch}</option>
                      <option value="develop">develop</option>
                      <option value="feature">feature</option>
                      <option value="staging">staging</option>
                    </select>
                    <ChevronDown size={14} style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      color: isDark ? '#475569' : '#94a3b8', pointerEvents: 'none',
                    }} />
                  </div>
                </div>
              )}

              {/* Start Scan CTA */}
              <motion.button
                whileHover={{ scale: 1.015, boxShadow: '0 6px 28px rgba(99,102,241,0.5)' }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartScan}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  fontSize: 14, fontWeight: 800, color: '#fff', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #6d28d9 100%)',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
                  letterSpacing: '0.01em',
                }}
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                >
                  <Zap size={15} fill="#fff" />
                </motion.div>
                Start Security Scan
                <ShieldCheck size={14} style={{ opacity: 0.7 }} />
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

/* ─── MethodCard ─────────────────────────────────────────────────────────────── */
const MethodCard = ({
  onClick, Icon, iconColor, iconBg, iconBorder,
  hoverBorder, hoverGlow, isDark, title, desc, arrowColor,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -3, scale: 1.005 }}
      whileTap={{ scale: 0.99 }}
      style={{
        width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0,
        cursor: 'pointer', outline: 'none', borderRadius: 14,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 18px', borderRadius: 14,
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
        border: `1px solid ${hovered ? hoverBorder : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        boxShadow: hovered
          ? `0 8px 28px ${hoverGlow}, 0 0 0 1px ${hoverBorder}`
          : isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'all 0.22s ease',
      }}>
        {/* Icon */}
        <motion.div
          animate={{ scale: hovered ? 1.1 : 1, rotate: hovered ? 6 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          style={{
            width: 52, height: 52, borderRadius: 16, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: iconBg, border: `1px solid ${iconBorder}`,
            boxShadow: hovered ? `0 0 20px ${hoverGlow}` : `0 0 10px ${iconBg}`,
          }}
        >
          <Icon size={24} style={{ color: iconColor }} />
        </motion.div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 14, fontWeight: 800, marginBottom: 3,
            color: hovered ? iconColor : isDark ? '#f1f5f9' : '#0f172a',
            transition: 'color 0.2s',
          }}>
            {title}
          </p>
          <p style={{
            fontSize: 11, lineHeight: 1.5,
            color: isDark ? '#475569' : '#94a3b8', margin: 0,
          }}>
            {desc}
          </p>
        </div>

        {/* Arrow */}
        <motion.div
          animate={{ x: hovered ? 0 : -4, opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ flexShrink: 0 }}
        >
          <ArrowRight size={16} style={{ color: arrowColor }} />
        </motion.div>
      </div>
    </motion.button>
  );
};

export default RepositoryUpload;
