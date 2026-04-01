# Email Template Artifacts

Reference copies of all Omni AI transactional email templates.
These are the canonical versions — any future emails MUST follow this design system.

## Design Rules (Enforced)

1. **NO gradient text** — never use `-webkit-background-clip:text` or `-webkit-text-fill-color:transparent`
2. **NO `rgba()` borders** — use solid hex only (`#2a2a2a`, `#222222`, `#252525`)
3. **Solid color buttons** — `background:#7c3aed` (purple) or `background:#22c55e` (green), never `linear-gradient`
4. **Body background** — `#111111` (not `#0a0a0a` which some clients render as white)
5. **Card background** — `#1a1a1a` with `border:1px solid #2a2a2a`
6. **Font stack** — `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`
7. **Table-based layouts** — `<table width="100%" cellpadding="0" cellspacing="0">`
8. **Top bar pattern** — `OMNI AI` left (purple #a855f7) + status badge right (green #22c55e)

## Color Palette

| Use | Color | Hex |
|-----|-------|-----|
| Brand purple | Headings, links, buttons | `#a855f7` / `#7c3aed` |
| Success green | Status badges, confirmations | `#22c55e` |
| Warning amber | Reminders, upgrades | `#f59e0b` |
| Link blue | Email links | `#60a5fa` |
| Body text | Primary content | `#ffffff` |
| Secondary text | Descriptions | `#d1d5db` |
| Muted text | Labels, footers | `#6b7280` / `#4b5563` |
| Card bg | Card backgrounds | `#1a1a1a` |
| Card border | Card borders | `#2a2a2a` |
| Body bg | Email body | `#111111` |
| Dividers | Separators | `#222222` |

## Templates

- `demo-booker-confirmation.html` — Sent to the client when they book a demo
- `demo-owner-notification.html` — Sent to you when someone books a demo
- `demo-reminder.html` — 24h reminder to the client
- `training-registrant-confirmation.html` — Sent to registrant (includes premium upgrade)
- `training-owner-notification.html` — Sent to you when someone registers for training
