# CRM Module — One-Time Setup

The CRM section adds two new tables (`crm_tasks`, `crm_activities`) and a few
columns to your existing `enquiries` and `customers` tables. You need to run the
migration **once** in Supabase.

## Step 1 — Apply the migration (Supabase SQL Editor)

1. Open your project: https://supabase.com/dashboard/project/jfhnkhrsojdfipuiirly/sql/new
2. Open the file [`supabase/migrations/20260610_crm.sql`](supabase/migrations/20260610_crm.sql) in this repo.
3. Copy its entire contents, paste into the SQL Editor, and click **Run**.

It's safe to re-run — every statement is idempotent (`IF NOT EXISTS` guards).

## Step 2 — Use it

Log in as **owner** or **admin**, open the **CRM** section in the sidebar.

## What works before vs. after the migration

| Feature | Needs migration? |
|---|---|
| Pipeline (Kanban over enquiries) | No — works immediately |
| CRM Dashboard metrics | No — works immediately |
| Customer list & 360° view (enquiries/quotes/dispatches) | No — works immediately |
| Won/Lost outcome tracking | Yes (`enquiries.outcome`) |
| Customer tags & lead source | Yes (`customers.tags`, `lead_source`) |
| Follow-up tasks | Yes (`crm_tasks`) |
| Interaction timeline notes | Yes (`crm_activities`) |

Until the migration is applied, the CRM pages show a banner and those specific
features are disabled — nothing breaks.
