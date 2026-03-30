# Omni AI Marketing Platform

## Overview
A high-end, dark-luxury, conversion-focused marketing website for Omni Leads LLC that positions Omni AI as a tiered AGI-powered business operating system.

**Domain:** omnileadsllc.com
**Status:** MVP Complete

## Tech Stack
- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS with custom dark theme
- **Animation:** Framer Motion
- **Icons:** lucide-react
- **Backend:** Express.js
- **Storage:** Supabase PostgreSQL (demo bookings, waitlist) + In-memory (users)

## Design System
- **Theme:** Dark mode ONLY
- **Background:** #050505
- **Typography:** Inter font family
- **Effects:** Glassmorphism, neon gradient borders, cursor spotlight
- **Colors:** Purple (primary), Blue (secondary), Cyan (accent)

## Key Features

### 1. Hero Section
- Animated badge with AGI Legacy Model announcement
- Large "Omni AI" gradient heading
- Primary CTA: "Start Free Now"
- Secondary CTA: "Book a Demo"
- Scroll indicator animation

### 2. Tiered Ascension Model
The website uses a unique vertical ascension layout (bottom → top):

| Tier | Name | Price | Target |
|------|------|-------|--------|
| 0 | Apprentice | FREE | Everyone |
| 1 | Knight | $1,000/mo | Creators, Freelancers, Solo founders |
| 2 | Royal | $3k-$5k/mo | Agencies, Sales teams |
| 3 | Ascended | $10k-$25k/mo | Proven businesses only |
| 4 | Holy GRAYL | HIDDEN | Tier 3 members only |

### 3. Legacy Model (Bento Grid)
Three pillars of autonomous intelligence:
- Memory
- Decision Logic
- Self-Improvement

### 4. Ecosystem Flow
Visual representation: AI → Leads → Ops → Revenue → Learning Loop

### 5. Waitlist/Contact Form
Glassmorphism form with fields:
- Name (required)
- Email (required)
- Business URL (optional)
- Tier Interest (dropdown)

### 6. Book a Demo Modal
Multi-step premium demo booking flow with 6 animated steps:
1. Name input
2. Phone number input
3. Email input
4. Date range selection (This week / Next week / Farther out) + day picker
5. Time slot selection (9 AM, 11 AM, 1 PM, 3 PM, 5 PM)
6. Confirmation summary

Features:
- Bottom-sheet style on mobile, centered modal on desktop
- Animated step transitions with Framer Motion
- Progress dots indicator
- Success state with Google Calendar integration
- Connected to hero CTA and navbar "Book Demo" buttons

## API Endpoints

### POST /api/waitlist
Submit a waitlist entry.

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "businessUrl": "string (optional)",
  "tierInterest": "apprentice" | "knight" | "royal" | "ascended"
}
```

**Response:**
```json
{
  "success": true,
  "entry": { ... }
}
```

### GET /api/waitlist
Retrieve all waitlist entries.

### POST /api/demo-booking
Submit a demo booking request.

**Request Body:**
```json
{
  "name": "string",
  "phone": "string",
  "email": "string",
  "date": "string (YYYY-MM-DD)",
  "time": "string (e.g., '9:00 AM')"
}
```

**Response:**
```json
{
  "success": true,
  "booking": { ... }
}
```

### GET /api/demo-booking
Retrieve all demo bookings.

## Project Structure
```
client/
  src/
    components/
      book-demo-modal.tsx     # Multi-step demo booking modal
      cursor-spotlight.tsx    # Mouse-following spotlight effect
      navbar.tsx              # Fixed navigation bar (with Book Demo CTA)
      hero-section.tsx        # Hero with CTAs (Book Demo opens modal)
      tier-card.tsx           # Individual tier card component
      services-section.tsx    # All tier cards with ascension layout
      legacy-section.tsx      # Bento grid for legacy model
      ecosystem-section.tsx   # Flow visualization
      contact-section.tsx     # Waitlist form
      footer.tsx              # Site footer
    hooks/
      use-auth.tsx            # Supabase auth context/hook
      use-profile.tsx         # Profile CRUD + role management hook
    pages/
      landing.tsx             # Main landing page
      dashboard.tsx           # Authenticated user dashboard
      join.tsx                # Onboarding multi-step form
      admin.tsx               # Admin user management panel
      details.tsx             # Infographic page
    index.css                 # Global styles with custom utilities
server/
  routes.ts                   # API routes
  storage.ts                  # In-memory storage
shared/
  schema.ts                   # Data models and validation
```

## Custom CSS Utilities
- `.glass-card` - Glassmorphism effect
- `.neon-border` - Gradient neon border
- `.neon-glow` - Purple/blue glow effect
- `.text-gradient` - Gradient text effect
- `.noise-overlay` - Subtle grain overlay
- `.animated-border` - Animated gradient border

## Running the App
The app runs on port 5000 using the "Start application" workflow:
```bash
npm run dev
```

## Supabase Profiles Table
The app uses a `profiles` table in Supabase for user data, roles, and onboarding status.
The table is auto-created on first user profile access. Required columns:
- id (UUID, references auth.users)
- email, role (default 'user'), name, phone
- business_owner, business_name, business_niche, business_details
- activated_platforms (text array), onboarding_completed (boolean)

Admin user: sitanim8@gmail.com (auto-assigned admin role on profile creation)

## User Roles & Access
- **user**: Default role, access to /dashboard and /join
- **admin**: Access to /admin panel for user management
- Role managed via `useProfile` hook (client/src/hooks/use-profile.tsx)

## Onboarding Funnel (/join)
4-step funnel with built-in sign-up:
1. Sign Up (email + password, with "Already have an account? Sign In" toggle)
2. Basic Info (name, phone)
3. Business Info (yes/no business owner, conditional fields)
4. Platform Activation (18 platforms, 4 shown at a time, toggle on/off)
- Sign-up step is shown first for unauthenticated users; authenticated users skip to step 2
- Skip option saves partial data and goes to /dashboard
- Progress bar shows Sign Up → Basic Info → Business → Activate
- Hero "Start Free Now" opens sign-in modal; "Don't have an account? Sign up" navigates to /join
- Dashboard/Admin redirect unauthenticated users to / (homepage)
- Returning users with partial onboarding auto-resume from their last saved step
- Users who completed onboarding are redirected to /dashboard
- Dashboard shows "You haven't finished setting up" banner with "Continue" button

## Admin Panel (/admin)
- Protected route for admin users only
- View all users with stats (total, admins, onboarded)
- Promote/demote users to/from admin role
- View user details (email, phone, business, platforms)

## Recent Changes
- Updated auth flow: sign-in modal + /join funnel separation (Feb 2026)
  - Hero "Start Free Now" opens sign-in modal (not /join)
  - Auth modal "Don't have an account? Sign up" navigates to /join
  - /join sign-up is step 1 of funnel (email + password + confirm)
  - Sign-in on /join via "Already have an account?" toggle
  - Returning users auto-resume from last saved onboarding step
  - Completed onboarding users visiting /join → redirected to /dashboard
  - Dashboard "Continue" button resumes onboarding at last saved step
  - Dashboard/Admin redirect unauthenticated users to / (homepage)
- Added user onboarding flow at /join (Feb 2026)
  - Multi-step form: basic info, business info, platform activation
  - Skip option, progress indicators, platform pagination
  - Saves to Supabase profiles table
- Added admin panel at /admin (Feb 2026)
  - User management, role promotion, stats cards
  - Admin-only access with role-based routing
- Added Supabase profiles system (Feb 2026)
  - useProfile hook for profile CRUD
  - Auto-creates profile on first sign-in
  - Role-based access control (admin/user)
- Dashboard shows onboarding completion banner (Feb 2026)
- Sign-up now redirects to /join for onboarding (Feb 2026)
- Fixed auth race condition on dashboard redirect (Feb 2026)
- Added authenticated Dashboard at /dashboard (Feb 2026)
  - Metrics cards, tier status with progress bar, quick actions grid
  - Demo bookings section (fetches from /api/demo-booking)
  - Recent activity feed, account settings, sign-out
  - Navbar shows "Dashboard" button when user is signed in
  - Auth-protected: redirects to landing if not authenticated
  - Sign-in redirects to /dashboard on success
- Tier card hover-only visual effects (Feb 2026)
- Added multi-step Book Demo modal with 6-step flow (Feb 2026)
- Backend support for demo bookings (schema, storage, API)
- Connected modal to hero and navbar CTAs
- Initial MVP implementation (Feb 2026)
- Dark luxury theme with glassmorphism
- Tiered pricing model with 5 tiers
- Cursor spotlight effect
- Framer Motion animations throughout
- Waitlist form with backend API
