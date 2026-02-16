import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, User, Phone, Mail, Building2, Check, Loader2, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface BookDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const purposeOptions = [
  "Strategic Alignment & Vision Roadmap",
  "Implementation & Execution Planning",
  "Performance Review & Optimization Strategy",
];

const timeSlots = [
  "12:00 AM", "1:00 AM", "2:00 AM", "3:00 AM", "4:00 AM", "5:00 AM",
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
  "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM",
];

type ModalStep = "form" | "schedule" | "success";

const generateCalendarMonth = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: { date: string; dayNum: number; isCurrentMonth: boolean; isPast: boolean; isWeekend: boolean }[] = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    const prevDate = new Date(year, month, -startDayOfWeek + i + 1);
    days.push({
      date: prevDate.toISOString().split("T")[0],
      dayNum: prevDate.getDate(),
      isCurrentMonth: false,
      isPast: prevDate < today,
      isWeekend: prevDate.getDay() === 0 || prevDate.getDay() === 6,
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    days.push({
      date: date.toISOString().split("T")[0],
      dayNum: i,
      isCurrentMonth: true,
      isPast: date < today,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    });
  }

  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const nextDate = new Date(year, month + 1, i);
    days.push({
      date: nextDate.toISOString().split("T")[0],
      dayNum: i,
      isCurrentMonth: false,
      isPast: false,
      isWeekend: nextDate.getDay() === 0 || nextDate.getDay() === 6,
    });
  }

  return days;
};

export function BookDemoModal({ isOpen, onClose }: BookDemoModalProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [modalStep, setModalStep] = useState<ModalStep>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const { toast } = useToast();

  const calendarDays = generateCalendarMonth(calendarMonth.year, calendarMonth.month);

  useEffect(() => {
    if (isOpen) {
      setModalStep("form");
      setName("");
      setEmail("");
      setPhone("");
      setBusinessName("");
      setPurpose("");
      setSelectedDate("");
      setSelectedTime("");
      const now = new Date();
      setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isFormValid = name.trim() && validateEmail(email) && phone.trim() && businessName.trim() && purpose;

  const navigateCalendar = (direction: "prev" | "next") => {
    setCalendarMonth((prev) => {
      let newMonth = prev.month + (direction === "next" ? 1 : -1);
      let newYear = prev.year;
      if (newMonth > 11) { newMonth = 0; newYear++; }
      else if (newMonth < 0) { newMonth = 11; newYear--; }
      return { year: newYear, month: newMonth };
    });
  };

  const getMonthName = (month: number) =>
    new Date(2000, month, 1).toLocaleDateString("en-US", { month: "long" });

  const formatSelectedDate = () => {
    if (!selectedDate) return "";
    const d = new Date(selectedDate + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setModalStep("schedule");
  };

  const handleComplete = async () => {
    if (!selectedDate || !selectedTime) return;
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/demo-booking", {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        businessName: businessName.trim(),
        purpose,
        date: selectedDate,
        time: selectedTime,
      });
      setModalStep("success");
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

  const buildGoogleCalendarUrl = () => {
    const dateObj = new Date(selectedDate + "T12:00:00");
    const [timePart, ampm] = selectedTime.split(" ");
    const [hrs, mins] = timePart.split(":").map(Number);
    let hour24 = hrs;
    if (ampm === "PM" && hrs !== 12) hour24 += 12;
    if (ampm === "AM" && hrs === 12) hour24 = 0;

    const start = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hour24, mins);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const fmt = (d: Date) =>
      d.getFullYear().toString() +
      (d.getMonth() + 1).toString().padStart(2, "0") +
      d.getDate().toString().padStart(2, "0") +
      "T" +
      d.getHours().toString().padStart(2, "0") +
      d.getMinutes().toString().padStart(2, "0") +
      "00";

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: "Omni AI Demo",
      dates: `${fmt(start)}/${fmt(end)}`,
      details: `Demo with Omni AI\nPurpose: ${purpose}\nBusiness: ${businessName}`,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
          className="relative w-full max-w-md glass-card neon-border rounded-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            data-testid="button-close-modal"
          >
            <X className="w-5 h-5" />
          </button>

          <AnimatePresence mode="wait">
            {modalStep === "form" && (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-purple-400" />
                  </div>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-1" data-testid="text-demo-heading">
                  Book a Demo
                </h2>
                <p className="text-gray-400 text-sm text-center mb-6">
                  Let's explore how Omni AI can transform your business
                </p>

                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                      required
                      data-testid="input-demo-name"
                    />
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                      required
                      data-testid="input-demo-email"
                    />
                  </div>

                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type="tel"
                      placeholder="Phone Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                      required
                      data-testid="input-demo-phone"
                    />
                  </div>

                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      placeholder="Business Name"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                      required
                      data-testid="input-demo-business"
                    />
                  </div>

                  <div>
                    <p className="text-sm text-gray-400 mb-2">Purpose</p>
                    <div className="space-y-2">
                      {purposeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setPurpose(option)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                            purpose === option
                              ? "border-purple-500/50 bg-purple-500/10"
                              : "border-white/10 bg-white/5"
                          }`}
                          data-testid={`button-purpose-${option.split(" ")[0].toLowerCase()}`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                              purpose === option
                                ? "border-purple-500 bg-purple-500"
                                : "border-white/30"
                            }`}
                          >
                            {purpose === option && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm text-gray-200">{option}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={!isFormValid}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white py-5 text-base font-medium rounded-lg neon-glow"
                    data-testid="button-submit-demo"
                  >
                    Submit Request
                  </Button>
                </form>
              </motion.div>
            )}

            {modalStep === "schedule" && (
              <motion.div
                key="schedule"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setModalStep("form")}
                    className="text-gray-500 hover:text-white transition-colors"
                    data-testid="button-back-to-form"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-white" data-testid="text-schedule-heading">
                    Pick a Date & Time
                  </h2>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => navigateCalendar("prev")}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    data-testid="button-prev-month"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-white font-medium text-sm">
                    {getMonthName(calendarMonth.month)} {calendarMonth.year}
                  </span>
                  <button
                    onClick={() => navigateCalendar("next")}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    data-testid="button-next-month"
                  >
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-1">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <div key={day} className="text-center text-xs text-gray-500 font-medium py-1">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 mb-5">
                  {calendarDays.map((day, idx) => {
                    const isDisabled = !day.isCurrentMonth;
                    const isSelected = selectedDate === day.date;
                    return (
                      <button
                        key={`${day.date}-${idx}`}
                        onClick={() => !isDisabled && setSelectedDate(day.date)}
                        disabled={isDisabled}
                        className={`p-1.5 rounded-lg text-center transition-all text-sm ${
                          isSelected
                            ? "bg-purple-500 text-white"
                            : !day.isCurrentMonth
                            ? "text-gray-700"
                            : isDisabled
                            ? "text-gray-600 cursor-not-allowed"
                            : "text-white hover:bg-purple-500/30"
                        } ${day.isCurrentMonth && !isDisabled && !isSelected ? "bg-white/5" : ""}`}
                        data-testid={`button-calendar-${day.date}`}
                      >
                        {day.dayNum}
                      </button>
                    );
                  })}
                </div>

                {selectedDate && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <p className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Select a time for {formatSelectedDate()}
                    </p>
                    <div className="grid grid-cols-4 gap-2 mb-5">
                      {timeSlots.map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`p-2 rounded-lg text-xs font-medium transition-all ${
                            selectedTime === time
                              ? "bg-purple-500 text-white"
                              : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                          }`}
                          data-testid={`button-time-${time.replace(/\s/g, "-")}`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                <Button
                  onClick={handleComplete}
                  disabled={!selectedDate || !selectedTime || isSubmitting}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white py-5 text-base font-medium rounded-lg neon-glow"
                  data-testid="button-complete-booking"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Complete"
                  )}
                </Button>
              </motion.div>
            )}

            {modalStep === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-3" data-testid="text-demo-success">
                  Request Complete!
                </h2>
                <p className="text-gray-400 text-sm mb-2 leading-relaxed px-2">
                  Please add this to your calendar, and if anything comes up, let us know at least 24 hours in advance so we can fill the slot. Thank you!
                </p>
                <p className="text-purple-400 text-sm font-medium mb-6">
                  {formatSelectedDate()} at {selectedTime}
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-purple-500/30 bg-purple-500/10 text-purple-300"
                    onClick={() => window.open(buildGoogleCalendarUrl(), "_blank")}
                    data-testid="button-add-calendar"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Add to Calendar
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
                    onClick={() => {
                      onClose();
                      setLocation("/join");
                    }}
                    data-testid="button-goto-dashboard"
                  >
                    Dashboard
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
