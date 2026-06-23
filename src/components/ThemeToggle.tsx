import { Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';

interface ThemeToggleProps {
  darkMode: boolean;
  onToggle: () => void;
}

export default function ThemeToggle({ darkMode, onToggle }: ThemeToggleProps) {
  return (
    <button
      id="theme-toggle"
      onClick={onToggle}
      className="relative w-10 h-10 rounded-full border border-zinc-200 dark:border-white/20 hover:bg-zinc-100 dark:hover:bg-white/5 hover:border-[#D4AF37]/50 transition-all focus:outline-none cursor-pointer flex items-center justify-center shrink-0"
      aria-label="Toggle Theme"
    >
      <motion.div
        initial={false}
        animate={{ rotate: darkMode ? 180 : 0, scale: darkMode ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <Sun className="h-5 w-5 text-[#D4AF37]" />
      </motion.div>
      <motion.div
        initial={false}
        animate={{ rotate: darkMode ? 0 : -180, scale: darkMode ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <Moon className="h-5 w-5 text-[#D4AF37]" />
      </motion.div>
    </button>
  );
}

