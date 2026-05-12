# Aria API — Bruno collection

Bruno is an open-source API client (Postman alternative). Open this folder
in Bruno to get pre-built requests for Aria's API.

## First-time setup

1. Install Bruno: `brew install --cask bruno` (or download from
   https://www.usebruno.com/downloads)
2. Open Bruno → **Open Collection** → pick this `bruno/` folder
3. Pick an environment in the top-right: **Local** or **Production**

## Authentication

Protected endpoints (`/api/notifications`, the GET on `/api/listing-inquiries`,
`/api/ai`) require a Supabase session.

The simplest way to authenticate in Bruno:

1. Sign in to https://getariaai.com/login in your browser
2. Open DevTools → Application tab → Cookies → `getariaai.com`
3. Copy the value of `sb-<project-ref>-auth-token` (a long base64 blob)
4. In Bruno, set the **`supabaseAccessToken`** secret variable for the
   active environment to that cookie value
5. Bruno will send it as a `Cookie` header on every request

For purely public endpoints (POST `/api/listing-inquiries`), no auth needed.

## Files

- `bruno.json` — collection config (don't edit by hand)
- `environments/Local.bru` — points at `http://localhost:3000`
- `environments/Production.bru` — points at `https://getariaai.com`
- `*.bru` files — one per request
