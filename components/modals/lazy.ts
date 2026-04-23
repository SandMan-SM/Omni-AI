"use client";

// Lazy-loaded modal wrappers. Every modal here is closed-by-default and
// only renders content on user action, so shipping its full body in the
// parent page's initial JS bundle is pure waste. Importing from this
// file instead of the modal's source file keeps the API identical at
// every call site but defers the download until the modal first mounts.
//
// ssr:false is deliberate — modals are interaction-only. Removing SSR
// also skips the hydration payload and gets the lazy chunk split cleanly.
//
// Every wrapper infers its props from the import promise so TS catches
// prop mismatches at every call site just like the direct import did.

import dynamic from "next/dynamic";

export const BookDemoModal = dynamic(
  () =>
    import("@/components/book-demo-modal").then((m) => ({
      default: m.BookDemoModal,
    })),
  { ssr: false },
);

export const WebinarRegistrationModal = dynamic(
  () =>
    import("@/components/webinar-registration-modal").then((m) => ({
      default: m.WebinarRegistrationModal,
    })),
  { ssr: false },
);

export const AuthModal = dynamic(
  () =>
    import("@/components/auth-modal").then((m) => ({
      default: m.AuthModal,
    })),
  { ssr: false },
);

export const AffiliateSignupModal = dynamic(
  () =>
    import("@/components/affiliate/affiliate-signup-modal").then((m) => ({
      default: m.AffiliateSignupModal,
    })),
  { ssr: false },
);

export const AffiliateConsultationModal = dynamic(
  () =>
    import("@/components/affiliate/affiliate-consultation-modal").then((m) => ({
      default: m.AffiliateConsultationModal,
    })),
  { ssr: false },
);
