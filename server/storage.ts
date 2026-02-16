import { type User, type InsertUser, type WaitlistEntry, type InsertWaitlistEntry, type DemoBooking, type InsertDemoBooking, type WebinarRegistration, type InsertWebinarRegistration } from "@shared/schema";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for persistent storage");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function ensureTablesExist() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS waitlist_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        purpose TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS demo_bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        business_name TEXT NOT NULL,
        purpose TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS webinar_registrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        session_date TEXT NOT NULL,
        session_time TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log("Supabase tables verified/created: waitlist_entries, demo_bookings, webinar_registrations");
  } catch (err: any) {
    console.error("Failed to create tables:", err.message);
  } finally {
    client.release();
  }
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createWaitlistEntry(entry: InsertWaitlistEntry): Promise<WaitlistEntry>;
  getWaitlistEntries(): Promise<WaitlistEntry[]>;
  createDemoBooking(booking: InsertDemoBooking): Promise<DemoBooking>;
  getDemoBookings(): Promise<DemoBooking[]>;
  createWebinarRegistration(registration: InsertWebinarRegistration): Promise<WebinarRegistration>;
  getWebinarRegistrations(): Promise<WebinarRegistration[]>;
}

export class SupabaseStorage implements IStorage {
  private users: Map<string, User>;
  private initialized: Promise<void>;

  constructor() {
    this.users = new Map();
    this.initialized = ensureTablesExist();
  }

  private async waitForInit() {
    await this.initialized;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = crypto.randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createWaitlistEntry(entry: InsertWaitlistEntry): Promise<WaitlistEntry> {
    await this.waitForInit();

    const result = await pool.query(
      `INSERT INTO waitlist_entries (name, email, phone, purpose)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [entry.name, entry.email, entry.phone, entry.purpose]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      purpose: row.purpose,
      createdAt: new Date(row.created_at),
    };
  }

  async getWaitlistEntries(): Promise<WaitlistEntry[]> {
    await this.waitForInit();

    const result = await pool.query(
      `SELECT * FROM waitlist_entries ORDER BY created_at DESC`
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      purpose: row.purpose,
      createdAt: new Date(row.created_at),
    }));
  }

  async createDemoBooking(booking: InsertDemoBooking): Promise<DemoBooking> {
    await this.waitForInit();

    const result = await pool.query(
      `INSERT INTO demo_bookings (name, phone, email, business_name, purpose, date, time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [booking.name, booking.phone, booking.email, booking.businessName, booking.purpose, booking.date, booking.time]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      businessName: row.business_name,
      purpose: row.purpose,
      date: row.date,
      time: row.time,
      createdAt: new Date(row.created_at),
    };
  }

  async getDemoBookings(): Promise<DemoBooking[]> {
    await this.waitForInit();

    const result = await pool.query(
      `SELECT * FROM demo_bookings ORDER BY created_at DESC`
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      businessName: row.business_name,
      purpose: row.purpose,
      date: row.date,
      time: row.time,
      createdAt: new Date(row.created_at),
    }));
  }
  async createWebinarRegistration(registration: InsertWebinarRegistration): Promise<WebinarRegistration> {
    await this.waitForInit();

    const result = await pool.query(
      `INSERT INTO webinar_registrations (first_name, last_name, email, phone, session_date, session_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [registration.firstName, registration.lastName, registration.email, registration.phone, registration.sessionDate, registration.sessionTime]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      sessionDate: row.session_date,
      sessionTime: row.session_time,
      createdAt: new Date(row.created_at),
    };
  }

  async getWebinarRegistrations(): Promise<WebinarRegistration[]> {
    await this.waitForInit();

    const result = await pool.query(
      `SELECT * FROM webinar_registrations ORDER BY created_at DESC`
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      sessionDate: row.session_date,
      sessionTime: row.session_time,
      createdAt: new Date(row.created_at),
    }));
  }
}

export const storage = new SupabaseStorage();
