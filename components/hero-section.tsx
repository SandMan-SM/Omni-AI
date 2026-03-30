import { motion } from "framer-motion";
import { Sparkles, Clock, Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

const metrics = [
  { icon: Clock, value: "24/7", label: "Execution" },
  { icon: Users, value: "500k+", label: "Subscribers" },
  { icon: Eye, value: "20M+", label: "Impressions" },
];

const partners = [
  { name: "Nvidia", logo: "/logos/nvidia.svg" },
  { name: "Meta", logo: "/logos/meta.svg" },
  { name: "Anthropic", logo: "/logos/anthropic.svg" },
  { name: "OpenAI", logo: "/logos/openai.svg" },
];

interface HeroSectionProps {
  onBookDemo?: () => void;
  onSignIn?: () => void;
}

export function HeroSection({ onBookDemo, onSignIn }: HeroSectionProps) {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <section className="relative min-h-[100svh] px-5 overflow-hidden" style={{ paddingTop: 'clamp(120px, 20vh, 200px)' }}>
      {/* Background blurs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[250px] h-[250px] md:w-[400px] md:h-[400px] lg:w-[500px] lg:h-[500px] rounded-full bg-purple-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[200px] h-[200px] md:w-[300px] md:h-[300px] lg:w-[400px] lg:h-[400px] rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[400px] md:h-[400px] lg:w-[600px] lg:h-[600px] rounded-full bg-cyan-500/5 blur-[150px]" />
      </div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center max-w-5xl mx-auto flex flex-col items-center"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 md:mb-8 rounded-full glass-card neon-border whitespace-nowrap"
        >
          <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5 text-purple-400 flex-shrink-0" />
          <span className="text-[10px] sm:text-[11px] md:text-xs text-gray-300 tracking-wide">
            Introducing the world&apos;s first AGI Legacy Model
          </span>
        </motion.div>

        {/* Title — much bigger than body text */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold tracking-tight mb-5 md:mb-6 whitespace-nowrap"
        >
          <span className="text-gradient">Welcome to AGI</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-sm sm:text-lg md:text-xl text-gray-400 max-w-lg md:max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed"
        >
          Autonomous AGI systems that generate leads, run operations, and scale
          businesses without human micromanagement.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="flex flex-row items-center justify-center gap-3 sm:gap-4"
        >
          <Button
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white px-10 h-12 sm:h-11 text-[15px] font-medium rounded-xl neon-glow active:scale-[0.98] transition-transform"
            onClick={() => router.push("/interlinked")}
            data-testid="button-interlinked"
          >
            Interlinked
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/15 bg-white/[0.03] backdrop-blur-sm text-white px-10 h-12 sm:h-11 text-[15px] font-medium rounded-xl active:scale-[0.98] transition-transform"
            onClick={() => {
              if (user) {
                router.push("/dashboard");
              } else {
                onSignIn?.();
              }
            }}
            data-testid="button-sign-in"
          >
            Sign In
          </Button>
        </motion.div>

        {/* Metrics — decent gap below buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="grid grid-cols-3 gap-4 sm:gap-14 md:gap-20 w-full max-w-sm sm:max-w-xl md:max-w-2xl px-2"
          style={{ marginTop: '60px' }}
        >
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 1 + index * 0.1 }}
              className="flex flex-col items-center text-center gap-2"
              data-testid={`metric-${metric.label.toLowerCase()}`}
            >
              <metric.icon className="w-5 h-5 text-purple-400" />
              <span className="text-2xl md:text-3xl font-bold text-gradient">
                {metric.value}
              </span>
              <span className="text-[11px] sm:text-xs text-gray-500 tracking-wide">
                {metric.label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Partnered with */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.3 }}
          className="flex flex-col items-center gap-4 pt-16 pb-10"
        >
          <span className="text-sm sm:text-base text-white/80 tracking-wider">
            Partnered with platforms like
          </span>
          <div className="flex flex-wrap items-center justify-center gap-10 sm:gap-14">
            {partners.map((partner) => (
              <img
                key={partner.name}
                src={partner.logo}
                alt={partner.name}
                className="h-10 sm:h-12 md:h-14 opacity-70 hover:opacity-100 transition-opacity"
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
