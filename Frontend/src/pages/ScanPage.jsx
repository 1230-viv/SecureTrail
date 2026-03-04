import React, { useRef, useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Shield, Fingerprint, Eye, Lock, Zap,
  Sparkles, CheckCircle2, TrendingUp, Clock, Layers,
  ArrowRight, Activity, Terminal, Cpu, ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RepositoryUpload from '../components/RepositoryUpload';
import { useScan } from '../context/ScanContext';
import { useTheme } from '../context/ThemeContext';

/* ─── Animated counter ──────────────────────────────────────────────────────── */
const AnimatedNumber = ({ value, suffix = '', color, isDark }) => {
  const isLiteral = isNaN(parseInt(value));
  const [display, setDisplay] = React.useState(0);
  const target = parseInt(value) || 0;
  React.useEffect(() => {
    if (isLiteral) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const prog = Math.min((ts - start) / 1100, 1);
      const eased = 1 - Math.pow(1 - prog, 3);
      setDisplay(Math.round(eased * target));
      if (prog < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, isLiteral]);
  const val = isLiteral ? value : `${display.toLocaleString()}${suffix}`;
  return (
    <span style={{ fontSize: 20, fontWeight: 900, color: color || (isDark ? '#f8fafc' : '#0f172a'), letterSpacing: '-0.02em' }}>
      {val}
    </span>
  );
};

/* ─── Engine Manifest ───────────────────────────────────────────────────────── */
const ENGINES = [
  {
    icon: Shield,
    engine: 'Semgrep',
    tag: 'SAST',
    tagColor: '#8b5cf6',
    tagBg: 'rgba(139,92,246,0.14)',
    tagBorder: 'rgba(139,92,246,0.3)',
    tagGlow: 'rgba(139,92,246,0.5)',
    color: '#8b5cf6',
    status: 'online',
    brief: 'Static analysis across 20+ languages — SQL injection, XSS, insecure deserialization, and 1,000+ patterns.',
  },
  {
    icon: Fingerprint,
    engine: 'Trivy',
    tag: 'SCA',
    tagColor: '#3b82f6',
    tagBg: 'rgba(59,130,246,0.14)',
    tagBorder: 'rgba(59,130,246,0.3)',
    tagGlow: 'rgba(59,130,246,0.5)',
    color: '#3b82f6',
    status: 'online',
    brief: 'Dependency audit against NVD · OSV · GitHub Advisory for known CVEs in third-party libraries.',
  },
  {
    icon: Eye,
    engine: 'Gitleaks',
    tag: 'Secrets',
    tagColor: '#ef4444',
    tagBg: 'rgba(239,68,68,0.14)',
    tagBorder: 'rgba(239,68,68,0.3)',
    tagGlow: 'rgba(239,68,68,0.5)',
    color: '#ef4444',
    status: 'online',
    brief: 'Entropy-based and pattern-matched detection of credentials, API tokens, private keys, and connection strings.',
  },
  {
    icon: Lock,
    engine: 'AC Analyzer',
    tag: 'Access',
    tagColor: '#f59e0b',
    tagBg: 'rgba(245,158,11,0.14)',
    tagBorder: 'rgba(245,158,11,0.3)',
    tagGlow: 'rgba(245,158,11,0.5)',
    color: '#f59e0b',
    status: 'online',
    brief: 'Structural analysis for broken authentication, IDOR, privilege escalation, and missing route-level middleware.',
  },
];

const STATUS_LABEL = {
  online:     { dot: '#10b981', text: 'Online',     glow: 'rgba(16,185,129,0.5)'  },
  processing: { dot: '#f59e0b', text: 'Processing', glow: 'rgba(245,158,11,0.5)'  },
  offline:    { dot: '#ef4444', text: 'Offline',    glow: 'rgba(239,68,68,0.5)'   },
};

/* ─── EngineRow ─────────────────────────────────────────────────────────────── */
const EngineRow = ({ item, index, isDark }) => {
  const [hovered, setHovered] = React.useState(false);
  const Icon = item.icon;
  const s    = STATUS_LABEL[item.status] || STATUS_LABEL.online;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.3 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px',
        borderBottom: index < ENGINES.length - 1
          ? `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`
          : 'none',
        background: hovered ? isDark ? 'rgba(255,255,255,0.038)' : 'rgba(99,102,241,0.035)' : 'transparent',
        transition: 'background 0.2s',
        cursor: 'default', position: 'relative',
      }}
    >
      {/* Left hover accent bar */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: '55%', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute', left: 0, top: '22%', width: 2.5, borderRadius: 2,
              background: item.color, boxShadow: `0 0 8px ${item.color}80`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Icon */}
      <motion.div
        animate={{ scale: hovered ? 1.1 : 1, rotate: hovered ? 5 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: item.tagBg, border: `1px solid ${item.tagBorder}`,
          boxShadow: hovered ? `0 0 18px ${item.color}35` : `0 0 8px ${item.color}15`,
          transition: 'box-shadow 0.2s',
        }}
      >
        <Icon size={16} style={{ color: item.color }} />
      </motion.div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: isDark ? '#f1f5f9' : '#0f172a',
          }}>
            {item.engine}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 900, letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '2px 8px', borderRadius: 100,
            color: item.tagColor, background: item.tagBg,
            border: `1px solid ${item.tagBorder}`,
            boxShadow: hovered ? `0 0 10px ${item.tagGlow}` : `0 0 5px ${item.tagGlow}60`,
            transition: 'box-shadow 0.2s',
          }}>
            {item.tag}
          </span>
          {/* Status indicator */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: s.dot,
              boxShadow: `0 0 6px ${s.glow}`,
              animation: item.status === 'online' ? 'statusPulse 2.5s ease-in-out infinite' : 'none',
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: s.dot }}>{s.text}</span>
          </div>
        </div>
        <p style={{
          fontSize: 11, lineHeight: 1.6,
          color: isDark ? '#475569' : '#94a3b8',
        }}>
          {item.brief}
        </p>
      </div>
    </motion.div>
  );
};

/* ─── ScanPage ──────────────────────────────────────────────────────────────── */
const ScanPage = () => {
  const navigate      = useNavigate();
  const { startScan } = useScan();
  const { isDark }    = useTheme();

  const cardBg    = isDark ? 'rgba(15,20,35,0.92)' : 'rgba(255,255,255,0.97)';
  const borderC   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? '#0b0d14' : '#f0f2f8',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* ── Dot-grid texture ──────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: isDark
          ? 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)'
          : 'radial-gradient(circle, rgba(99,102,241,0.07) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} aria-hidden />

      {/* ── Ambient background orbs ──────────────────────────────────── */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }} aria-hidden>
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.06, 0.1, 0.06] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: -120, right: -100, width: 600, height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,1), transparent 70%)',
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.04, 0.07, 0.04] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          style={{
            position: 'absolute', bottom: 0, left: -150, width: 500, height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,1), transparent 70%)',
          }}
        />
        <div style={{
          position: 'absolute', top: '35%', right: '25%', width: 300, height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.06), transparent 70%)',
        }} />
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '36px 28px', position: 'relative', zIndex: 1 }}>

        {/* ── Back button ──────────────────────────────────────────────── */}
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          whileHover={{ x: -2 }}
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', marginBottom: 32,
            padding: '7px 14px', borderRadius: 10,
            color: isDark ? '#64748b' : '#94a3b8',
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
            border: `1px solid ${borderC}`,
            cursor: 'pointer', backdropFilter: 'blur(12px)',
          }}
        >
          <ChevronLeft size={13} />
          Dashboard
        </motion.button>

        {/* ── Two-column layout ───────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr)',
          gap: 36,
          alignItems: 'start',
        }}>

          {/* ════ LEFT ════════════════════════════════════════════════════ */}
          <div>
            {/* ── Hero Section ─────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              style={{ marginBottom: 36 }}
            >
              {/* Badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 14px', borderRadius: 100, marginBottom: 20,
                background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                border: `1px solid ${isDark ? 'rgba(99,102,241,0.32)' : 'rgba(99,102,241,0.22)'}`,
                boxShadow: isDark ? '0 0 18px rgba(99,102,241,0.18)' : 'none',
              }}>
                <motion.div
                  animate={{ rotate: [0, 8, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                >
                  <Zap size={11} style={{ color: '#6366f1' }} fill="#6366f1" />
                </motion.div>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: isDark ? '#818cf8' : '#6366f1',
                }}>
                  New Security Scan
                </span>
              </div>

              {/* Headline */}
              <h1 style={{
                fontSize: 'clamp(32px, 4vw, 44px)', fontWeight: 900,
                letterSpacing: '-0.03em', lineHeight: 1.1,
                color: isDark ? '#f8fafc' : '#0f172a',
                margin: '0 0 14px',
              }}>
                Find vulnerabilities<br />
                <span style={{
                  backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 45%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  before attackers do.
                </span>
              </h1>

              <p style={{
                fontSize: 13.5, lineHeight: 1.75, maxWidth: 460,
                color: isDark ? '#64748b' : '#64748b',
                margin: '0 0 24px',
              }}>
                Upload a ZIP archive or connect your GitHub account. Four parallel
                scan engines process your code and deliver actionable results in under a minute.
              </p>

              {/* Feature stats as mini cards */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                {[
                  { icon: Layers,     value: 1200, suffix: '+', label: 'detection rules',  color: '#6366f1', delay: 0.12 },
                  { icon: TrendingUp, value: 4,    suffix: '',  label: 'parallel engines', color: '#8b5cf6', delay: 0.19 },
                  { icon: Clock,      value: '<60s',suffix: '',  label: 'avg. scan time',  color: '#10b981', delay: 0.26 },
                ].map(({ icon: SIcon, value, suffix, label, color, delay }) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      flex: 1, minWidth: 112,
                      padding: '14px 16px', borderRadius: 14, position: 'relative', overflow: 'hidden',
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.88)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
                      backdropFilter: 'blur(14px)',
                      boxShadow: isDark ? '0 2px 14px rgba(0,0,0,0.18)' : '0 2px 10px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: -14, right: -14, width: 56, height: 56, borderRadius: '50%',
                      background: `radial-gradient(circle, ${color}28, transparent 70%)`,
                      pointerEvents: 'none',
                    }} />
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, position: 'relative', zIndex: 1 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${color}18`, border: `1px solid ${color}35`,
                      }}>
                        <SIcon size={13} style={{ color }} />
                      </div>
                      <div>
                        <AnimatedNumber value={value} suffix={suffix} color={color} isDark={isDark} />
                        <p style={{ fontSize: 9, fontWeight: 700, marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase', color: isDark ? '#475569' : '#94a3b8' }}>
                          {label}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Engine pipeline strip */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 16px', borderRadius: 14,
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
                  border: `1px solid ${borderC}`,
                  backdropFilter: 'blur(12px)',
                }}
              >
                {ENGINES.map((e, i) => (
                  <React.Fragment key={e.engine}>
                    <motion.div
                      whileHover={{ scale: 1.08, y: -1 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 8,
                        background: e.tagBg, border: `1px solid ${e.tagBorder}`,
                        color: e.tagColor, fontSize: 10, fontWeight: 800,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        boxShadow: `0 0 10px ${e.color}18`,
                        cursor: 'default',
                      }}
                    >
                      <e.icon size={9} />
                      {e.tag}
                    </motion.div>
                    {i < ENGINES.length - 1 && (
                      <div style={{
                        flex: 1, height: 1,
                        background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
                      }} />
                    )}
                  </React.Fragment>
                ))}
              </motion.div>
            </motion.div>

            {/* ── Upload Card ──────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <RepositoryUpload onScanStarted={startScan} />
            </motion.div>
          </div>

          {/* ════ RIGHT ═══════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >

            {/* Engine panel header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12, padding: '0 2px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.08)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)'}`,
                }}>
                  <Activity size={12} style={{ color: isDark ? '#475569' : '#6366f1' }} />
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: isDark ? '#475569' : '#94a3b8',
                }}>
                  Scan Engines
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#10b981',
                  boxShadow: '0 0 7px rgba(16,185,129,0.8)',
                  animation: 'statusPulse 2.5s ease-in-out infinite',
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981' }}>All Systems Online</span>
              </div>
            </div>

            {/* Glass engine card */}
            <div style={{
              borderRadius: 20, overflow: 'hidden', position: 'relative',
              background: cardBg,
              border: `1px solid ${borderC}`,
              backdropFilter: 'blur(24px)',
              boxShadow: isDark
                ? '0 12px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)'
                : '0 8px 40px rgba(99,102,241,0.09), inset 0 1px 0 rgba(255,255,255,1)',
              marginBottom: 12,
            }}>
              {/* Gradient top line */}
              <div style={{
                height: 3,
                background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.7) 20%, rgba(139,92,246,0.85) 45%, rgba(239,68,68,0.6) 72%, rgba(245,158,11,0.5) 88%, transparent)',
              }} />

              {ENGINES.map((item, i) => (
                <EngineRow key={item.engine} item={item} index={i} isDark={isDark} />
              ))}
            </div>

            {/* Trust note */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.65 }}
              style={{
                marginTop: 0, padding: '14px 16px', borderRadius: 16,
                display: 'flex', alignItems: 'flex-start', gap: 12,
                background: isDark ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.05)',
                border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.18)'}`,
                backdropFilter: 'blur(12px)',
                boxShadow: isDark ? '0 2px 12px rgba(16,185,129,0.08)' : 'none',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                marginTop: 1,
              }}>
                <CheckCircle2 size={13} style={{ color: '#10b981' }} />
              </div>
              <p style={{
                fontSize: 11, lineHeight: 1.7, margin: 0,
                color: isDark ? 'rgba(52,211,153,0.8)' : 'rgba(5,150,105,0.9)',
              }}>
                Scans run server-side in an isolated environment.
                ZIP files are archived to S3 after processing.{' '}
                <strong style={{ fontWeight: 800 }}>No source code is stored long-term.</strong>
              </p>
            </motion.div>

            {/* Pro tip */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.75 }}
              style={{
                marginTop: 10, padding: '14px 16px', borderRadius: 16,
                display: 'flex', alignItems: 'flex-start', gap: 12,
                background: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
                border: `1px solid ${isDark ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.18)'}`,
                backdropFilter: 'blur(12px)',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                marginTop: 1,
              }}>
                <Sparkles size={13} style={{ color: isDark ? '#818cf8' : '#6366f1' }} />
              </div>
              <p style={{
                fontSize: 11, lineHeight: 1.7, margin: 0,
                color: isDark ? 'rgba(165,180,252,0.8)' : 'rgba(79,70,229,0.85)',
              }}>
                <strong style={{ fontWeight: 800 }}>Pro tip:</strong>{' '}
                Every finding gets an AI-generated explanation with recommended fixes —
                powered by Amazon Bedrock.
              </p>
            </motion.div>

            {/* Running engines indicator */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.85 }}
              style={{
                marginTop: 10, padding: '14px 16px', borderRadius: 16,
                display: 'flex', alignItems: 'center', gap: 12,
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.88)',
                border: `1px solid ${borderC}`,
                backdropFilter: 'blur(12px)',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.07)',
                border: `1px solid ${borderC}`,
              }}>
                <Cpu size={13} style={{ color: isDark ? '#475569' : '#94a3b8' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: isDark ? '#475569' : '#94a3b8' }}>
                    Engine Capacity
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981' }}>Available</span>
                </div>
                <div style={{
                  height: 5, borderRadius: 5, overflow: 'hidden',
                  background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.2, delay: 1, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      height: '100%', borderRadius: 5,
                      background: 'linear-gradient(90deg, #10b981, #6366f1, #8b5cf6)',
                      boxShadow: '0 0 8px rgba(16,185,129,0.5)',
                    }}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
};

export default ScanPage;
