import { motion } from "framer-motion";

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
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gradient">Omni AI</span>
          </div>

          <nav className="flex flex-wrap items-center gap-8" data-testid="footer-nav">
            <a
              href="#services"
              className="text-gray-500 hover:text-white transition-colors"
              data-testid="footer-link-services"
            >
              Services
            </a>
            <a
              href="#legacy"
              className="text-gray-500 hover:text-white transition-colors"
              data-testid="footer-link-legacy"
            >
              Legacy Model
            </a>
            <a
              href="#ecosystem"
              className="text-gray-500 hover:text-white transition-colors"
              data-testid="footer-link-ecosystem"
            >
              Ecosystem
            </a>
            <a
              href="#testimonials"
              className="text-gray-500 hover:text-white transition-colors"
              data-testid="footer-link-results"
            >
              Results
            </a>
            <a
              href="#contact"
              className="text-gray-500 hover:text-white transition-colors"
              data-testid="footer-link-contact"
            >
              Contact
            </a>
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
