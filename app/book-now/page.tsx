"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookDemoModal } from "@/components/book-demo-modal";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function BookNowPage() {
  const [open, setOpen] = useState(true);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
          <Calendar className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-gray-300">Free 30-minute consultation</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Book your session with Omni AI</h1>
        <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
          Pick a time that works for you. We&apos;ll map out how AI can take the heaviest work off your plate.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={() => setOpen(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white px-8 py-6 text-base font-semibold rounded-xl"
          >
            Open Scheduler
          </Button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 text-sm text-gray-300 hover:text-white border border-white/15 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" /> Back home
          </Link>
        </div>
      </div>

      <BookDemoModal isOpen={open} onClose={() => setOpen(false)} />

      <Footer />
    </div>
  );
}
