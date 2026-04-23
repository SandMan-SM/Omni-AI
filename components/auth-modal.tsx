import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Lock, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt?: string;
  showCompleteBanner?: boolean;
  /**
   * Where to send the user after a successful sign-in.
   * - `undefined` (default) → redirect to `/dashboard` (legacy behavior).
   * - a string path          → redirect to that path.
   * - `null`                 → no redirect, stay on the current page.
   *   Use this when the modal is rendered inline on a page that wants
   *   to keep the user put (e.g. /newsletter — the Subscribe button
   *   there should authenticate without throwing the user into the
   *   dashboard).
   */
  redirectTo?: string | null;
  /**
   * Fires after a successful sign-in, right after the modal closes.
   * Runs BEFORE any redirect. Useful for post-signin UX like opening
   * a follow-up upsell modal.
   */
  onSuccess?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  prompt,
  showCompleteBanner,
  redirectTo,
  onSuccess,
}: AuthModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(username, password);

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
        onClose();
        setUsername("");
        setPassword("");
        // Fire the optional callback first so the parent can queue up
        // a follow-up UI (e.g. premium upsell on /newsletter) before we
        // navigate away.
        onSuccess?.();
        // redirectTo semantics:
        //   undefined → legacy /dashboard redirect
        //   string    → redirect there
        //   null      → stay put (no navigation)
        if (redirectTo === undefined) {
          router.push("/dashboard");
        } else if (typeof redirectTo === "string") {
          router.push(redirectTo);
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // h-[100dvh] = dynamic viewport height. On iOS Safari the
          // regular 100vh includes the area behind the bottom toolbar, so
          // flex centering pushes the modal's bottom under the toolbar.
          // dvh stops exactly at the toolbar's top edge on every phone.
          className="fixed inset-0 h-[100dvh] z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            // p-8 md:p-10 keeps the submit button's shadow inside the
            // .neon-border gradient on every viewport. max-h + overflow
            // guarantee the Sign In button never gets hidden behind the
            // browser toolbar on short screens.
            className="relative w-full max-w-md glass-card neon-border rounded-2xl p-8 md:p-10 max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              data-testid="button-close-auth"
            >
              <X className="w-5 h-5" />
            </button>

            {showCompleteBanner && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 p-4 rounded-lg border border-green-500/30 bg-green-500/10 mb-6"
                data-testid="banner-profile-complete"
              >
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-green-300">Profile Complete</p>
                  <p className="text-xs text-green-400/70">Sign in to access your dashboard</p>
                </div>
              </motion.div>
            )}

            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-gradient mb-2" data-testid="text-auth-heading">
                Welcome Back
              </h2>
              {prompt ? (
                <p className="text-gray-400 text-sm" data-testid="text-auth-prompt">{prompt}</p>
              ) : !showCompleteBanner ? (
                <p className="text-gray-400 text-sm">
                  Sign in with your username
                </p>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 py-5"
                  required
                  data-testid="input-username"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 py-5"
                  required
                  data-testid="input-password"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white py-5 text-base font-medium rounded-lg mt-2"
                data-testid="button-auth-submit"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <p className="text-center text-gray-500 text-sm mt-6">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/join");
                }}
                className="text-purple-400 hover:text-purple-300 transition-colors"
                data-testid="button-switch-signup"
              >
                Sign up
              </button>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
