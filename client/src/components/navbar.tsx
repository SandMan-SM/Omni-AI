import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface NavbarProps {
  onBookDemo?: () => void;
  onSignIn?: () => void;
  onDashboard?: () => void;
}

export function Navbar({ onBookDemo, onSignIn, onDashboard }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const navLinks = [
    { section: "campaigns", label: "Campaigns" },
    { section: "legacy", label: "Legacy Model" },
    { section: "ecosystem", label: "Ecosystem" },
    { section: "testimonials", label: "Testimonials" },
    { section: "contact", label: "Contact" },
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
          <a href="/" className="flex items-center gap-2" data-testid="link-home">
            <span className="text-xl md:text-2xl font-bold text-gradient">
              Omni AI
            </span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.section || link.href}
                href={link.href || `/#${link.section}`}
                onClick={link.section ? (e) => handleNavClick(e, link.section!) : undefined}
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
              onClick={() => {
                if (user) {
                  setLocation("/dashboard");
                } else {
                  onDashboard?.();
                }
              }}
              data-testid="button-nav-dashboard"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
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
                  key={link.section || link.href}
                  href={link.href || `/#${link.section}`}
                  onClick={(e) => {
                    setIsMobileMenuOpen(false);
                    if (link.section) {
                      handleNavClick(e, link.section);
                    }
                  }}
                  className="text-gray-400 hover:text-white transition-colors py-2"
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
                    if (user) {
                      setLocation("/dashboard");
                    } else {
                      onDashboard?.();
                    }
                  }}
                  data-testid="button-mobile-dashboard"
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
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
