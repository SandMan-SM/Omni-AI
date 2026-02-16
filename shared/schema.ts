import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const waitlistEntries = pgTable("waitlist_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  purpose: text("purpose").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWaitlistSchema = createInsertSchema(waitlistEntries).pick({
  name: true,
  email: true,
  phone: true,
  purpose: true,
}).extend({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(1, "Phone number is required"),
  purpose: z.enum([
    "7-8 figure business",
    "growing business",
    "exploring AI",
  ]),
});

export type InsertWaitlistEntry = z.infer<typeof insertWaitlistSchema>;
export type WaitlistEntry = typeof waitlistEntries.$inferSelect;

export const demoBookings = pgTable("demo_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  businessName: text("business_name").notNull(),
  purpose: text("purpose").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDemoBookingSchema = createInsertSchema(demoBookings).pick({
  name: true,
  phone: true,
  email: true,
  businessName: true,
  purpose: true,
  date: true,
  time: true,
}).extend({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  businessName: z.string().min(1, "Business name is required"),
  purpose: z.string().min(1, "Purpose is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
});

export type InsertDemoBooking = z.infer<typeof insertDemoBookingSchema>;
export type DemoBooking = typeof demoBookings.$inferSelect;

export const webinarRegistrations = pgTable("webinar_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  sessionDate: text("session_date").notNull(),
  sessionTime: text("session_time").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWebinarRegistrationSchema = createInsertSchema(webinarRegistrations).pick({
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  sessionDate: true,
  sessionTime: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  sessionDate: z.string().min(1, "Session date is required"),
  sessionTime: z.string().min(1, "Session time is required"),
});

export type InsertWebinarRegistration = z.infer<typeof insertWebinarRegistrationSchema>;
export type WebinarRegistration = typeof webinarRegistrations.$inferSelect;
