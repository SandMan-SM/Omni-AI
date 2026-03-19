import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
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

export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).pick({
  email: true,
});

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  isSponsor: boolean("is_sponsor").notNull().default(false),
  tier: integer("tier").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profiles).pick({
  email: true,
  isSponsor: true,
  tier: true,
}).extend({
  email: z.string().email("Invalid email address"),
  tier: z.number().min(0).max(3),
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

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

export const newsletterSubscriptions = pgTable("newsletter_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  subscribedAt: timestamp("subscribed_at").defaultNow(),
});

export const insertNewsletterSubscriptionSchema = createInsertSchema(newsletterSubscriptions).pick({
  email: true,
});

export type InsertNewsletterSubscription = z.infer<typeof insertNewsletterSubscriptionSchema>;
export type NewsletterSubscription = typeof newsletterSubscriptions.$inferSelect;

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

export const arenaAgents = pgTable("arena_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => profiles.id),
  agentName: text("agent_name").notNull(),
  avatarUrl: text("avatar_url"),
  avatarInitials: text("avatar_initials").notNull(),
  avatarColor: text("avatar_color").notNull().default("cyan"),
  personality: text("personality").array(),
  stats: jsonb("stats").$type<{ strategy: number; speed: number; conversion: number; creativity: number }>().default({ strategy: 50, speed: 50, conversion: 50, creativity: 50 }),
  currentRank: text("current_rank").notNull().default("unranked"),
  elo: integer("elo").notNull().default(1000),
  missionsCompleted: integer("missions_completed").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  isConfidential: boolean("is_confidential").notNull().default(true),
  isDiamondVip: boolean("is_diamond_vip").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertArenaAgentSchema = createInsertSchema(arenaAgents).pick({
  userId: true,
  agentName: true,
  avatarUrl: true,
  avatarInitials: true,
  avatarColor: true,
  personality: true,
  stats: true,
  currentRank: true,
  isConfidential: true,
});

export type InsertArenaAgent = z.infer<typeof insertArenaAgentSchema>;
export type ArenaAgent = typeof arenaAgents.$inferSelect;

export const arenaMissions = pgTable("arena_missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => arenaAgents.id),
  missionType: text("mission_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  rewardPoints: integer("reward_points").default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const arenaTournaments = pgTable("arena_tournaments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  bracketSize: integer("bracket_size").notNull().default(8),
  rankRestriction: text("rank_restriction"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("registration"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const arenaMatches = pgTable("arena_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").references(() => arenaTournaments.id),
  agent1Id: varchar("agent1_id").references(() => arenaAgents.id),
  agent2Id: varchar("agent2_id").references(() => arenaAgents.id),
  winnerId: varchar("winner_id").references(() => arenaAgents.id),
  round: integer("round").notNull(),
  status: text("status").notNull().default("pending"),
  score: text("score"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const arenaAchievements = pgTable("arena_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  achievementId: text("achievement_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  icon: text("icon").notNull(),
  gradient: text("gradient").notNull(),
  rarity: text("rarity").notNull().default("common"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const arenaAgentAchievements = pgTable("arena_agent_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => arenaAgents.id),
  achievementId: varchar("achievement_id").references(() => arenaAchievements.id),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

export const arenaSponsorships = pgTable("arena_sponsorships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sponsorId: varchar("sponsor_id").references(() => profiles.id),
  agentId: varchar("agent_id").references(() => arenaAgents.id),
  sponsorshipType: text("sponsorship_type").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const arenaChallenges = pgTable("arena_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sponsorId: varchar("sponsor_id").references(() => profiles.id),
  targetAgentId: varchar("target_agent_id").references(() => arenaAgents.id),
  title: text("title").notNull(),
  description: text("description"),
  reward: integer("reward").default(0),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const arenaNotifications = pgTable("arena_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => profiles.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  metadata: jsonb("metadata").default("{}"),
  createdAt: timestamp("created_at").defaultNow(),
});
