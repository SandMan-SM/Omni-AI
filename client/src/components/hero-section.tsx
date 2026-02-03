import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Clock, Eye, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const metrics = [
  { icon: Clock, value: "24/7", label: "Execution" },
  { icon: Eye, value: "20M+", label: "Impressions" },
  { icon: TrendingUp, value: "11x", label: "ROI" },
];

interface HeroSectionProps {
  onBookDemo?: () => void;
  onSignIn?: () => void;
}

export function HeroSection({ onBookDemo, onSignIn }: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-24 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center max-w-5xl mx-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-3 md:px-4 py-2 mb-6 md:mb-8 rounded-full glass-card neon-border"
        >
          <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-purple-400 flex-shrink-0" />
          <span className="text-xs md:text-sm text-gray-300 whitespace-nowrap">
            Introducing the world's first AGI Legacy Model
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight mb-6"
        >
          <span className="text-gradient">Omni AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          Autonomous AGI systems that generate leads, run operations, and scale
          businesses without human micromanagement.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white px-8 py-6 text-lg rounded-md neon-glow"
            onClick={onSignIn}
            data-testid="button-start-free"
          >
            Sign In
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/20 bg-white/5 backdrop-blur-sm text-white px-8 py-6 text-lg rounded-md"
            onClick={onBookDemo}
            data-testid="button-book-demo"
          >
            Book a Demo
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="flex flex-wrap items-center justify-center gap-8 md:gap-16 mt-16 mb-20"
        >
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 1 + index * 0.1 }}
              className="flex flex-col items-center gap-2"
              data-testid={`metric-${metric.label.toLowerCase()}`}
            >
              <div className="flex items-center gap-2">
                <metric.icon className="w-5 h-5 text-purple-400" />
                <span className="text-2xl md:text-3xl font-bold text-gradient">
                  {metric.value}
                </span>
              </div>
              <span className="text-sm text-gray-500 uppercase tracking-wider">
                {metric.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.3 }}
        className="absolute bottom-4 left-0 right-0 flex justify-center"
        data-testid="scroll-indicator"
      >
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <span className="text-sm" data-testid="text-scroll-hint">Scroll to explore</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-gray-600 flex items-start justify-center p-2"
          >
            <div className="w-1.5 h-3 rounded-full bg-gray-500" />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
