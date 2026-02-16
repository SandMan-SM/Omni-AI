import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { X, Loader2, CheckCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertWebinarRegistrationSchema, type InsertWebinarRegistration } from "@shared/schema";

interface WebinarRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getSecondSaturday(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const firstDayOfWeek = first.getDay();
  const firstSaturday = firstDayOfWeek <= 6 ? (6 - firstDayOfWeek + 1) : 1;
  const secondSaturday = firstSaturday + 7;
  return new Date(year, month, secondSaturday);
}

interface SessionOption {
  date: Date;
  label: string;
  dateStr: string;
  timeStr: string;
}

function getUpcomingSessions(): SessionOption[] {
  const now = new Date();
  const sessions: SessionOption[] = [];
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  for (let offset = 0; offset < 6; offset++) {
    const year = now.getFullYear();
    const monthOffset = now.getMonth() + offset;
    const month = monthOffset % 12;
    const y = year + Math.floor(monthOffset / 12);

    const secondSat = getSecondSaturday(y, month);
    secondSat.setHours(18, 0, 0, 0);
    if (secondSat > now) {
      sessions.push({
        date: secondSat,
        label: `${formatter.format(secondSat)} – 6:00 PM`,
        dateStr: secondSat.toISOString().split("T")[0],
        timeStr: "6:00 PM",
      });
    }

    const eleventh = new Date(y, month, 11, 12, 0, 0, 0);
    if (eleventh > now) {
      sessions.push({
        date: eleventh,
        label: `${formatter.format(eleventh)} – 12:00 PM`,
        dateStr: eleventh.toISOString().split("T")[0],
        timeStr: "12:00 PM",
      });
    }

    const twentyEighth = new Date(y, month, 28, 19, 0, 0, 0);
    if (twentyEighth > now) {
      sessions.push({
        date: twentyEighth,
        label: `${formatter.format(twentyEighth)} – 7:00 PM`,
        dateStr: twentyEighth.toISOString().split("T")[0],
        timeStr: "7:00 PM",
      });
    }

    if (sessions.length >= 3) break;
  }

  sessions.sort((a, b) => a.date.getTime() - b.date.getTime());
  return sessions.slice(0, 3);
}

function getNextSessionCountdown(sessions: SessionOption[]): number {
  if (sessions.length === 0) return 0;
  const now = Date.now();
  const target = sessions[0].date.getTime();
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  return diff;
}

export function WebinarRegistrationModal({ isOpen, onClose }: WebinarRegistrationModalProps) {
  const { toast } = useToast();
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [sessionError, setSessionError] = useState(false);

  const sessions = useMemo(() => getUpcomingSessions(), []);

  const form = useForm<InsertWebinarRegistration>({
    resolver: zodResolver(insertWebinarRegistrationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      sessionDate: "",
      sessionTime: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertWebinarRegistration) => {
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000));
      const response = await apiRequest("POST", "/api/webinar-registration", data);
      return response.json();
    },
    onSuccess: () => {
      setIsConfirmed(true);
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertWebinarRegistration) => {
    if (!selectedSession) {
      setSessionError(true);
      return;
    }
    mutation.mutate(data);
  };

  const handleClose = () => {
    setIsConfirmed(false);
    setSelectedSession("");
    setSessionError(false);
    form.reset();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto glass-card rounded-md neon-border"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
              data-testid="button-close-registration"
            >
              <X className="w-5 h-5" />
            </button>

            {isConfirmed ? (
              <div className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-2">You're In!</h3>
                <p className="text-gray-400 mb-2">Your seat has been reserved.</p>
                {selectedSession && (
                  <p className="text-purple-400 font-medium mb-4">
                    {sessions.find((s) => s.dateStr === selectedSession)?.label}
                  </p>
                )}
                <p className="text-gray-500 text-sm mb-6">
                  Check your email for confirmation details.
                </p>
                <Button
                  onClick={handleClose}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
                  data-testid="button-close-confirmed"
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="p-8">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2 pr-8">
                  Your Own Private AI CEO Will Run Your Business While You Sleep!
                </h3>
                <p className="text-gray-500 text-sm mb-6">Reserve your free training seat below.</p>

                <div className="mb-6">
                  <label className="text-sm font-medium text-gray-300 mb-3 block">
                    Select Your Training Session
                    <span className="text-red-400 ml-1">*</span>
                  </label>
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <label
                        key={session.dateStr}
                        className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all ${
                          selectedSession === session.dateStr
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        }`}
                        data-testid={`radio-session-${session.dateStr}`}
                      >
                        <input
                          type="radio"
                          name="session"
                          value={session.dateStr}
                          checked={selectedSession === session.dateStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedSession(val);
                            setSessionError(false);
                            const session = sessions.find((s) => s.dateStr === val);
                            if (session) {
                              form.setValue("sessionDate", session.dateStr);
                              form.setValue("sessionTime", session.timeStr);
                            }
                          }}
                          className="accent-purple-500"
                        />
                        <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
                        <span className="text-gray-300 text-sm">{session.label}</span>
                      </label>
                    ))}
                  </div>
                  {sessionError && (
                    <p className="text-red-400 text-sm mt-2">Please select a training session.</p>
                  )}
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">First Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="First name"
                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500"
                                data-testid="input-first-name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Last Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Last name"
                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500"
                                data-testid="input-last-name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="your@email.com"
                              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500"
                              data-testid="input-email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Phone Number</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              placeholder="(555) 123-4567"
                              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500"
                              data-testid="input-phone"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={mutation.isPending}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white py-6 rounded-md neon-glow mt-2"
                      data-testid="button-reserve-seat"
                    >
                      {mutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Checking availability...
                        </>
                      ) : (
                        "Reserve My Seat"
                      )}
                    </Button>
                  </form>
                </Form>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
