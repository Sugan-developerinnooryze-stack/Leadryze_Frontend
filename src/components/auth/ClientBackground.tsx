import { motion } from 'framer-motion';
import { Bot, Users, Zap, BarChart2, MessageSquare, Mail, Calendar } from 'lucide-react';

export function ClientBackground() {
  const nodes = [
    { icon: Users, label: 'CRM', position: '-translate-x-32 -translate-y-24' },
    { icon: Zap, label: 'Automation', position: 'translate-x-32 -translate-y-32' },
    { icon: BarChart2, label: 'Analytics', position: 'translate-x-40 translate-y-8' },
    { icon: MessageSquare, label: 'WhatsApp', position: '-translate-x-40 translate-y-4' },
    { icon: Mail, label: 'Email', position: '-translate-x-20 translate-y-32' },
    { icon: Calendar, label: 'Calendar', position: 'translate-x-24 translate-y-32' },
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-brand-50/50 dark:bg-transparent">
      {/* Deep Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-900/40 via-dark-800 to-dark-900 dark:opacity-100 opacity-0 transition-opacity duration-500" />
      
      {/* Animated Glowing Grid */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20 dark:opacity-10" />

      <div className="relative z-10 w-full max-w-lg aspect-square flex items-center justify-center">
        
        {/* Core AI Glow */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-64 h-64 bg-brand-500/30 rounded-full blur-[80px]"
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
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, delay: i * 0.2, repeat: Infinity, ease: "easeInOut" }}
              className="p-3 rounded-xl bg-white/50 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg text-brand-600 dark:text-brand-400"
            >
              <node.icon className="w-5 h-5" />
            </motion.div>
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider bg-white/80 dark:bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm border border-gray-200 dark:border-white/5">
              {node.label}
            </span>
          </motion.div>
        ))}

        {/* Central AI Bot Core */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: 'spring' }}
          className="relative z-20 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-brand-400 blur-xl opacity-40 animate-pulse-slow" />
          <div className="relative p-6 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-[0_0_40px_rgba(37,99,235,0.5)] border border-white/20 backdrop-blur-lg">
            <Bot className="w-12 h-12 text-white" />
          </div>
        </motion.div>

        {/* Animated Particles */}
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={`particle-${i}`}
            animate={{
              y: [0, -100 - Math.random() * 50],
              x: [0, (Math.random() - 0.5) * 100],
              opacity: [0, 0.8, 0],
              scale: [0, 1.5, 0]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "easeOut"
            }}
            className="absolute w-1 h-1 bg-brand-500 rounded-full blur-[1px]"
          />
        ))}
      </div>
    </div>
  );
}
