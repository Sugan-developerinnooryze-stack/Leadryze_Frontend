import type React from 'react';
import type { FC, SVGProps } from 'react';
import { motion } from 'framer-motion';
import { UserRoundPlus, Zap, TrendingUp } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

type HeroIcon = FC<SVGProps<SVGSVGElement>>;

const EASE = [0.22, 1, 0.36, 1] as const;

const BRAND_SIZES = {
  lg: { icon: 'w-14 h-14 rounded-[16px]', word: 'text-[1.85rem]', tag: 'text-[11px] mt-1.5 tracking-[0.16em]', gap: 'gap-3.5' },
  md: { icon: 'w-11 h-11 rounded-[13px]', word: 'text-[1.5rem]',  tag: 'text-[10px] mt-1 tracking-[0.14em]',  gap: 'gap-3' },
  sm: { icon: 'w-10 h-10 rounded-xl',     word: 'text-xl',        tag: 'text-[9px] mt-0.5 tracking-[0.12em]', gap: 'gap-2.5' },
} as const;

/** The brand wordmark — `lg` for this file's own hero header, `md` for
 * every auth card's centered top logo (Login/AdminLogin/ForcedChangePassword
 * — also the only one visible once the hero pane hides below `lg`), `sm`
 * held in reserve for any future tighter context. Always in the display
 * face reserved for this page (see tailwind.config.ts) so it reads as a
 * real headline element, not body-sized UI text. */
export function Brand({ size = 'lg' }: { size?: keyof typeof BRAND_SIZES }) {
  const s = BRAND_SIZES[size];
  return (
    <div className={`flex items-center ${s.gap}`}>
      <div className={`${s.icon} overflow-hidden shrink-0 shadow-[0_8px_20px_rgba(0,158,181,0.22)]`}>
        <img src="/logo.png" alt="LeadRyze AI" className="w-full h-full object-contain" />
      </div>
      <div>
        <h1 className={`font-display ${s.word} font-extrabold tracking-[-0.02em] leading-none`}>
          <span className="text-text-primary">Lead</span>
          <span className="text-ryze-600 dark:text-ryze-400">Ryze</span>
          <span className="text-ryze-500"> AI</span>
        </h1>
        <p className={`${s.tag} font-semibold text-text-muted uppercase leading-none`}>
          Smart CRM. Smarter Conversations.
        </p>
      </div>
    </div>
  );
}

function LanguagePill() {
  return (
    <div className="flex items-center gap-1.5 h-10 px-3.5 rounded-full bg-surface/70 border border-border text-[12px] font-medium text-text-muted select-none">
      <span aria-hidden>🌐</span> English
    </div>
  );
}

/** Per-character entrance — each letter springs in from scale:0/opacity:0
 * up to its natural size, staggered left to right (the requested Framer
 * Motion "scale-in text" pattern). A one-shot mount animation, not a loop.
 * `startIndex` lets multiple SplitText calls on the same line continue one
 * shared stagger sequence instead of each restarting its own count at 0.
 * Skipped entirely under prefers-reduced-motion — plain static spans. */
function SplitText({
  text, startIndex = 0, className, reducedMotion,
}: { text: string; startIndex?: number; className?: string; reducedMotion: boolean }) {
  return (
    <>
      {text.split('').map((ch, i) => (
        reducedMotion ? (
          <span key={i} className={`inline-block ${className ?? ''}`}>
          {ch === ' ' ? ' ' : ch}
          </span>
        ) : (
          <motion.span
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: (startIndex + i) * 0.035, type: 'spring', stiffness: 150, damping: 12 }}
            className={`inline-block ${className ?? ''}`}
          >
            {ch === ' ' ? ' ' : ch}
          </motion.span>
        )
      ))}
    </>
  );
}

function PlatformBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 w-fit px-3 py-1 rounded-full bg-ryze-50 dark:bg-ryze-500/10 border border-ryze-200 dark:border-ryze-500/25 text-ryze-700 dark:text-ryze-400 text-[11px] font-bold uppercase tracking-[0.03em]">
      <span className="w-1.5 h-1.5 rounded-full bg-ryze-500" />
      All-in-One CRM &amp; Automation Platform
    </div>
  );
}

interface FeatureHighlight { icon: HeroIcon; title: string; desc: string }
const FEATURES: FeatureHighlight[] = [
  { icon: UserRoundPlus, title: 'More Leads',    desc: 'Capture and manage\nfrom every channel' },
  { icon: Zap,           title: 'Save Time',     desc: 'Automate repetitive\ntasks with AI' },
  { icon: TrendingUp,    title: 'Grow Revenue',  desc: 'Turn opportunities\ninto loyal customers' },
];

function FeatureHighlights() {
  return (
    <div className="flex items-start divide-x divide-border">
      {FEATURES.map(({ icon: Icon, title, desc }, i) => (
        <div key={title} className={`flex items-start gap-2.5 flex-1 min-w-0 ${i === 0 ? 'pr-4' : 'px-4'}`}>
          <div className="w-11 h-11 rounded-[14px] bg-ryze-50 dark:bg-ryze-500/10 flex items-center justify-center shrink-0 shadow-[0_8px_20px_rgba(0,158,181,0.08)]">
            <Icon className="w-[18px] h-[18px] text-ryze-600 dark:text-ryze-400" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-text-primary leading-tight">{title}</p>
            <p className="text-[11px] text-text-muted leading-snug mt-0.5 whitespace-pre-line">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="min-h-screen bg-background bg-[url('/auth-bg.png')] bg-cover bg-center bg-no-repeat dark:bg-none flex overflow-x-hidden">
      {/* Atmospheric teal glow — dark mode only. Light mode gets its
         atmosphere from the real background photo above instead; layering
         this glow on top of it there just muddied the image. */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none hidden dark:block"
        style={{ background: 'radial-gradient(circle at 72% 42%, rgba(0,158,181,0.10), transparent 55%)' }}
      />

      {/* ── Left hero pane — hidden below lg, matches the reference's 56/44 split ── */}
      <div className="hidden lg:flex lg:w-[56%] flex-col relative z-10 px-10 xl:px-14 py-9 gap-7 overflow-y-auto">
        <motion.header
          initial={reducedMotion ? undefined : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="shrink-0"
        >
          <Brand />
        </motion.header>

        <div className="shrink-0">
          <motion.div
            initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: EASE }}
          >
            <PlatformBadge />
          </motion.div>

          {/* Headline + handwritten tagline sit in the same flex row so the
             tagline naturally lands in the open space beside the headline
             on wide viewports, and drops below it on narrower ones — a
             flex-wrap layout instead of guessing at absolute-position
             coordinates that would only hold at one exact viewport width. */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <h2
              className="font-display text-[clamp(2.8rem,4.6vw,4.7rem)] font-extrabold leading-[1.01] tracking-[-0.03em] text-text-primary shrink-0"
              style={{ textWrap: 'balance' } as React.CSSProperties}
            >
              <SplitText text="Grow Faster" reducedMotion={reducedMotion} />
              <br />
              <SplitText text="with " startIndex={11} reducedMotion={reducedMotion} />
              <span className="relative inline-block">
                <SplitText
                  text="LeadRyze AI" startIndex={16} reducedMotion={reducedMotion}
                  className="bg-clip-text text-transparent bg-gradient-to-r from-ryze-700 via-ryze-500 to-ryze-400"
                />
                <svg
                  className="absolute left-0 -bottom-2 w-full h-3 text-ryze-400/70"
                  viewBox="0 0 320 12" preserveAspectRatio="none" fill="none" aria-hidden
                >
                  <path d="M2 8.5C60 2 140 2 160 6C180 10 260 10 318 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </h2>

            {/* Handwritten accent callout — the original headline copy,
               demoted to a small tagline beside the new one. */}
            <motion.div
              initial={reducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.45, ease: EASE }}
              className="hidden md:flex items-center gap-2 -rotate-2 md:ml-6"
            >
              <svg className="w-7 h-6 text-ryze-400 shrink-0 -scale-x-100" viewBox="0 0 40 32" fill="none" aria-hidden>
                <path d="M35 4C28 4 14 10 8 22M8 22L14 18M8 22L11 28" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="font-script text-[26px] leading-none text-ryze-500">
                Turn Conversations<br />into Business Growth
              </p>
            </motion.div>
          </div>

          <motion.p
            initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease: EASE }}
            className="mt-4 text-[16px] leading-[1.55] text-text-muted max-w-[560px]"
          >
            Manage customers, automate workflows, connect every CRM, and build intelligent business automation using AI.
          </motion.p>
        </div>

        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28, ease: EASE }}
          className="shrink-0"
        >
          <FeatureHighlights />
        </motion.div>

        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.36, ease: EASE }}
          className="flex-1 flex items-center justify-center min-h-0 py-4"
        >
          <img
            src="/dashboard-preview.png"
            alt="LeadRyze AI dashboard preview with AI Chatbot, WhatsApp, Automation, and Integrations"
            className="w-full max-w-[920px] h-auto select-none pointer-events-none"
            draggable={false}
          />
        </motion.div>
      </div>

      {/* ── Right authentication pane ── */}
      <div className="w-full lg:w-[44%] flex flex-col items-center justify-center relative z-10 px-6 py-10 min-h-screen">
        <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
          <LanguagePill />
          <ThemeToggle />
        </div>

        {/* No separate mobile-only brand mark here — every card (Login/
           AdminLogin/ForcedChangePassword) now renders its own Brand at the
           top, which is the only one visible once the hero pane hides below
           lg, and just doubles up with it on desktop otherwise. */}
        {children}
      </div>
    </div>
  );
}
