"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AffiliateSignupModal } from "@/components/modals/lazy";

export default function AffiliateSignUpPage() {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Sign up as an Omni AI Affiliate</h1>
        <p className="text-gray-400 text-lg">Earn 30% recurring on every client you refer. The form is open below.</p>
      </div>
      <AffiliateSignupModal isOpen={open} onClose={() => { setOpen(false); router.push("/affiliate/info"); }} />
      <Footer />
    </div>
  );
}
