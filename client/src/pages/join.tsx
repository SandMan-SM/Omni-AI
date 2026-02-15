import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Phone, Building2, Briefcase, FileText, Mail, Lock, Eye, EyeOff,
  ArrowRight, ArrowLeft, Check, Loader2, SkipForward,
  CircleDot
} from "lucide-react";
import { SiTiktok, SiFacebook, SiYoutube, SiInstagram, SiLinkedin, SiX, SiSnapchat, SiSlack, SiTelegram, SiWhatsapp, SiGoogle, SiDiscord, SiSpotify, SiZoom, SiGithub, SiApple } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useToast } from "@/hooks/use-toast";
import { CursorSpotlight } from "@/components/cursor-spotlight";

const platforms = [
  { name: "TikTok", icon: SiTiktok },
  { name: "Facebook", icon: SiFacebook },
  { name: "YouTube", icon: SiYoutube },
  { name: "Instagram", icon: SiInstagram },
  { name: "LinkedIn", icon: SiLinkedin },
  { name: "X", icon: SiX },
  { name: "Snapchat", icon: SiSnapchat },
  { name: "Slack", icon: SiSlack },
  { name: "Telegram", icon: SiTelegram },
  { name: "WhatsApp", icon: SiWhatsapp },
  { name: "Newsletter", icon: null },
  { name: "Google", icon: SiGoogle },
  { name: "Discord", icon: SiDiscord },
  { name: "ChatGPT", icon: null },
  { name: "Spotify", icon: SiSpotify },
  { name: "Zoom", icon: SiZoom },
  { name: "GitHub", icon: SiGithub },
  { name: "Apple", icon: SiApple },
];

type FunnelStep = "signup" | "basic" | "business" | "activation" | "complete";

function getResumeStep(profile: { name: string | null; phone: string | null; business_owner: boolean | null; business_name: string | null; onboarding_completed: boolean }): FunnelStep {
  if (!profile.name || !profile.phone) {
    return "basic";
  }
  if (profile.business_owner === null || profile.business_owner === undefined) {
    return "business";
  }
  if (profile.business_owner === true && !profile.business_name) {
    return "business";
  }
  if (!profile.onboarding_completed) {
    return "activation";
  }
  return "basic";
}

export default function Join() {
  const { user, loading: authLoading, signUp } = useAuth();
  const { profile, profileLoading, upsertProfile } = useProfile();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<FunnelStep>("signup");
  const [isLoading, setIsLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [businessOwner, setBusinessOwner] = useState<boolean | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessNiche, setBusinessNiche] = useState("");
  const [businessDetails, setBusinessDetails] = useState("");

  const [activateNow, setActivateNow] = useState<boolean | null>(null);
  const [activatedPlatforms, setActivatedPlatforms] = useState<string[]>([]);
  const [platformPage, setPlatformPage] = useState(0);
  const [activationPhase, setActivationPhase] = useState<"idle" | "loading" | "showing" | "done">("idle");
  const [visiblePlatformCount, setVisiblePlatformCount] = useState(0);

  const [hasResumed, setHasResumed] = useState(false);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (user && !hasResumed) {
      if (profile) {
        if (profile.onboarding_completed) {
          setLocation("/dashboard");
          return;
        }
        const resumeStep = getResumeStep(profile);
        setStep(resumeStep);
      } else {
        setStep("basic");
      }
      setHasResumed(true);
    }
  }, [user, authLoading, profileLoading, profile, hasResumed, setLocation]);

  useEffect(() => {
    if (profile) {
      if (profile.name) setName(profile.name);
      if (profile.phone) setPhone(profile.phone);
      setBusinessOwner(profile.business_owner ?? null);
      if (profile.business_name) setBusinessName(profile.business_name);
      if (profile.business_niche) setBusinessNiche(profile.business_niche);
      if (profile.business_details) setBusinessDetails(profile.business_details);
      if (profile.activated_platforms?.length) setActivatedPlatforms(profile.activated_platforms);
    }
  }, [profile]);

  const handleSignUp = async () => {
    if (!email.trim()) {
      toast({ title: "Required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    if (!password.trim() || password.length < 6) {
      toast({ title: "Required", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signUp(email.trim(), password);
      if (error) {
        toast({ title: "Sign Up Failed", description: error.message, variant: "destructive" });
        setIsLoading(false);
        return;
      }
      toast({ title: "Account created!", description: "Let's set up your profile." });
      setStep("basic");
      setHasResumed(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const saveProgress = async () => {
    const data: any = {};
    if (name) data.name = name;
    if (phone) data.phone = phone;
    if (businessOwner !== null) data.business_owner = businessOwner;
    if (businessName) data.business_name = businessName;
    if (businessNiche) data.business_niche = businessNiche;
    if (businessDetails) data.business_details = businessDetails;
    if (activatedPlatforms.length) data.activated_platforms = activatedPlatforms;

    if (Object.keys(data).length > 0) {
      await upsertProfile(data);
    }
  };

  const handleSkipBasic = () => {
    setStep("business");
  };

  const handleSkipBusiness = () => {
    setStep("activation");
  };

  const handleSkipActivation = async () => {
    await handleComplete();
  };

  const handleBasicNext = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({ title: "Required", description: "Please fill in your name and phone number.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    await upsertProfile({ name: name.trim(), phone: phone.trim() });
    setIsLoading(false);
    setStep("business");
  };

  const handleBusinessNext = async () => {
    if (businessOwner === null) {
      toast({ title: "Required", description: "Please select whether you are a business owner.", variant: "destructive" });
      return;
    }
    if (businessOwner && !businessName.trim()) {
      toast({ title: "Required", description: "Please enter your business name.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    await upsertProfile({
      business_owner: businessOwner,
      business_name: businessOwner ? businessName.trim() : null,
      business_niche: businessOwner ? businessNiche.trim() : null,
      business_details: businessOwner ? businessDetails.trim() : null,
    });
    setIsLoading(false);
    setStep("activation");
  };

  const handleTogglePlatform = (platformName: string) => {
    setActivatedPlatforms(prev =>
      prev.includes(platformName)
        ? prev.filter(p => p !== platformName)
        : [...prev, platformName]
    );
  };

  const startActivationSequence = async () => {
    setActivateNow(true);
    setActivationPhase("loading");
    setActivatedPlatforms(platforms.map(p => p.name));

    await new Promise(r => setTimeout(r, 2000));

    setActivationPhase("showing");
    setVisiblePlatformCount(0);

    const batchSize = 4;
    const totalBatches = Math.ceil(platforms.length / batchSize);

    for (let i = 1; i <= totalBatches; i++) {
      await new Promise(r => setTimeout(r, 1200));
      setVisiblePlatformCount(Math.min(i * batchSize, platforms.length));
    }

    await new Promise(r => setTimeout(r, 800));
    setActivationPhase("done");

    await upsertProfile({
      activated_platforms: platforms.map(p => p.name),
      onboarding_completed: true,
    });

    await new Promise(r => setTimeout(r, 1500));
    setLocation("/dashboard");
  };

  const handleComplete = async () => {
    setIsLoading(true);
    await upsertProfile({
      activated_platforms: activatedPlatforms,
      onboarding_completed: true,
    });
    setIsLoading(false);
    setLocation("/dashboard");
  };

  const stepIndex = step === "signup" ? 0 : step === "basic" ? 1 : step === "business" ? 2 : step === "activation" ? 3 : 4;
  const steps = ["Sign Up", "Basic Info", "Business", "Activate"];

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <a href="/" className="inline-block mb-6" data-testid="link-join-home">
            <span className="text-2xl font-bold text-gradient">Omni AI</span>
          </a>
          {step !== "complete" && (
            <>
              <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2" data-testid="text-join-heading">
                {step === "signup" ? "Join Omni AI" : "Complete Your Account"}
              </h1>
              <p className="text-gray-400">
                {step === "signup"
                  ? "Create your account to get started"
                  : "Please fill out this information to continue"}
              </p>
            </>
          )}
        </div>

        {step !== "complete" && (
          <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8" data-testid="progress-steps">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-1 sm:gap-2">
                <div className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  i < stepIndex
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : i === stepIndex
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      : "bg-white/5 text-gray-500 border border-white/10"
                }`}>
                  {i < stepIndex ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
                  <span className="hidden sm:inline">{s}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-4 sm:w-6 h-px ${i < stepIndex ? "bg-green-500/50" : "bg-white/10"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="glass-card neon-border rounded-2xl p-6 md:p-8">
          <AnimatePresence mode="wait">
            {step === "signup" && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-xl font-semibold mb-1" data-testid="text-step-signup">
                  Create Account
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                  Enter your email and create a password
                </p>

                <form onSubmit={(e) => { e.preventDefault(); handleSignUp(); }} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      type="email"
                      placeholder="Email Address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 py-5"
                      data-testid="input-signup-email"
                      autoComplete="email"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 py-5"
                      data-testid="input-signup-password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 py-5"
                      data-testid="input-signup-confirm-password"
                      autoComplete="new-password"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white py-5"
                    disabled={isLoading}
                    data-testid="button-signup-submit"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Create Account <ArrowRight className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>
                </form>

                <div className="text-center mt-6">
                  <p className="text-gray-500 text-sm">
                    Already have an account?{" "}
                    <button
                      onClick={() => setLocation("/?signin=true")}
                      className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                      data-testid="button-goto-signin"
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              </motion.div>
            )}

            {step === "basic" && (
              <motion.div
                key="basic"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-xl font-semibold mb-1" data-testid="text-step-basic">Basic Info</h2>
                <p className="text-gray-400 text-sm mb-6">Tell us a bit about yourself</p>

                <div className="space-y-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 py-5"
                      data-testid="input-name"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      placeholder="Phone Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 py-5"
                      data-testid="input-phone"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="border-white/20 bg-transparent text-gray-400"
                    onClick={handleSkipBasic}
                    disabled={isLoading}
                    data-testid="button-skip"
                  >
                    <SkipForward className="w-4 h-4 mr-2" />
                    Skip
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
                    onClick={handleBasicNext}
                    disabled={isLoading}
                    data-testid="button-basic-next"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next <ArrowRight className="w-4 h-4 ml-2" /></>}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "business" && (
              <motion.div
                key="business"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-xl font-semibold mb-1" data-testid="text-step-business">Business Info</h2>
                <p className="text-gray-400 text-sm mb-6">Are you a business owner?</p>

                <div className="flex gap-3 mb-6">
                  <Button
                    variant={businessOwner === true ? "default" : "outline"}
                    className={businessOwner === true
                      ? "flex-1 bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
                      : "flex-1 border-white/20 bg-transparent text-gray-400"}
                    onClick={() => setBusinessOwner(true)}
                    data-testid="button-business-yes"
                  >
                    Yes
                  </Button>
                  <Button
                    variant={businessOwner === false ? "default" : "outline"}
                    className={businessOwner === false
                      ? "flex-1 bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
                      : "flex-1 border-white/20 bg-transparent text-gray-400"}
                    onClick={() => setBusinessOwner(false)}
                    data-testid="button-business-no"
                  >
                    No
                  </Button>
                </div>

                <AnimatePresence>
                  {businessOwner && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 mb-6"
                    >
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <Input
                          placeholder="Business Name"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 py-5"
                          data-testid="input-business-name"
                        />
                      </div>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <Input
                          placeholder="Business Niche"
                          value={businessNiche}
                          onChange={(e) => setBusinessNiche(e.target.value)}
                          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 py-5"
                          data-testid="input-business-niche"
                        />
                      </div>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <textarea
                          placeholder="Business Details (optional)"
                          value={businessDetails}
                          onChange={(e) => setBusinessDetails(e.target.value)}
                          className="w-full min-h-[100px] pl-10 pt-3 bg-white/5 border border-white/10 rounded-md text-white placeholder:text-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          data-testid="input-business-details"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="border-white/20 bg-transparent text-gray-400"
                    onClick={() => setStep("basic")}
                    data-testid="button-business-back"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/20 bg-transparent text-gray-400"
                    onClick={handleSkipBusiness}
                    disabled={isLoading}
                    data-testid="button-skip-business"
                  >
                    <SkipForward className="w-4 h-4 mr-2" />
                    Skip
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
                    onClick={handleBusinessNext}
                    disabled={isLoading}
                    data-testid="button-business-next"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next <ArrowRight className="w-4 h-4 ml-2" /></>}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "activation" && (
              <motion.div
                key="activation"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {activationPhase === "idle" && (
                  <>
                    <h2 className="text-xl font-semibold mb-1" data-testid="text-step-activation">Activate Platforms</h2>
                    <p className="text-gray-400 text-sm mb-6">Would you like to activate your platforms now?</p>

                    <div className="flex gap-3 mb-6">
                      <Button
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
                        onClick={startActivationSequence}
                        data-testid="button-activate-yes"
                      >
                        Yes
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-white/20 bg-transparent text-gray-400"
                        onClick={handleSkipActivation}
                        data-testid="button-activate-no"
                      >
                        Not Now
                      </Button>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="border-white/20 bg-transparent text-gray-400"
                        onClick={() => setStep("business")}
                        data-testid="button-activation-back"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                    </div>
                  </>
                )}

                {activationPhase === "loading" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                  >
                    <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2" data-testid="text-activating">Activating...</h2>
                    <p className="text-gray-400 text-sm">Setting up your platforms</p>
                  </motion.div>
                )}

                {activationPhase === "showing" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <h2 className="text-xl font-semibold mb-1">Platform Status</h2>
                    <p className="text-gray-400 text-sm mb-4">
                      {visiblePlatformCount} / {platforms.length} configured
                    </p>

                    <div className="space-y-2 mb-4" data-testid="platform-list">
                      {platforms.slice(0, visiblePlatformCount).map((platform, index) => {
                        const IconComponent = platform.icon;
                        return (
                          <motion.div
                            key={platform.name}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: (index % 4) * 0.1 }}
                            className="w-full flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/10"
                            data-testid={`platform-status-${platform.name.toLowerCase()}`}
                          >
                            <Check className="w-4 h-4 flex-shrink-0 text-green-400" />
                            {IconComponent && <IconComponent className="w-5 h-5 text-gray-300" />}
                            <span className="text-sm font-medium text-gray-200">{platform.name}</span>
                            <span className="text-xs text-green-400 ml-auto">Activated</span>
                          </motion.div>
                        );
                      })}
                    </div>

                    <div className="flex gap-1 justify-center">
                      {Array.from({ length: Math.ceil(platforms.length / 4) }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full transition-all ${
                            i < Math.ceil(visiblePlatformCount / 4) ? "bg-green-500 w-4" : "bg-white/20"
                          }`}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {activationPhase === "done" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-400" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2" data-testid="text-activation-complete">
                      All Platforms Activated
                    </h2>
                    <p className="text-gray-400 text-sm">
                      {platforms.length} / {platforms.length} configured
                    </p>
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin mx-auto mt-4" />
                  </motion.div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
