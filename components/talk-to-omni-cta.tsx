import { motion } from "framer-motion";
import { Bot, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TalkToOmniCtaProps {
  onTalkToOmni?: () => void;
}

export function TalkToOmniCta({ onTalkToOmni }: TalkToOmniCtaProps) {
  return (
    <section className="relative px-4 py-10 md:py-14 overflow-hidden" aria-labelledby="talk-to-omni-heading">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 h-64 w-[min(780px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="relative z-10 mx-auto max-w-5xl rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_top_left,_rgba(167,139,250,0.16),transparent_52%),radial-gradient(ellipse_at_bottom_right,_rgba(34,211,238,0.16),transparent_55%),rgba(255,255,255,0.035)] px-6 py-8 text-center shadow-[0_0_70px_-28px_rgba(34,211,238,0.55)] backdrop-blur-sm md:px-10 md:py-10"
      >
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-white/10 bg-white/5">
          <Bot className="h-6 w-6 text-cyan-300" />
        </div>

        <p className="mb-3 inline-flex items-center justify-center gap-2 rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-200">
          <Sparkles className="h-3 w-3" />
          Omni AI concierge
        </p>

        <h2 id="talk-to-omni-heading" className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          Talk to <span className="text-gradient">Omni AI</span>
        </h2>

        <p className="mx-auto mb-6 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">
          Ask what Omni can build, how campaigns work, or where your business is leaking time.
        </p>

        <Button
          size="lg"
          className="rounded-md border-0 bg-gradient-to-r from-purple-600 to-cyan-500 px-7 py-4 text-base font-semibold text-white shadow-[0_0_30px_-10px_rgba(34,211,238,0.9)]"
          onClick={onTalkToOmni}
          data-testid="button-talk-to-omni"
        >
          <MessageCircle className="mr-2 h-5 w-5" />
          Talk to Omni AI
        </Button>
      </motion.div>
    </section>
  );
}
