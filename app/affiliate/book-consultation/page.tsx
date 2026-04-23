"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Breadcrumb } from "@/components/breadcrumb";
import { AffiliateConsultationModal } from "@/components/modals/lazy";

export default function AffiliateBookConsultationPage() {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      {/* Visible breadcrumb — paired with the breadcrumbSchema in
          app/affiliate/book-consultation/layout.tsx. Google only awards
          the SERP breadcrumb chip when schema + visible UI agree. */}
      <div className="flex justify-center pt-10 pb-0 px-4">
        <Breadcrumb
          items={[
            { name: "Home", href: "/" },
            { name: "Affiliate Program", href: "/affiliate/info" },
            { name: "Book Consultation", href: "/affiliate/book-consultation" },
          ]}
          className="text-xs"
        />
      </div>
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Book your affiliate consultation</h1>
        <p className="text-gray-400 text-lg">
          A 30-minute working session to map out how you&apos;ll earn with the Omni AI affiliate program.
        </p>
      </div>
      <AffiliateConsultationModal isOpen={open} onClose={() => { setOpen(false); router.push("/affiliate/info"); }} />
      <Footer />
    </div>
  );
}
