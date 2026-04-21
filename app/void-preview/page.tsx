"use client";

import { VoidHero } from "@/components/void-hero";

export default function VoidPreviewPage() {
  return (
    <VoidHero
      eyebrow="OMNI AI"
      title="Intelligence, in the dark."
      subtitle="A high-contrast interactive hero inspired by your black visual. Smooth motion, subtle depth, and responsive behavior."
      primaryCta={{ label: "Get Started", onClick: () => alert("Get Started") }}
      secondaryCta={{ label: "View Demo", onClick: () => alert("View Demo") }}
      particleDensity={120}
    />
  );
}
