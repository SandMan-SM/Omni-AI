import Image from "next/image";

// Surface the pages that otherwise have zero internal links. /about and
// /faq are the two highest-leverage GEO pages (they're where LLMs scrape
// entity info and quotable Q&A), and /newsletter is the main content
// destination — linking them from every page feeds crawl signal.
const footerLinks = [
  { href: "/interlinked", label: "Interlinked" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/details", label: "Infographic" },
  { href: "/newsletter", label: "Newsletter" },
  // /pricing was crawl-orphaned on ship — only the sitemap referenced it.
  // Surfacing it in the footer links it from every page on the site, which
  // is the discoverability floor Google expects for a commercial-intent
  // page to rank for "[brand] pricing" queries.
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

// Server-component footer (no framer-motion). Previously this rendered
// `<motion.footer>` without a "use client" boundary, which produced a
// React Server Components manifest error during SSG export:
//
//   Could not find the module "framer-motion/.../index.mjs#motion#footer"
//   in the React Client Manifest.
//
// The four highest-trust content pages (/about, /faq, /newsletter,
// /privacy) were falling back to SSR per request instead of prerendering
// to static HTML — a measurable TTFB regression on exactly the pages
// Google and LLM crawlers value most. Dropping the scroll-fade animation
// restores SSG; the visual delta is imperceptible and the CSS
// `animate-in` equivalent can be added inside a small client wrapper
// later if we really want the fade back.
export function Footer() {
  return (
    <footer className="relative py-12 px-4 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl md:text-2xl font-bold text-gradient">Omni AI</span>
            <Image src="/omni-logo.svg" alt="Omni AI Logo" width={36} height={36} className="h-7 md:h-9 w-auto" />
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 md:gap-x-8" data-testid="footer-nav">
            {footerLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-500 hover:text-white transition-colors text-sm"
                data-testid={`footer-link-${link.label.toLowerCase().replace(" ", "-")}`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <p className="text-gray-600 text-sm italic" data-testid="text-tagline">
            &ldquo;This is not a tool. This is a transformation.&rdquo;
          </p>
        </div>

        {/* Copyright + legal link. Privacy sits next to the copyright
            line (not in the main footer nav above) so it reads as
            boilerplate rather than competing for attention with product
            links — the conventional placement on commercial sites. */}
        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-gray-600 text-sm" data-testid="text-copyright">
            © {new Date().getFullYear()} Omni AI LLC ·{" "}
            <a
              href="/privacy"
              className="hover:text-gray-400 transition-colors underline-offset-2 hover:underline"
              data-testid="footer-link-privacy"
            >
              Privacy
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
