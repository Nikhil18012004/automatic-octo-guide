# Store Gate — Simple Setup

The **Store Gate** lets staff request items with a **6-digit code**. A screen at the store types that code to unlock and update stock.

You only need to do **Step 1 once**. Steps 2–4 are daily use.

---

## Step 1 — Turn it on in Supabase (do this first)

Your app shows an error until this is done.

1. Go to **https://supabase.com/dashboard** and open your project.
2. Click **SQL Editor** (left menu) → **New query**.
3. Open this file on your computer:
   ```
   supabase/migrations/20260520_store_gate_otp.sql
   ```
4. Select **all** the text (Ctrl+A), copy it, paste into the SQL Editor.
5. Click **Run**.
6. You should see **Success**. If you see red errors, copy the message and ask for help.

Optional: **Project Settings → API → Reload schema** (only if the app still says “function not found”).

**Check it worked:** In the app, go to **Gate Request** and submit a form. You should get a 6-digit code — not an error.

---

## Step 2 — Run the app locally

```powershell
cd "c:\Users\Kavithayappa\Downloads\indocable-erp-main\indocable-erp-main"
npm run dev
```

Open **http://localhost:5173** and log in.

---

## Step 3 — Create a request (staff)

1. Menu: **General Store → Gate Request**
2. Choose **Deposit** (bring items in) or **Withdraw** (take items out)
3. Pick an item and quantity → **Generate OTP**
4. Show the **6-digit code** to the person at the store (valid **5 minutes**)

---

## Step 4 — Enter code at the store screen

Open on a tablet or PC at the store:

**http://localhost:5173/store-gate**

(No login needed.)

Type the 6 digits. If correct, the screen shows success and stock updates in the ERP.

---

## What each part does

| Place | Who uses it | What it does |
|--------|-------------|----------------|
| `/store/request` | Logged-in staff | Creates deposit/withdraw + OTP |
| `/store-gate` | Store monitor | Accepts OTP, updates stock |

---

## Still stuck?

| Problem | Fix |
|---------|-----|
| “Could not find function create_store_gate_request” | Step 1 not done — run the SQL file in Supabase |
| “Not authenticated” | Log in to the ERP before Gate Request |
| “Item not found” | Add the item under **Store → Items List** first |
| “Insufficient stock” | Not enough quantity for a withdraw |

---

## Optional: apply SQL from your computer

Only if you prefer not to use the Supabase website:

1. Copy `.env.example` to `.env.local`
2. Put your database connection string in `.env.local` (from Supabase → Settings → Database)
3. Run:
   ```powershell
   npm run db:apply-store-gate
   npm run db:verify-store-gate
   ```
   “OK: RPC exists” means Step 1 is done.
