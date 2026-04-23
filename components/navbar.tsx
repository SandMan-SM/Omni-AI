import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Menu, X, LayoutDashboard, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";

interface NavbarProps {
  onBookDemo?: () => void;
  onSignIn?: () => void;
  onDashboard?: () => void;
}

export function Navbar({ onBookDemo, onSignIn, onDashboard }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { profile, profileLoading } = useProfile();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/campaigns", label: "Campaigns" },
    { href: "/details", label: "Infographic" },
    { href: "/arena", label: "Arena" },
    // Newsletter is the flagship content hub and a strong top-of-funnel
    // magnet — surfacing it in the main nav (not just the footer) feeds
    // both UX and internal-linking SEO.
    { href: "/newsletter", label: "Newsletter" },
    // Pricing is the primary commercial-intent landing page. "[brand]
    // pricing" is typically a top-5 branded search term; surfacing it in
    // the main nav gives direct-to-pricing visitors a one-click path and
    // feeds Google crawl weight to the /pricing route.
    { href: "/pricing", label: "Pricing" },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        isScrolled || isMobileMenuOpen
          ? "bg-black/90 backdrop-blur-lg border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 overflow-x-hidden">
        <div className="flex items-center justify-between h-14 md:h-20">
          <a href="/" className="flex items-center gap-2 flex-shrink-0" data-testid="link-home">
            <span className="text-xl md:text-2xl font-bold text-gradient">
              Omni AI
            </span>
            {/* Navbar logo is above the fold on every page that renders
                <Navbar /> (home + campaigns + details + arena + …).
                Marking it priority so Next emits a preload link tag and
                the browser can start the SVG fetch before hitting the
                main bundle — shaves a few hundred ms off LCP on cold
                visits where the logo is part of the largest-paint
                element. */}
            <Image src="/omni-logo.svg" alt="Omni AI Logo" width={36} height={36} className="h-7 md:h-9 w-auto" priority />
          </a>

          <div className="hidden md:flex items-center justify-center gap-8 flex-1 absolute md:relative left-0 right-0 md:left-auto md:right-auto pointer-events-none md:pointer-events-auto">
            <div className="flex items-center gap-1 pointer-events-auto">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`text-gray-400 hover:text-white transition-colors text-sm px-3 lg:px-4 ${pathname === link.href ? 'text-white' : ''}`}
                  data-testid={`nav-${link.label.toLowerCase().replace(" ", "-")}`}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 flex-shrink-0">
            {!profileLoading && profile?.role === 'super_admin' && (
              <Button
                variant="outline"
                className="border-purple-500/50 text-purple-400 hover:text-purple-300 text-sm"
                onClick={() => router.push("/admin/interlinked")}
              >
                <Command className="w-4 h-4 mr-2" />
                Command Center
              </Button>
            )}
            <Button
              className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
              onClick={() => {
                if (user) {
                  router.push("/dashboard");
                } else if (onDashboard) {
                  onDashboard();
                } else {
                  router.push("/join");
                }
              }}
              data-testid="button-nav-dashboard"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>

          <button
            className="md:hidden p-2 text-white flex-shrink-0"
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
              className="md:hidden py-3 border-t border-white/5 bg-[#050505]/95 backdrop-blur-xl overflow-y-auto max-h-[80vh]"
            >
            <div className="flex flex-col gap-1 px-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-gray-400 hover:text-white transition-colors py-3 px-4 block rounded-lg hover:bg-white/5 ${pathname === link.href ? 'text-white bg-white/5' : ''}`}
                  data-testid={`mobile-nav-${link.label.toLowerCase().replace(" ", "-")}`}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-3 mt-1 mx-4 border-t border-white/5">
                {!profileLoading && profile?.role === 'super_admin' && (
                  <Button
                    variant="outline"
                    className="border-purple-500/50 text-purple-400 hover:text-purple-300 w-full text-sm min-h-[44px]"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      router.push("/admin/interlinked");
                    }}
                  >
                    <Command className="w-4 h-4 mr-2" />
                    Command Center
                  </Button>
                )}
                <Button
                  className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white w-full text-sm min-h-[44px]"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (user) {
                      router.push("/dashboard");
                    } else if (onDashboard) {
                      onDashboard();
                    } else {
                      router.push("/join");
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
