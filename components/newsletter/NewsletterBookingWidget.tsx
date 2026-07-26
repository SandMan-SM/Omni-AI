"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Phone,
  User,
} from "lucide-react";

type BookingStep = "schedule" | "details" | "success";

type CalendarDay = {
  date: string;
  dayNumber: number;
  currentMonth: boolean;
  disabled: boolean;
};

type NewsletterBookingWidgetProps = {
  articleTitle: string;
};

const TIME_SLOTS = [
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
];

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    date.setHours(0, 0, 0, 0);
    const currentMonth = date.getMonth() === month;
    const weekend = date.getDay() === 0 || date.getDay() === 6;

    return {
      date: toLocalDateKey(date),
      dayNumber: date.getDate(),
      currentMonth,
      disabled: !currentMonth || date < today || weekend,
    };
  });
}

function formatDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function NewsletterBookingWidget({
  articleTitle,
}: NewsletterBookingWidgetProps) {
  const now = new Date();
  const [step, setStep] = useState<BookingStep>("schedule");
  const [month, setMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [calendarUrl, setCalendarUrl] = useState("");

  const days = useMemo(
    () => calendarDays(month.year, month.month),
    [month.year, month.month],
  );

  const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
  const visibleMonthIndex = month.year * 12 + month.month;
  const canGoBack = visibleMonthIndex > currentMonthIndex;

  const moveMonth = (direction: -1 | 1) => {
    setMonth((current) => {
      const next = new Date(current.year, current.month + direction, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
    setSelectedDate("");
    setSelectedTime("");
  };

  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !phone.trim() || !selectedDate || !selectedTime) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/demo-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: "",
          businessName: "Interlinked reader",
          purpose: `1:1 consultation about: ${articleTitle}`,
          date: selectedDate,
          time: selectedTime,
          website,
          source: "interlinked-article-inline-booking",
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        persisted?: boolean;
        googleCalendarUrl?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "We could not book that time.");
      }

      if (data.persisted !== true) {
        throw new Error(
          "We could not safely save this booking. Please try again.",
        );
      }

      setCalendarUrl(data.googleCalendarUrl || "");
      setStep("success");
    } catch (bookingError) {
      setError(
        bookingError instanceof Error
          ? bookingError.message
          : "We could not book that time. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "success") {
    return (
      <div
        className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] px-5 py-7 text-center"
        aria-live="polite"
      >
        <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
          <Check className="h-6 w-6" />
        </span>
        <h3 className="text-lg font-semibold text-white">
          Your 1:1 request is saved
        </h3>
        <p className="mt-2 text-sm text-white/60">
          {formatDate(selectedDate)} at {selectedTime}
        </p>
        {calendarUrl && (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-300/15"
          >
            Add to calendar
          </a>
        )}
      </div>
    );
  }

  if (step === "details") {
    return (
      <form
        onSubmit={submitBooking}
        className="mx-auto max-w-md text-left"
        noValidate
      >
        <button
          type="button"
          onClick={() => {
            setStep("schedule");
            setError("");
          }}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/55 transition-colors hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Change date or time
        </button>

        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-4 py-3">
          <CalendarDays className="h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-white">
              {formatDate(selectedDate)} · {selectedTime}
            </p>
            <p className="mt-0.5 text-xs text-white/45">
              1:1 Interlinked consultation
            </p>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden"
        >
          <label htmlFor="newsletter-booking-website">
            Website (leave blank)
          </label>
          <input
            id="newsletter-booking-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
            Full name
          </span>
          <span className="relative block">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/50" />
            <input
              type="text"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your full name"
              className="h-12 w-full rounded-xl border border-white/12 bg-black/35 pl-10 pr-4 text-base text-white outline-none transition-colors placeholder:text-white/30 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/10"
              required
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
            Phone number
          </span>
          <span className="relative block">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/50" />
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(555) 555-5555"
              className="h-12 w-full rounded-xl border border-white/12 bg-black/35 pl-10 pr-4 text-base text-white outline-none transition-colors placeholder:text-white/30 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/10"
              required
            />
          </span>
        </label>

        {error && (
          <p
            className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!name.trim() || !phone.trim() || submitting}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 px-5 text-sm font-bold text-black shadow-[0_10px_30px_rgba(251,191,36,0.24)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Confirm 1:1"
          )}
        </button>
      </form>
    );
  }

  const monthLabel = new Date(month.year, month.month, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );

  return (
    <div className="mx-auto max-w-xl text-left">
      <div className="mb-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
          Book a 1:1 consultation
        </p>
        <p className="mt-1.5 text-sm text-white/55">
          Pick a date and time, then add your contact details.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_150px]">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              disabled={!canGoBack}
              aria-label="Previous month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-colors hover:border-amber-300/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-white">{monthLabel}</p>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="Next month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-colors hover:border-amber-300/30 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((weekday, index) => (
              <span
                key={`${weekday}-${index}`}
                className="pb-1 text-center text-[10px] font-semibold text-white/35"
              >
                {weekday}
              </span>
            ))}
            {days.map((day) => {
              const selected = selectedDate === day.date;
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={day.disabled}
                  onClick={() => {
                    setSelectedDate(day.date);
                    setSelectedTime("");
                  }}
                  aria-label={new Date(
                    `${day.date}T12:00:00`,
                  ).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  aria-pressed={selected}
                  className={`aspect-square rounded-lg text-xs font-medium transition-all ${
                    selected
                      ? "bg-amber-300 text-black shadow-[0_0_16px_rgba(251,191,36,0.3)]"
                      : day.disabled
                        ? "cursor-not-allowed text-white/15"
                        : "bg-white/[0.045] text-white/75 hover:bg-amber-300/15 hover:text-amber-100"
                  }`}
                >
                  {day.dayNumber}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-amber-300" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
              Time
            </p>
          </div>
          {selectedDate ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
              {TIME_SLOTS.map((time) => {
                const selected = selectedTime === time;
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => {
                      setSelectedTime(time);
                      setError("");
                      setStep("details");
                    }}
                    aria-pressed={selected}
                    className={`h-9 rounded-lg border px-2 text-xs font-semibold transition-all ${
                      selected
                        ? "border-amber-300 bg-amber-300 text-black"
                        : "border-white/10 bg-white/[0.045] text-white/70 hover:border-amber-300/30 hover:text-white"
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs leading-5 text-white/35">
              Select a date to see available times.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
