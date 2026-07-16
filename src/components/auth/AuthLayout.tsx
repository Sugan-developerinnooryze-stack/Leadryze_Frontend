import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquareIcon,
  UsersIcon,
  ZapIcon,
  CalendarIcon,
  MailIcon,
  DatabaseIcon,
} from 'lucide-react';

// ── Canvas Particle Network ──────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const N = 72;
    interface Particle { x: number; y: number; vx: number; vy: number; r: number }
    const particles: Particle[] = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.4 + 0.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }

      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(30,111,255,${(1 - dist / 130) * 0.14})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,200,232,0.35)';
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
}

// ── Orbital Module Card ──────────────────────────────────────────────────────
const CX = 150;
const CY = 150;

const OrbitalCard = ({
  label,
  angle,
  radius = 118,
  delay,
}: {
  label: string;
  angle: number;
  radius?: number;
  delay: number;
}) => {
  const rad = angle * (Math.PI / 180);
  const x = CX + Math.cos(rad) * radius;
  const y = CY + Math.sin(rad) * radius;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay, type: 'spring', stiffness: 60 }}
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a1226]/88 backdrop-blur-xl border border-[rgba(30,111,255,0.2)] text-[10px] font-bold tracking-widest text-[rgba(180,210,255,0.75)] uppercase cursor-default transition-all hover:border-[rgba(0,200,232,0.45)] hover:text-[#00C8E8] whitespace-nowrap"
        style={{ backdropFilter: 'blur(12px)' }}>
        <span className="w-[5px] h-[5px] rounded-full bg-[#1E6FFF] shadow-[0_0_5px_#1E6FFF] animate-pulse flex-shrink-0" />
        {label}
      </div>
    </motion.div>
  );
};

// ── Feature Card ─────────────────────────────────────────────────────────────
const FeatureCard = ({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) => (
  <motion.div
    whileHover={{ x: 3, borderColor: 'rgba(0,200,232,0.28)', backgroundColor: 'rgba(30,111,255,0.07)' }}
    className="flex items-center gap-3 px-3 py-[0.55rem] rounded-[11px] border border-[rgba(30,111,255,0.09)] bg-[rgba(9,16,32,0.55)] backdrop-blur-sm cursor-default transition-all"
  >
    <div className="w-[30px] h-[30px] flex-shrink-0 rounded-lg bg-[linear-gradient(135deg,rgba(30,111,255,0.18),rgba(0,200,232,0.08))] border border-[rgba(30,111,255,0.18)] flex items-center justify-center text-brand-400">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <div className="text-[0.73rem] font-bold text-white leading-tight">{title}</div>
      <div className="text-[0.6rem] text-[#4E6A96] truncate">{desc}</div>
    </div>
  </motion.div>
);

// ── Stat Column ───────────────────────────────────────────────────────────────
const StatCol = ({ value, label }: { value: string; label: string }) => (
  <div className="bg-[rgba(9,16,32,0.55)] border border-[rgba(30,111,255,0.09)] rounded-[10px] px-2 py-[0.65rem] text-center backdrop-blur-sm hover:border-[rgba(0,200,232,0.22)] transition-colors">
    <div className="text-[1.15rem] font-black tracking-[-0.03em] bg-gradient-to-r from-white to-[#00C8E8] bg-clip-text text-transparent leading-tight">
      {value}
    </div>
    <div className="text-[0.58rem] font-semibold text-[#4E6A96] uppercase tracking-[0.06em] mt-0.5">
      {label}
    </div>
  </div>
);

// ── Main Layout ───────────────────────────────────────────────────────────────
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060B1A] flex overflow-hidden selection:bg-brand-500/30 font-sans">
      {/* Particle canvas background */}
      <ParticleCanvas />

      {/* Ambient gradient blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_50%,rgba(30,111,255,0.1)_0%,transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_80%,rgba(107,63,232,0.07)_0%,transparent_45%)]" />
      </div>

      {/* ── Left Pane 60% ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[60%] flex-col relative z-10 p-8 gap-4 border-r border-[rgba(30,111,255,0.1)]">

        {/* Left edge right-border glow */}
        <div className="absolute right-0 top-[15%] bottom-[15%] w-px bg-gradient-to-b from-transparent via-[rgba(30,111,255,0.2)] to-transparent pointer-events-none" />

        {/* Top bar */}
        <div className="flex items-center justify-between flex-shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-[0_0_22px_rgba(30,111,255,0.5),0_0_44px_rgba(0,200,232,0.18)]">
              <img src="/logo.png" alt="LeadRyze" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-[0.95rem] font-extrabold tracking-[-0.02em] text-white">
                Lead<em className="not-italic text-[#00C8E8]">Ryze</em> AI
              </h1>
              <p className="text-[0.6rem] font-medium text-[#4E6A96] uppercase tracking-[0.04em] mt-0.5">
                Smart CRM. Smarter Conversations.
              </p>
            </div>
          </div>

          {/* Security badge */}
          <div className="flex items-center gap-2 px-4 py-[0.32rem] rounded-full border border-[rgba(0,200,232,0.25)] bg-[rgba(0,200,232,0.05)] text-[#00C8E8] text-[0.65rem] font-bold uppercase tracking-[0.06em] backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C8E8] shadow-[0_0_6px_#00C8E8] animate-pulse" />
            Enterprise Grade Security
          </div>
        </div>

        {/* Hero text */}
        <div className="flex-shrink-0">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[clamp(1.55rem,2.1vw,2.4rem)] font-black leading-[1.12] tracking-[-0.04em] text-white"
            style={{ textWrap: 'balance' } as React.CSSProperties}
          >
            Power Your Business<br />
            <span className="bg-[linear-gradient(100deg,#1E6FFF_0%,#00C8E8_45%,#6B3FE8_100%)] bg-[length:200%_auto] bg-clip-text text-transparent animate-[gshift_5s_ease-in-out_infinite]">
              with AI &amp; Automation
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-2 text-[0.78rem] text-[#4E6A96] leading-[1.7] max-w-sm"
          >
            Manage customers, automate workflows, connect every CRM, and build intelligent business automation using AI.
          </motion.p>
        </div>

        {/* Main row: orbital + features */}
        <div className="flex items-center gap-6 flex-1 min-h-0">

          {/* Orbital Core */}
          <div className="relative flex-shrink-0" style={{ width: 300, height: 300 }}>
            {/* SVG connection lines to module cards */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 300 300">
              {[
                { angle: -90 },
                { angle: -30 },
                { angle: 30 },
                { angle: 90 },
                { angle: 150 },
                { angle: 210 },
              ].map(({ angle }, i) => {
                const rad = angle * (Math.PI / 180);
                const r = 118;
                const x2 = CX + Math.cos(rad) * r;
                const y2 = CY + Math.sin(rad) * r;
                return (
                  <line
                    key={i}
                    x1={CX} y1={CY} x2={x2} y2={y2}
                    stroke="rgba(30,111,255,0.12)" strokeWidth="1"
                  />
                );
              })}
            </svg>

            {/* Spinning rings — centered at 50%/50% + translate in rspin keyframe */}
            <div className="absolute inset-0">
              <div className="absolute rounded-full border border-[rgba(30,111,255,0.08)]"
                style={{ width: 290, height: 290, top: '50%', left: '50%', animation: 'rspin 50s linear infinite' }} />
              <div className="absolute rounded-full border border-[rgba(0,200,232,0.11)]"
                style={{ width: 220, height: 220, top: '50%', left: '50%', animation: 'rspin 28s linear infinite reverse' }} />
              <div className="absolute rounded-full border border-[rgba(30,111,255,0.15)]"
                style={{ width: 148, height: 148, top: '50%', left: '50%', animation: 'rspin 18s linear infinite' }} />
            </div>

            {/* Central hex core — centered absolutely */}
            <motion.div
              animate={{
                filter: [
                  'drop-shadow(0 0 12px rgba(30,111,255,0.5)) drop-shadow(0 0 28px rgba(0,200,232,0.15))',
                  'drop-shadow(0 0 22px rgba(30,111,255,0.7)) drop-shadow(0 0 50px rgba(0,200,232,0.25))',
                  'drop-shadow(0 0 12px rgba(30,111,255,0.5)) drop-shadow(0 0 28px rgba(0,200,232,0.15))',
                ],
              }}
              transition={{ duration: 3.5, repeat: Infinity }}
              className="absolute z-20 w-[84px] h-[84px] flex items-center justify-center"
              style={{
                top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                clipPath: 'polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',
                background: 'linear-gradient(135deg,rgba(30,111,255,0.25),rgba(0,200,232,0.15))',
              }}
            >
              {/* Inner fill */}
              <div className="absolute inset-1 flex items-center justify-center"
                style={{
                  clipPath: 'polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',
                  background: 'linear-gradient(135deg,#0D1A36,#0C1529)',
                }}
              >
                <img src="/logo.png" alt="iR" className="w-10 h-10 object-contain" />
              </div>
            </motion.div>

            {/* Module satellite labels */}
            <OrbitalCard label="CRM" angle={-90} delay={0.2} />
            <OrbitalCard label="AI Chatbot" angle={-30} delay={0.3} />
            <OrbitalCard label="Automation" angle={30} delay={0.4} />
            <OrbitalCard label="WhatsApp" angle={90} delay={0.5} />
            <OrbitalCard label="Databases" angle={150} delay={0.6} />
            <OrbitalCard label="Calendar" angle={210} delay={0.7} />
          </div>

          {/* Feature Cards */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <FeatureCard icon={MessageSquareIcon} title="AI Chatbot" desc="24/7 intelligent customer conversations" />
            <FeatureCard icon={UsersIcon} title="CRM Pipeline" desc="Manage leads and customers" />
            <FeatureCard icon={ZapIcon} title="Workflow Automation" desc="Automate repetitive work" />
            <FeatureCard icon={CalendarIcon} title="Calendar & Meetings" desc="AI-powered scheduling" />
            <FeatureCard icon={MailIcon} title="Email & WhatsApp" desc="Multi-channel communication" />
            <FeatureCard icon={DatabaseIcon} title="50+ Integrations" desc="Connect your entire stack" />
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-2 flex-shrink-0">
          <StatCol value="10K+" label="Businesses" />
          <StatCol value="1M+" label="AI Conversations" />
          <StatCol value="99.99%" label="Uptime" />
          <StatCol value="50+" label="Integrations" />
        </div>

      </div>

      {/* ── Right Pane 40% ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-[40%] flex flex-col items-center justify-center p-8 relative z-10">
        {children}
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes rspin {
          from { transform: translate(-50%,-50%) rotate(0deg); }
          to   { transform: translate(-50%,-50%) rotate(360deg); }
        }
        @keyframes gshift {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}
