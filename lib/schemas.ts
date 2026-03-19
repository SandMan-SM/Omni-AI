import { z } from "zod";

export const webinarRegistrationSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  sessionDate: z.string().min(1, "Session date is required"),
  sessionTime: z.string().min(1, "Session time is required"),
});

export type WebinarRegistrationFormData = z.infer<typeof webinarRegistrationSchema>;

export const demoBookingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email address"),
  businessName: z.string().min(1, "Business name is required"),
  purpose: z.string().min(1, "Purpose is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
});

export type DemoBookingFormData = z.infer<typeof demoBookingSchema>;

export const waitlistSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  purpose: z.enum([
    "7-8 figure business",
    "growing business",
    "exploring AI",
  ]),
});

export type WaitlistFormData = z.infer<typeof waitlistSchema>;

export const newsletterSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type NewsletterFormData = z.infer<typeof newsletterSchema>;

export const joinSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  name: z.string().min(1, "Name is required"),
  businessName: z.string().optional(),
  phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type JoinFormData = z.infer<typeof joinSchema>;
