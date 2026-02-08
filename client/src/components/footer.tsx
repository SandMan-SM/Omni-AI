import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useCallback } from "react";

const footerLinks = [
  { section: "services", label: "Services" },
  { section: "legacy", label: "Legacy Model" },
  { section: "campaigns", label: "Campaigns" },
  { section: "ecosystem", label: "Ecosystem" },
  { section: "testimonials", label: "Results" },
  { section: "contact", label: "Contact" },
];

export function Footer() {
  const [location, setLocation] = useLocation();

  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    if (location === "/") {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      setLocation("/");
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 300);
    }
  }, [location, setLocation]);

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="relative py-12 px-4 border-t border-white/5"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gradient">Omni AI</span>
          </div>

          <nav className="flex flex-wrap items-center gap-8" data-testid="footer-nav">
            {footerLinks.map((link) => (
              <a
                key={link.section}
                href={`/#${link.section}`}
                onClick={(e) => handleNavClick(e, link.section)}
                className="text-gray-500 hover:text-white transition-colors"
                data-testid={`footer-link-${link.label.toLowerCase().replace(" ", "-")}`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <p className="text-gray-600 text-sm" data-testid="text-copyright">
            © {new Date().getFullYear()} Omni Leads LLC. All rights reserved.
          </p>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-gray-600 text-sm italic" data-testid="text-tagline">
            "This is not a tool. This is a transformation."
          </p>
        </div>
      </div>
    </motion.footer>
  );
}
