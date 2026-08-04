"use client";

import { motion } from "framer-motion";

const bannerText =
  "Free Interlinked Premium Membership for a Limited Time Only";

export function PremiumLimitedBanner() {
  return (
    <div
      className="sticky top-0 z-[60] overflow-hidden border-b border-sky-300/25 bg-gradient-to-r from-violet-700 via-indigo-600 to-sky-600 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] sm:text-[10px] sm:tracking-[0.14em]"
      aria-label={bannerText}
    >
      <motion.div
        aria-hidden="true"
        className="flex w-max whitespace-nowrap sm:hidden"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 12, ease: "linear", repeat: Infinity }}
      >
        <span className="pr-12">{bannerText}</span>
        <span className="pr-12">{bannerText}</span>
      </motion.div>
      <div className="hidden px-4 text-center sm:block">{bannerText}</div>
    </div>
  );
}
