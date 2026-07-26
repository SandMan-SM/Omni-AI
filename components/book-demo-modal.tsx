import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, User, Phone, Mail, Check, Loader2, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface BookDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Per-page heading override. Defaults to "Book a Demo" so every
  // existing caller keeps its current wording; /book-now passes
  // "Book a Consultation" because that page is framed around a
  // no-pitch free conversation, not a product demo.
  heading?: string;
  subheading?: string;
  variant?: "default" | "meta";
}

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

export function BookDemoModal({
  isOpen,
  onClose,
  heading = "Book a Demo",
  subheading = "Let's explore how Omni AI can transform your business",
  variant = "default",
}: BookDemoModalProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [modalStep, setModalStep] = useState<ModalStep>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Honeypot — rendered off-screen, aria-hidden, non-tabbable. Server
  // returns silent 200 when this is non-empty (bot signal).
  const [website, setWebsite] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const { toast } = useToast();
  const isMetaVariant = variant === "meta";

  const calendarDays = generateCalendarMonth(calendarMonth.year, calendarMonth.month);

  useEffect(() => {
    if (isOpen) {
      setModalStep("form");
      setName("");
      setEmail("");
      setPhone("");
      setWebsite("");
      setSelectedDate("");
      setSelectedTime("");
      setGoogleCalendarUrl("");
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
  const isFormValid = name.trim() && validateEmail(email) && phone.trim();

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

  const handleComplete = async (timeOverride = selectedTime) => {
    const bookingTime = timeOverride.trim();
    if (!selectedDate || !bookingTime || isSubmitting) return;
    setSelectedTime(bookingTime);
    setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/demo-booking", {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        businessName: "Omni AI prospect",
        purpose: "Free 30-minute strategy session",
        date: selectedDate,
        time: bookingTime,
        website, // honeypot
      });
      const data = await res.json();
      if (data.googleCalendarUrl) {
        setGoogleCalendarUrl(data.googleCalendarUrl);
      }
      setModalStep("success");
    } catch (e) {
      // apiRequest (via throwIfResNotOk) now unpacks the server's
      // `error` field and throws `<status>: <error>`. Strip the
      // leading status prefix so the toast reads cleanly when the
      // server gave us an actionable message (rate-limit, bad email,
      // bad phone, etc.), and fall back to the generic line when the
      // thrown value isn't an Error or the network layer failed.
      const raw = e instanceof Error ? e.message : "";
      const stripped = raw.replace(/^\d{3}:\s*/, "");
      toast({
        title: "We couldn't book your demo",
        description: stripped || "Please try again.",
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
      details: "Free 30-minute strategy session with Omni AI",
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
        // h-[100dvh] (dynamic viewport height) so the overlay stops at the
        // top of Safari's bottom toolbar on iOS instead of extending behind
        // it. Without this, flex centering is relative to the full 100vh
        // and the modal's bottom edge ends up hidden behind the toolbar.
        className="fixed inset-0 h-[100dvh] z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          // Structural split — outer shell owns the .neon-border gradient
          // + overflow-hidden; inner wrapper owns the scroll. Previously
          // the shell had BOTH overflow-y-auto and .neon-border on the
          // same element, and webkit clipped the neon-border's
          // -webkit-mask pseudo-element mid-content when the form was
          // taller than max-h-[85dvh] — the gradient would end partway
          // down the scroll area (famously slicing through the third
          // "Purpose" checkbox with a horizontal cyan line and leaving
          // the Submit button outside the border entirely). Moving the
          // scroll to an inner div keeps the border stable at all
          // scroll positions and on every viewport. flex-col +
          // overflow-hidden on the shell makes the inner scroller
          // flex-1 and the close button pinned to a non-scrolling
          // corner so it's always reachable. Bumped cap to 90dvh — the
          // old 85dvh floor was added before the structural fix to
          // hide the border clip; with the clip gone we can use the
          // extra height to keep the form on one screen on most phones.
          className={`relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-[1.75rem] border ${
            isMetaVariant
              ? "border-white/10 bg-zinc-950 shadow-[0_24px_80px_rgba(0,0,0,0.65),0_0_55px_rgba(126,34,206,0.18)]"
              : "border-amber-300/20 bg-[#05070d]/95 shadow-[0_24px_80px_rgba(0,0,0,0.65),0_0_0_1px_rgba(251,191,36,0.08)]"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {isMetaVariant ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-purple-500/20 via-blue-500/10 to-transparent"
            />
          ) : null}
          <button
            onClick={onClose}
            className={`absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/45 transition-colors focus:outline-none focus:ring-2 ${
              isMetaVariant
                ? "hover:border-purple-300/30 hover:bg-purple-400/10 hover:text-white focus:ring-purple-300/40"
                : "hover:border-amber-300/30 hover:bg-amber-300/10 hover:text-amber-100 focus:ring-amber-300/40"
            }`}
            data-testid="button-close-modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8 sm:py-9 md:px-10">
          <AnimatePresence mode="wait">
            {modalStep === "form" && (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-4 flex items-center justify-center gap-4">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                      isMetaVariant
                        ? "border-purple-300/25 bg-purple-400/10 shadow-[0_0_30px_rgba(168,85,247,0.16)]"
                        : "border-amber-300/25 bg-amber-300/10 shadow-[0_0_30px_rgba(251,191,36,0.12)]"
                    }`}
                  >
                    <Calendar className={`h-5 w-5 ${isMetaVariant ? "text-purple-200" : "text-amber-200"}`} />
                  </div>
                </div>
                <h2 className="mb-2 text-center text-2xl font-semibold tracking-tight text-white md:text-[1.7rem]" data-testid="text-demo-heading">
                  {heading}
                </h2>
                <p className="mx-auto mb-7 max-w-sm text-center text-sm leading-6 text-white/58">
                  {subheading}
                </p>

                <form onSubmit={handleFormSubmit} className="space-y-3.5">
                  {/* Honeypot — real users never see this; bots auto-fill
                      every input they find. Server 200s silently when it
                      comes back with a value. */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: "-9999px",
                      top: "auto",
                      width: 1,
                      height: 1,
                      overflow: "hidden",
                    }}
                  >
                    <label htmlFor="website-demo">Website (leave blank)</label>
                    <input
                      type="text"
                      id="website-demo"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <User className={`absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${isMetaVariant ? "text-purple-200/55" : "text-amber-200/45"}`} />
                    <Input
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`h-12 rounded-xl border-white/10 bg-white/[0.055] pl-10 text-white shadow-inner shadow-black/20 placeholder:text-white/35 ${
                        isMetaVariant
                          ? "focus-visible:border-purple-300/50 focus-visible:ring-purple-300/20"
                          : "focus-visible:border-amber-300/45 focus-visible:ring-amber-300/20"
                      }`}
                      required
                      data-testid="input-demo-name"
                    />
                  </div>

                  <div className="relative">
                    <Mail className={`absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${isMetaVariant ? "text-purple-200/55" : "text-amber-200/45"}`} />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`h-12 rounded-xl border-white/10 bg-white/[0.055] pl-10 text-white shadow-inner shadow-black/20 placeholder:text-white/35 ${
                        isMetaVariant
                          ? "focus-visible:border-purple-300/50 focus-visible:ring-purple-300/20"
                          : "focus-visible:border-amber-300/45 focus-visible:ring-amber-300/20"
                      }`}
                      required
                      data-testid="input-demo-email"
                    />
                  </div>

                  <div className="relative">
                    <Phone className={`absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${isMetaVariant ? "text-purple-200/55" : "text-amber-200/45"}`} />
                    <Input
                      type="tel"
                      placeholder="Phone Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`h-12 rounded-xl border-white/10 bg-white/[0.055] pl-10 text-white shadow-inner shadow-black/20 placeholder:text-white/35 ${
                        isMetaVariant
                          ? "focus-visible:border-purple-300/50 focus-visible:ring-purple-300/20"
                          : "focus-visible:border-amber-300/45 focus-visible:ring-amber-300/20"
                      }`}
                      required
                      data-testid="input-demo-phone"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={!isFormValid}
                    className={`mt-3 h-12 w-full rounded-xl border-0 bg-gradient-to-r text-sm font-semibold tracking-wide transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 ${
                      isMetaVariant
                        ? "from-purple-500 to-blue-500 text-white shadow-[0_14px_35px_rgba(126,34,206,0.25)]"
                        : "from-amber-300 via-yellow-400 to-amber-500 text-black shadow-[0_14px_35px_rgba(251,191,36,0.22)]"
                    }`}
                    data-testid="button-submit-demo"
                  >
                    Pick Date & Time
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
                    className={`rounded-full p-1 text-white/45 transition-colors hover:bg-white/[0.06] ${
                      isMetaVariant ? "hover:text-purple-100" : "hover:text-amber-100"
                    }`}
                    data-testid="button-back-to-form"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold tracking-tight text-white" data-testid="text-schedule-heading">
                    Pick a Date & Time
                  </h2>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => navigateCalendar("prev")}
                    className={`rounded-xl border border-white/10 bg-white/[0.05] p-1.5 transition-colors ${
                      isMetaVariant
                        ? "hover:border-purple-300/25 hover:bg-purple-300/10"
                        : "hover:border-amber-300/25 hover:bg-amber-300/10"
                    }`}
                    data-testid="button-prev-month"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-white font-medium text-sm">
                    {getMonthName(calendarMonth.month)} {calendarMonth.year}
                  </span>
                  <button
                    onClick={() => navigateCalendar("next")}
                    className={`rounded-xl border border-white/10 bg-white/[0.05] p-1.5 transition-colors ${
                      isMetaVariant
                        ? "hover:border-purple-300/25 hover:bg-purple-300/10"
                        : "hover:border-amber-300/25 hover:bg-amber-300/10"
                    }`}
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

                <div className="grid grid-cols-7 gap-1 mb-6">
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
                            ? isMetaVariant
                              ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-[0_0_18px_rgba(126,34,206,0.24)]"
                              : "bg-amber-300 text-black shadow-[0_0_18px_rgba(251,191,36,0.22)]"
                            : !day.isCurrentMonth
                            ? "text-gray-700"
                            : isDisabled
                            ? "text-gray-600 cursor-not-allowed"
                            : isMetaVariant
                              ? "text-white hover:bg-purple-300/15"
                              : "text-white hover:bg-amber-300/15"
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
                    <div className="grid grid-cols-4 gap-2 mb-6">
                      {timeSlots.map((time) => (
                        <button
                          key={time}
                          onClick={() => {
                            setSelectedTime(time);
                            void handleComplete(time);
                          }}
                          disabled={isSubmitting}
                          className={`p-2 rounded-lg text-xs font-medium transition-all ${
                            selectedTime === time
                              ? isMetaVariant
                                ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-[0_0_18px_rgba(126,34,206,0.22)]"
                                : "bg-amber-300 text-black shadow-[0_0_18px_rgba(251,191,36,0.2)]"
                              : isMetaVariant
                                ? "border border-white/10 bg-white/[0.05] text-gray-300 hover:border-purple-300/25 hover:bg-purple-300/10"
                                : "border border-white/10 bg-white/[0.05] text-gray-300 hover:border-amber-300/25 hover:bg-amber-300/10"
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
                  onClick={() => handleComplete()}
                  disabled={!selectedDate || !selectedTime || isSubmitting}
                  className={`mt-3 h-12 w-full rounded-xl border-0 bg-gradient-to-r text-sm font-semibold tracking-wide transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 ${
                    isMetaVariant
                      ? "from-purple-500 to-blue-500 text-white shadow-[0_14px_35px_rgba(126,34,206,0.25)]"
                      : "from-amber-300 via-yellow-400 to-amber-500 text-black shadow-[0_14px_35px_rgba(251,191,36,0.22)]"
                  }`}
                  data-testid="button-complete-booking"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Book Selected Time"
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
                <h2 className="text-xl font-bold text-white mb-4" data-testid="text-demo-success">
                  Request Complete!
                </h2>
                <p className="text-gray-400 text-sm mb-2 leading-relaxed px-2">
                  A confirmation email with a calendar invite has been sent to your inbox. If anything comes up, let us know at least 24 hours in advance so we can fill the slot!
                </p>
                <p className="text-purple-400 text-sm font-medium mb-6">
                  {formatSelectedDate()} at {selectedTime}
                </p>
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1 border-purple-500/30 bg-purple-500/10 text-purple-300"
                    onClick={() => window.open(googleCalendarUrl || buildGoogleCalendarUrl(), "_blank")}
                    data-testid="button-add-calendar"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Add to Calendar
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
                    onClick={() => {
                      onClose();
                      router.push("/join");
                    }}
                    data-testid="button-goto-dashboard"
                  >
                    Dashboard
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
