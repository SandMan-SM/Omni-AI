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
}

export function AuthModal({ isOpen, onClose, prompt, showCompleteBanner }: AuthModalProps) {
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
        router.push("/dashboard");
        setUsername("");
        setPassword("");
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            // p-8 md:p-10 (was p-6 md:p-8) — keeps the submit button's
            // shadow fully contained inside the .neon-border gradient on
            // every viewport. See the matching comment in book-demo-modal.
            className="relative w-full max-w-md glass-card neon-border rounded-2xl p-8 md:p-10"
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
