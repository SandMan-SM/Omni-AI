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
- **Storage:** In-memory (MemStorage)

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
| 0 | Peasant | FREE | Everyone |
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
  "tierInterest": "peasant" | "knight" | "royal" | "ascended"
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
    pages/
      landing.tsx             # Main landing page
      dashboard.tsx           # Authenticated user dashboard
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

## Recent Changes
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
