# Aria — Product Direction

## What Aria is
An AI assistant for NJ real estate agents that tells them who to follow up with today, drafts the message in their voice, and makes sure no client — past or present — falls through the cracks.

## The one job (from real agent feedback)
"Tell me who to talk to today, what to say, and make sure I don't forget anyone — including past clients on birthdays and anniversaries."

## What Aria is NOT
- Not a kanban board to manage
- Not a dashboard full of widgets
- Not a tool that requires the agent to remember to use it
- Not a place to learn 13 features

## Current architecture (locked)
- Capacitor WebView wrapping Next.js at getariaai.com/crm
- Server-side secrets stay on Vercel
- 12 of 13 features built; 1 half-built (Market Pulse)

## The new structure — 5 tabs, not 13 destinations

| Tab | What lives there |
|---|---|
| 🏠 Today | The list — who needs you today, with one button per person |
| 👥 People | Pipeline + Client Details + Inbox merged |
| 🏘️ Properties | MLS + matching |
| 📋 Deals | Showings + Transactions + CMA |
| ⚙️ More | Settings + Voice + Referrals + Market Pulse + Client Portal |

## The Today screen (the heart of the app)
A numbered list of people the agent needs to follow up with, ordered by urgency. Each entry shows:
- Person's name (big, bold)
- One plain-English sentence explaining why they're on the list
- ONE giant button with the exact action ("Text Sarah now", "Send anniversary text", "Open their deal")
- A quiet "Skip for today" text link

Tap the button → next screen shows the AI-drafted message full-screen → [Send] or [Edit] or [Cancel]. One screen, one decision.

## What goes on the Today list (sources)
- Hot leads who haven't been contacted in X days
- Closings at risk (inspection deadlines, contingencies)
- Past clients on birthdays / home purchase anniversaries / holidays
- Clients waiting on paperwork
- New MLS matches for active buyers
- "Just checking in" nudges when relationships go quiet (no recent activity)

## Design principles
- Dummy-proof: one screen answers one question
- Calm: black background, lots of breathing room, ONE bright accent color per primary button
- Professional: dense, serious, fast — like the dark workout app aesthetic, not pastel AI consumer apps
- Plain English: no labels like "Hot Lead" or "BBA Alert" — say "She's been quiet for 6 days" instead

## Design tokens (locked)
Background #000000, cards #111111, deep surfaces #0a0a0a, borders #222222, primary accent #3B82F6 (open to brighter alternative for primary CTAs), Inter font. No gradients, shadows, blur, or glass effects.

## Rules for future development
1. Read this file before any structural change
2. New features must fit one of the 5 tabs or they don't get built yet
3. The Today tab is sacred — every item on it must save the agent time today
4. If something isn't immediately obvious to a 55-year-old real estate agent, redesign it
5. Polish the front door before adding new rooms
