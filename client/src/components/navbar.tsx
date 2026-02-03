import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  onBookDemo?: () => void;
  onSignIn?: () => void;
}

export function Navbar({ onBookDemo, onSignIn }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "#services", label: "Services" },
    { href: "#legacy", label: "Legacy Model" },
    { href: "#ecosystem", label: "Ecosystem" },
    { href: "#testimonials", label: "Results" },
    { href: "#contact", label: "Contact" },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-black/80 backdrop-blur-lg border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          <a href="#" className="flex items-center gap-2" data-testid="link-home">
            <span className="text-xl md:text-2xl font-bold text-gradient">
              Omni AI
            </span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-400 hover:text-white transition-colors text-sm"
                data-testid={`nav-${link.label.toLowerCase().replace(" ", "-")}`}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Button
              variant="outline"
              className="border-white/20 bg-transparent text-white"
              onClick={onBookDemo}
              data-testid="button-nav-demo"
            >
              Book Demo
            </Button>
            <Button
              className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
              onClick={onSignIn}
              data-testid="button-nav-start"
            >
              Sign In
            </Button>
          </div>

          <button
            className="md:hidden p-2 text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden py-4 border-t border-white/5 bg-[#050505]"
            >
            <div className="flex flex-col gap-4 px-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-gray-400 hover:text-white transition-colors py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                  data-testid={`mobile-nav-${link.label.toLowerCase().replace(" ", "-")}`}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t border-white/5">
                <Button
                  variant="outline"
                  className="border-white/20 bg-transparent text-white w-full"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onBookDemo?.();
                  }}
                  data-testid="button-mobile-demo"
                >
                  Book Demo
                </Button>
                <Button
                  className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white w-full"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onSignIn?.();
                  }}
                  data-testid="button-mobile-start"
                >
                  Sign In
                </Button>
              </div>
            </div>
          </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}
