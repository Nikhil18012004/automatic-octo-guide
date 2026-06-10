# 📍 Where we left off — Resume checklist

_Last session: 2026-06-10 (with Claude Code)._

## ▶️ START HERE NEXT TIME

### Step 1 — Apply the CRM database migration  ⛔ currently blocked
The CRM module needs two new tables + a few columns. This is the **only** thing
left to finish the CRM.

- **Blocker:** the app's Supabase project is **`jfhnkhrsojdfipuiirly`**, which is
  **not** under the "Team Indo" Supabase org you were logged into. You need access
  to the account/org that owns it.
- **What to bring:** from that project → **Settings → Database → Connection string (URI)**
  (a `DATABASE_URL`) **or** **Settings → API → `service_role` key**.
- **Then:** give it to Claude (it'll run the migration in seconds), **or** open the
  project's SQL Editor, paste [`supabase/migrations/20260610_crm.sql`](supabase/migrations/20260610_crm.sql),
  and click **Run**.
- ⚠️ Do **not** create a *new* Supabase project — that would disconnect from all
  existing data and the working login.

### Step 2 — Verify the CRM end-to-end (after the migration)
Log in as owner/admin → open **CRM** in the sidebar and confirm:
- Add a **tag** and a **note** on a customer (360° view)
- **Log an interaction** and create a **follow-up task**
- Mark a lead **Won/Lost** in the Pipeline

### Step 3 — Merge to main / open PRs
Decide whether to merge the pushed branches (below) into `main`.

---

## ✅ Done this session

1. **Runs locally** — `cd indocable-erp-main && npm run dev` → http://localhost:5173
2. **Login fix** — Google "provider not enabled" now degrades gracefully to Staff
   Login (`VITE_GOOGLE_AUTH_ENABLED` flag). _Branch: `fix/login-google-provider-fallback`._
3. **Account Settings** (`/account`) — click your profile (bottom-left of sidebar)
   → change name / phone / password; owner+admin can manage team & assign roles.
4. **Internal CRM module** (`/crm`, owner+admin) — Overview, Pipeline (Kanban over
   enquiries with Won/Lost), Customers list, 360° Customer view, Follow-up Tasks.
   - Read features work now; tasks/tags/notes/Won-Lost need Step 1's migration.
5. **Sample data seeded** for order-tracking: `PO-20260610-005` (PARTIAL),
   dispatch `DC-004/26-27`, customer *Skyline Electricals*, supplier *Bharat Copper*,
   production order `SEED-PRD-001`.

## 🌿 Branches pushed
- `fix/login-google-provider-fallback` — login fix only.
- `feat/account-and-crm` — Account Settings + full CRM module (**the main one**).

## ⚠️ Open items / watch-outs
- **Admin team management & RLS:** admins can now reach team management, but the DB
  may still restrict writing *other* users' profiles to `owner` only. If adding a
  user as admin errors, it's a Row-Level Security policy that needs updating.
- **`.env.local`** holds the Supabase keys — gitignored, never pushed (correct).
- **Seed script** `scripts/seed-order-tracking.mjs` re-creates sample PO + shipment
  (needs `SEED_EMAIL` / `SEED_PASSWORD` env vars). Creates a *new* PO each run.
