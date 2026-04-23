"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AffiliateSignupModal({ isOpen, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [audience, setAudience] = useState("");
  // Honeypot — server silent-200s when this field has any value.
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  const valid = name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && phone.trim();

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliate/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, audience, website }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        // Surface the server's error message when available — rate
        // limiter and validator both return a JSON `error` string.
        // Previously a "Please enter a valid email address" signal
        // was masked as the generic "Something went wrong".
        const payload = await res.json().catch(() => ({} as { error?: string }));
        toast({
          title: "We couldn't sign you up",
          description: payload?.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            {done ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <Check className="w-7 h-7 text-green-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">You&apos;re in.</h3>
                <p className="text-gray-400 text-sm">We&apos;ll email your affiliate dashboard access shortly.</p>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold mb-1">Join the Affiliate Program</h3>
                <p className="text-gray-400 text-sm mb-6">Earn 30% recurring on every Omni AI client you refer.</p>
                <div className="space-y-3">
                  {/* Honeypot — off-screen, aria-hidden, non-tabbable. */}
                  <div
                    aria-hidden="true"
                    style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
                  >
                    <label htmlFor="website-affiliate-signup">Website (leave blank)</label>
                    <input
                      type="text"
                      id="website-affiliate-signup"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                  <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                  <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <Input placeholder="Your audience / channel (optional)" value={audience} onChange={(e) => setAudience(e.target.value)} />
                  <Button onClick={submit} disabled={!valid || submitting} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold h-11">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create my affiliate account"}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
