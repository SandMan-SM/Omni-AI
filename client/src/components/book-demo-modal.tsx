import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Calendar, Clock, Check, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BookDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "name" | "phone" | "email" | "dateRange" | "time" | "confirm" | "success";

interface FormData {
  name: string;
  phone: string;
  email: string;
  dateRange: "this-week" | "next-week" | "later" | null;
  selectedDate: string | null;
  selectedTime: string | null;
}

const generateDays = (weekOffset: number) => {
  const days = [];
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() + (weekOffset * 7) + 1);
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const isDisabled = weekOffset === 0 && Math.random() < 0.33;
    days.push({
      date: date.toISOString().split('T')[0],
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      disabled: isDisabled,
    });
  }
  return days;
};

const timeSlots = [
  { time: "9:00 AM", label: null },
  { time: "11:00 AM", label: "Filling fast" },
  { time: "1:00 PM", label: null },
  { time: "3:00 PM", label: "Filling fast" },
  { time: "5:00 PM", label: null },
];

export function BookDemoModal({ isOpen, onClose }: BookDemoModalProps) {
  const [step, setStep] = useState<Step>("name");
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    email: "",
    dateRange: null,
    selectedDate: null,
    selectedTime: null,
  });
  const [days, setDays] = useState<ReturnType<typeof generateDays>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const stepOrder: Step[] = ["name", "phone", "email", "dateRange", "time", "confirm", "success"];
  const currentStepIndex = stepOrder.indexOf(step);

  useEffect(() => {
    if (isOpen) {
      setStep("name");
      setFormData({
        name: "",
        phone: "",
        email: "",
        dateRange: null,
        selectedDate: null,
        selectedTime: null,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const goNext = () => {
    const idx = stepOrder.indexOf(step);
    if (idx < stepOrder.length - 1) {
      setStep(stepOrder[idx + 1]);
    }
  };

  const handleDateRangeSelect = (range: "this-week" | "next-week" | "later") => {
    setFormData({ ...formData, dateRange: range, selectedDate: null });
    if (range === "this-week") {
      setDays(generateDays(0));
    } else if (range === "next-week") {
      setDays(generateDays(1));
    } else {
      setDays(generateDays(2));
    }
  };

  const handleDateSelect = (date: string) => {
    setFormData({ ...formData, selectedDate: date });
    goNext();
  };

  const handleTimeSelect = (time: string) => {
    setFormData({ ...formData, selectedTime: time });
    goNext();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/demo-booking", {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        date: formData.selectedDate,
        time: formData.selectedTime,
      });
      setStep("success");
    } catch {
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const formatSelectedDate = () => {
    if (!formData.selectedDate) return "";
    const date = new Date(formData.selectedDate);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-4 md:pt-0 md:items-center px-3 md:px-4"
        onClick={onClose}
      >
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md" />

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-2xl"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.08] to-transparent" />
          <div className="absolute inset-[1px] rounded-2xl bg-[#0a0a0a]" />

          <div className="relative p-4 md:p-8">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 md:top-4 md:right-4 p-1.5 md:p-2 text-gray-500 hover:text-white transition-colors"
              data-testid="button-close-modal"
            >
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            {step !== "success" && (
              <div className="flex justify-center gap-1.5 md:gap-2 mb-4 md:mb-8">
                {stepOrder.slice(0, -1).map((s, i) => (
                  <div
                    key={s}
                    className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-colors ${
                      i <= currentStepIndex ? "bg-purple-500" : "bg-gray-700"
                    }`}
                  />
                ))}
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === "name" && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3 md:space-y-6"
                >
                  <h2 className="text-xl md:text-3xl font-bold text-white text-center">
                    What's your name?
                  </h2>
                  <Input
                    autoFocus
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && formData.name && goNext()}
                    placeholder="Enter your name"
                    className="bg-white/5 border-white/10 text-white text-base md:text-lg py-3 md:py-6 text-center placeholder:text-gray-600"
                    data-testid="input-demo-name"
                  />
                  <Button
                    onClick={goNext}
                    disabled={!formData.name}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white py-3 md:py-6 text-base md:text-lg"
                    data-testid="button-next-name"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-2" />
                  </Button>
                </motion.div>
              )}

              {step === "phone" && (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3 md:space-y-6"
                >
                  <h2 className="text-xl md:text-3xl font-bold text-white text-center">
                    Best number to reach you?
                  </h2>
                  <Input
                    autoFocus
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && formData.phone && goNext()}
                    placeholder="(555) 123-4567"
                    className="bg-white/5 border-white/10 text-white text-base md:text-lg py-3 md:py-6 text-center placeholder:text-gray-600"
                    data-testid="input-demo-phone"
                  />
                  <Button
                    onClick={goNext}
                    disabled={!formData.phone}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white py-3 md:py-6 text-base md:text-lg"
                    data-testid="button-next-phone"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-2" />
                  </Button>
                </motion.div>
              )}

              {step === "email" && (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3 md:space-y-6"
                >
                  <h2 className="text-xl md:text-3xl font-bold text-white text-center">
                    Where should we send the confirmation?
                  </h2>
                  <Input
                    autoFocus
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && validateEmail(formData.email) && goNext()}
                    placeholder="you@company.com"
                    className="bg-white/5 border-white/10 text-white text-base md:text-lg py-3 md:py-6 text-center placeholder:text-gray-600"
                    data-testid="input-demo-email"
                  />
                  <Button
                    onClick={goNext}
                    disabled={!validateEmail(formData.email)}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white py-3 md:py-6 text-base md:text-lg"
                    data-testid="button-next-email"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-2" />
                  </Button>
                </motion.div>
              )}

              {step === "dateRange" && !formData.dateRange && (
                <motion.div
                  key="dateRange"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-2xl md:text-3xl font-bold text-white text-center">
                    When should we talk?
                  </h2>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleDateRangeSelect("this-week")}
                      className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-colors group"
                      data-testid="button-this-week"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">This week</span>
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Limited availability</p>
                    </button>

                    <button
                      onClick={() => handleDateRangeSelect("next-week")}
                      className="w-full p-4 rounded-xl bg-white/5 border border-purple-500/50 text-left hover:bg-white/10 transition-colors group relative overflow-hidden"
                      data-testid="button-next-week"
                    >
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                        Most Popular
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">Next week</span>
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Fully available</p>
                    </button>

                    <button
                      onClick={() => handleDateRangeSelect("later")}
                      className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-colors group"
                      data-testid="button-later"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">Farther out</span>
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">More flexibility</p>
                    </button>
                  </div>
                </motion.div>
              )}

              {step === "dateRange" && formData.dateRange && (
                <motion.div
                  key="dateSelect"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-2xl md:text-3xl font-bold text-white text-center">
                    Pick a day
                  </h2>
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                    {days.map((day) => (
                      <button
                        key={day.date}
                        onClick={() => !day.disabled && handleDateSelect(day.date)}
                        disabled={day.disabled}
                        className={`p-3 rounded-xl text-center transition-all ${
                          day.disabled
                            ? "bg-gray-800/50 text-gray-600 cursor-not-allowed"
                            : "bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-purple-500/50"
                        }`}
                        data-testid={`button-date-${day.date}`}
                      >
                        {day.disabled ? (
                          <Lock className="w-4 h-4 mx-auto mb-1 text-gray-600" />
                        ) : (
                          <span className="text-xs text-gray-500 block">{day.dayName}</span>
                        )}
                        <span className="text-lg font-semibold">{day.dayNum}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setFormData({ ...formData, dateRange: null })}
                    className="text-sm text-gray-500 hover:text-white transition-colors"
                  >
                    ← Choose different range
                  </button>
                </motion.div>
              )}

              {step === "time" && (
                <motion.div
                  key="time"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <h2 className="text-2xl md:text-3xl font-bold text-white">
                      Pick a time
                    </h2>
                    <p className="text-gray-500 mt-2">{formatSelectedDate()}</p>
                  </div>
                  <div className="space-y-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => handleTimeSelect(slot.time)}
                        className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-left hover:bg-white/10 hover:border-purple-500/50 transition-all group flex items-center justify-between"
                        data-testid={`button-time-${slot.time.replace(/\s/g, '-')}`}
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-purple-400" />
                          <span className="text-white font-medium">{slot.time}</span>
                        </div>
                        {slot.label && (
                          <span className="text-xs text-orange-400 font-medium">
                            {slot.label}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === "confirm" && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-2xl md:text-3xl font-bold text-white text-center">
                    Confirm your demo
                  </h2>
                  <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-gray-500">Name</span>
                      <span className="text-white font-medium">{formData.name}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-gray-500">Email</span>
                      <span className="text-white font-medium">{formData.email}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-gray-500">Date</span>
                      <span className="text-white font-medium">{formatSelectedDate()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-500">Time</span>
                      <span className="text-white font-medium">{formData.selectedTime}</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white py-6 text-lg"
                    data-testid="button-confirm-demo"
                  >
                    {isSubmitting ? "Confirming..." : "Confirm Demo"}
                    <Check className="w-5 h-5 ml-2" />
                  </Button>
                </motion.div>
              )}

              {step === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6 text-center py-4"
                >
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white">
                    Your demo is locked in.
                  </h2>
                  <p className="text-gray-400 leading-relaxed">
                    If this is a fit, we'll show you how Omni AI runs lead flow without manual work.
                  </p>
                  <div className="flex flex-col gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const date = formData.selectedDate ? new Date(formData.selectedDate) : new Date();
                        const title = encodeURIComponent("Omni AI Demo");
                        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
                        window.open(url, '_blank');
                      }}
                      className="w-full border-white/20 text-white py-5"
                      data-testid="button-add-calendar"
                    >
                      <Calendar className="w-5 h-5 mr-2" />
                      Add to Calendar
                    </Button>
                    <Button
                      onClick={onClose}
                      className="w-full bg-white/5 border-0 text-white py-5 hover:bg-white/10"
                      data-testid="button-close-success"
                    >
                      Close
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {step !== "success" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center mt-6 md:mt-8"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-purple-500/30 border-t-purple-500 flex items-center justify-center"
                />
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
