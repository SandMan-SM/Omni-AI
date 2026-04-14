"use client";

import { useState } from "react";
import LeadForm from "./LeadForm";

interface CTAButtonsProps {
  slug: string;
}

export default function CTAButtons({ slug }: CTAButtonsProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md sm:w-auto mx-auto">
        <button
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto whitespace-nowrap rounded-xl px-6 py-4 text-base font-bold text-white transition-all duration-200 hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, #6366f1, #ec4899)",
            boxShadow: "0 0 32px rgba(99,102,241,0.4)",
          }}
        >
          See How Omni AI Does It →
        </button>
        <a
          href="/details"
          className="w-full sm:w-auto whitespace-nowrap rounded-xl px-8 py-4 text-base font-semibold text-gray-300 text-center transition-all duration-200 hover:text-white hover:bg-white/10 border border-white/60 bg-white/[0.04]"
        >
          Learn More
        </a>
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl p-8 border border-white/10"
            style={{ background: "#0d0d14" }}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            <h3
              className="text-2xl font-black mb-2"
              style={{ background: "linear-gradient(135deg, #c4b5fd, #f0abfc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              Let&apos;s Talk
            </h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Drop your info and we&apos;ll reach out to show you exactly how Omni AI can work for your business.
            </p>

            <LeadForm slug={slug} />
          </div>
        </div>
      )}
    </>
  );
}
