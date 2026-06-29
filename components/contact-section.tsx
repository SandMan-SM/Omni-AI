"use client";

import { motion } from "framer-motion";
import { Mail, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function ContactSection() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  // Honeypot — real users never see this field. Bots auto-fill it
  // (most common-name-sniffing spambots fill anything with name="website").
  // Server returns silent 200 on non-empty so the bot moves on.
  const [website, setWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast({
          title: "We couldn't subscribe you",
          description:
            payload?.error ?? "Please check your email and try again.",
          variant: "destructive",
        });
        return;
      }

      if (payload?.reactivated) {
        toast({
          title: "Welcome back!",
          description: "We've reactivated your subscription.",
        });
      } else {
        toast({
          title: "You're subscribed!",
          description: "Get ready for exclusive updates and insights.",
        });
      }
      setEmail("");
    } catch {
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative py-20 px-4 md:px-8" id="contact">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] md:w-[600px] md:h-[300px] lg:w-[800px] lg:h-[400px] rounded-full bg-purple-500/10 blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="max-w-4xl mx-auto relative z-10"
      >
        <div className="glass-card rounded-2xl p-6 sm:p-8 md:p-10 neon-border overflow-hidden">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
                Private List
              </p>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[0.95] tracking-tight">
                <span className="text-gradient">Stay in the Loop</span>
              </h2>
            </div>
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-white/5 shadow-[0_0_30px_rgba(34,211,238,0.16)]">
              <Sparkles className="h-6 w-6 text-cyan-200" />
            </div>
          </div>

          <p className="mb-7 max-w-2xl text-left text-gray-300 text-base sm:text-lg leading-relaxed">
            Subscribe for exclusive updates and insights.
          </p>

          <form onSubmit={handleSubmit} className="max-w-none">
            {/* Honeypot — positioned off-screen instead of type=hidden so
                dumb spambots that skip hidden fields still fill this. Real
                users never see or tab to it (aria-hidden, tabIndex=-1). */}
            <div
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
            >
              <label htmlFor="website-newsletter">Website (leave blank)</label>
              <input
                id="website-newsletter"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="flex items-center h-12 rounded-lg border border-white/10 bg-white/5 overflow-hidden">
              <div className="flex items-center pl-4 flex-1">
                <Mail className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-transparent border-0 text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 text-base sm:text-sm h-10"
                  data-testid="input-email"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white px-5 h-full rounded-l-none font-semibold text-xs whitespace-nowrap"
                data-testid="button-submit-newsletter"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Subscribe"
                )}
              </Button>
            </div>
          </form>
          <p className="text-left text-sm mt-6 bg-gradient-to-r from-sky-300 via-cyan-200 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(56,189,248,0.28)]">
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </motion.div>
    </section>
  );
}
