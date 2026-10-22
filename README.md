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

## WhatsApp sign-in and bot setup

The “Hi” link only opens a WhatsApp conversation; it does not sign a user into the website. Configure `NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER` with the business number in international digits-only format, then redeploy. The link is hidden when this setting is missing rather than opening a hard-coded test number.

After WhatsApp OTP verification, the server establishes a Supabase Auth session in secure cookies. Dashboard APIs derive the account ID from that verified session, never from a phone number supplied by the browser. Transactions remain scoped to the authenticated user; dashboard routes use the service-role client and enforce that scope explicitly, while RLS policies protect non-admin database access. Phone OTP codes are stored as keyed hashes, expire after 10 minutes, allow at most five verification attempts, and are rate-limited to three requests per 15 minutes with a 60-second minimum between requests.

Set the Supabase URL, publishable key, service-role key, and database password, plus the Meta WhatsApp access token, phone-number ID, app secret, and webhook verify token in the hosting provider's environment settings. Enable Supabase email sign-in so the server can exchange a verified WhatsApp OTP for a Supabase session; the app does not send the internal magic-link email. For an existing database, apply every migration in `supabase/migrations/`, including `20261022000001_production_auth_sessions.sql`, before deploying. For a new project, `supabase/schema_full.sql` is the all-in-one alternative; do not run both setup paths. Never expose the service-role key, Meta access token, or webhook app secret as `NEXT_PUBLIC_` variables. Use fresh secrets from the provider, not values committed to `.env.example`.

Before launch, deploy behind HTTPS, configure Supabase Auth's allowed site and redirect URLs for the production domain, verify that the production environment has all required variables, and test sign-in, account switching, WhatsApp linking, transaction creation/deletion, and webhook delivery using two separate phone numbers. The WhatsApp code request limit is per phone number; put the app behind a trusted hosting platform/WAF rate limit as well to reduce distributed abuse.

In Meta's development mode, only configured test recipient numbers can receive messages. The app sends OTPs as plain text, which Meta may reject unless the recipient has messaged the business within WhatsApp's customer-service window. Have the recipient open the configured business chat, send “Hi”, return to the app, and request a fresh code. For OTP delivery outside that window, configure and use an approved WhatsApp authentication template; this project currently sends plain-text OTPs.

For incoming bot messages, configure Meta's webhook callback to the public deployment URL followed by `/api/webhook/whatsapp`. A temporary Cloudflare quick-tunnel URL changes and works only while the local app and tunnel are running; use a stable deployed URL for ongoing use. Apply a published privacy policy, configure backups/retention and monitoring, and verify Meta WhatsApp production approval before opening the service to real users. This checklist does not replace live provider and deployment verification.

## Adding transactions from images and bank alerts

Signed-in users can scan a JPG, PNG, or WebP receipt, payment screenshot, or screenshot of a bank SMS from the add-transaction dialog. Images must be no larger than 6 MB; the app sends them to its image parser to extract suggested details, shows a local preview, and does not persist the uploaded image. Review and correct the extracted fields before explicitly saving the transaction. Image parsing requires the configured Gemini API credentials.

The WhatsApp bot can parse bank debit/credit alert text when you forward or copy-paste the alert into the verified WhatsApp business chat. It cannot read the phone's native SMS inbox or automatically receive SMS; WhatsApp does not grant this website access to native SMS messages.
