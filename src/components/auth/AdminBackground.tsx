import { motion } from 'framer-motion';
import { Shield, Lock, Key, Eye, Database, Server, FileCheck } from 'lucide-react';

export function AdminBackground() {
  const nodes = [
    { icon: Lock, label: 'RBAC', position: '-translate-x-28 -translate-y-24' },
    { icon: Database, label: 'Audit', position: 'translate-x-32 -translate-y-28' },
    { icon: Eye, label: 'Monitor', position: 'translate-x-36 translate-y-12' },
    { icon: FileCheck, label: 'Logs', position: '-translate-x-36 translate-y-8' },
    { icon: Server, label: 'System', position: '-translate-x-16 translate-y-32' },
    { icon: Key, label: 'MFA', position: 'translate-x-20 translate-y-36' },
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-black">
      {/* Deep Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-secondary-900/30 via-black to-black dark:opacity-100 opacity-0 transition-opacity duration-500" />
      
      {/* Cyber Grid */}
      <div className="absolute inset-0 opacity-[0.05] dark:opacity-20"
        style={{
          backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          color: 'var(--tw-colors-gray-400)'
        }}
      />

      <div className="relative z-10 w-full max-w-lg aspect-square flex items-center justify-center">
        
        {/* Core Shield Glow */}
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-64 h-64 bg-secondary-600/20 rounded-full blur-[80px]"
        />

        {/* Nodes */}
        {nodes.map((node, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 + 0.5, duration: 0.5, type: 'spring' }}
            className={`absolute ${node.position} flex flex-col items-center gap-2`}
          >
            <motion.div 
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, delay: i * 0.3, repeat: Infinity, ease: "easeInOut" }}
              className="p-3 rounded-lg bg-white/80 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-secondary-500/30 shadow-lg text-secondary-600 dark:text-secondary-400"
            >
              <node.icon className="w-5 h-5" />
            </motion.div>
            <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 uppercase tracking-widest bg-white/80 dark:bg-black/40 px-2 py-0.5 rounded border border-gray-200 dark:border-secondary-500/20">
              {node.label}
            </span>
          </motion.div>
        ))}

        {/* Central Shield Core */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: 'spring' }}
          className="relative z-20 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-secondary-500 blur-2xl opacity-40 animate-pulse-slow" />
          
          {/* Rotating Outer Rings */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-8 rounded-full border border-secondary-500/30 dark:border-secondary-500/20 border-t-secondary-500/80 dark:border-t-secondary-500/60"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-12 rounded-full border border-secondary-500/20 dark:border-secondary-500/10 border-b-secondary-500/60 dark:border-b-secondary-500/40"
          />

          <div className="relative p-8 rounded-3xl bg-gradient-to-b from-secondary-500 to-secondary-700 dark:from-secondary-600 dark:to-secondary-900 shadow-[0_0_50px_rgba(124,58,237,0.4)] border border-white/30 dark:border-secondary-400/30 backdrop-blur-xl">
            <Shield className="w-16 h-16 text-white" />
          </div>
        </motion.div>

        {/* Digital Data Rain (Particles) */}
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={`data-${i}`}
            animate={{
              y: [-100, 100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "linear"
            }}
            className="absolute w-[1px] h-8 bg-gradient-to-b from-transparent via-secondary-500 to-transparent blur-[0.5px]"
            style={{
              left: `${(Math.random() - 0.5) * 300}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
