This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Gmail OAuth setup

Aria lets agents send email from their own Gmail address. This requires a
Google Cloud project and four environment variables.

### 1. Create a Google Cloud project

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and
   create a new project (e.g. `aria-gmail`).
2. Select the project in the top bar.

### 2. Enable the Gmail API

1. Navigate to **APIs & Services → Library**.
2. Search for `Gmail API` and click **Enable**.

### 3. Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External** user type (unless you're on Workspace).
3. Fill in:
   - App name: `Aria`
   - User support email: your email
   - Developer contact: your email
4. Under **Scopes**, click **Add or remove scopes** and add:
   - `.../auth/gmail.send`
   - `.../auth/gmail.readonly`
   - `.../auth/userinfo.email`
   - `openid`
5. Under **Test users**, add every agent email that will connect while the
   app is in "Testing" mode. You can switch to production later.

### 4. Create OAuth credentials

1. Go to **APIs & Services → Credentials → Create credentials → OAuth
   client ID**.
2. Application type: **Web application**.
3. Name: `Aria (web)`.
4. Authorized redirect URIs — add one for every environment you deploy to,
   **exactly** matching `GOOGLE_REDIRECT_URI`:
   - `http://localhost:3000/api/gmail/callback` (local dev)
   - `https://<preview-url>.vercel.app/api/gmail/callback` (preview)
   - `https://<your-domain>/api/gmail/callback` (production)
5. Click **Create** and copy the **Client ID** and **Client secret**.

### 5. Set environment variables

Add these to `.env.local` for local dev and to **Vercel → Project Settings →
Environment Variables** for every environment. The feature will not work
until *all four* are set.

```
GOOGLE_CLIENT_ID=<from step 4>
GOOGLE_CLIENT_SECRET=<from step 4>
GOOGLE_REDIRECT_URI=<exact redirect URI you registered>
GMAIL_ENCRYPTION_KEY=<32 random bytes, hex>   # only needed if Supabase Vault is unavailable
```

Generate `GMAIL_ENCRYPTION_KEY` with:

```bash
openssl rand -hex 32
```

### 6. Run the database migration

```
supabase/migrations/20260420130000_gmail_and_emails.sql
```

This migration creates `gmail_connections`, `sent_emails`, and
`email_templates`, plus wrapper functions that use Supabase Vault
(`pgsodium`) **if it's available on your project**. If Vault isn't
available, Aria transparently falls back to AES-256-GCM encryption using
`GMAIL_ENCRYPTION_KEY`.

### 7. Test the connection

1. Deploy, then open **Settings** → **Gmail connection** → **Connect Gmail**.
2. Complete the Google consent screen; you'll be redirected back to Aria.
3. Click **Test connection** (or go to `/settings/gmail/test`) and press
   **Run test**. A successful call fetches metadata for one recent message.

### Security notes

- **Refresh tokens are encrypted at rest.** When Supabase Vault is
  available, only a `vault_secret_id` is stored on the row; the token
  itself sits in `vault.secrets`. When Vault isn't available, the token
  is stored in `encrypted_token` as AES-256-GCM ciphertext keyed by
  `GMAIL_ENCRYPTION_KEY`.
- **Agents never see the refresh token.** Row-level security on
  `gmail_connections` scopes rows to `agent_id = auth.uid()`, and the
  sensitive columns (`vault_secret_id`, `encrypted_token`) are revoked
  from the `authenticated` role entirely. They're only readable through
  the service-role admin client on the server.
- **Access tokens are never stored.** `getGmailClient()` exchanges the
  refresh token for a fresh access token on every request.
- **Inbox fetch is on-demand.** Aria does not sync Gmail messages into
  its database. When an agent clicks "Load email history" on a client,
  we query Gmail for the last 90 days of mail with that address and
  cache the result in-memory for 60 seconds. Message bodies are only
  fetched when the agent explicitly opens a message, and are not stored.
- **Revoking access.** From Settings → Disconnect Gmail, or by the user
  revoking the grant at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

### Testing the encryption helpers

```
npm run test:gmail
```

Runs the `node:test` suite in `scripts/test-gmail-encryption.ts` against
the encryption helpers — round-trip, tamper resistance, key rejection,
and constant-time compare.
