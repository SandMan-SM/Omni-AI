"use client";

import { motion } from "framer-motion";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function ContactSection() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const subtitleRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [titleSize, setTitleSize] = useState(24);

  useEffect(() => {
    const fit = () => {
      const s = subtitleRef.current;
      const m = measureRef.current;
      if (!s || !m) return;
      const target = s.getBoundingClientRect().width;
      const natural = m.getBoundingClientRect().width;
      if (natural <= 0 || target <= 0) return;
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const scale = isMobile ? 0.78 : 1;
      setTitleSize(Math.max(16, Math.min((target / natural) * 100 * scale, 80)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (subtitleRef.current) ro.observe(subtitleRef.current);
    window.addEventListener("resize", fit);
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(fit).catch(() => {});
    }
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
    <section className="relative py-24 px-4 md:px-8" id="contact">
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
        <div className="glass-card rounded-2xl p-6 sm:p-10 md:p-12 neon-border">
          <div className="text-center mb-6 sm:mb-8 overflow-hidden">
            <span
              ref={measureRef}
              aria-hidden
              className="absolute -z-50 opacity-0 pointer-events-none font-bold whitespace-nowrap"
              style={{ fontSize: "100px", left: "-9999px", top: "-9999px" }}
            >
              Stay in the Loop
            </span>
            <h2
              className="font-bold mb-3 sm:mb-4 whitespace-nowrap leading-[1.1] inline-block"
              style={{ fontSize: `${titleSize}px` }}
            >
              <span className="text-gradient">Stay in the Loop</span>
            </h2>
            <p className="text-gray-400 text-sm sm:text-base md:text-lg whitespace-nowrap">
              <span ref={subtitleRef} className="inline-block">
                Subscribe for exclusive updates and insights.
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="max-w-lg mx-auto">
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
          <p className="text-center text-gray-500 text-sm mt-6">
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </motion.div>
    </section>
  );
}
