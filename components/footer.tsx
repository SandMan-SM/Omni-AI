import { motion } from "framer-motion";
import Image from "next/image";

const footerLinks = [
  { href: "/interlinked", label: "Interlinked" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/details", label: "Infographic" },
];

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="relative py-12 px-4 border-t border-white/5"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl md:text-2xl font-bold text-gradient">Omni AI</span>
            <Image src="/omni-logo.svg" alt="Omni AI Logo" width={36} height={36} className="h-7 md:h-9 w-auto" />
          </div>

          <nav className="flex items-center justify-center gap-4 md:gap-8" data-testid="footer-nav">
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

        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-gray-600 text-sm" data-testid="text-copyright">
            © {new Date().getFullYear()} Omni AI LLC
          </p>
        </div>
      </div>
    </motion.footer>
  );
}
