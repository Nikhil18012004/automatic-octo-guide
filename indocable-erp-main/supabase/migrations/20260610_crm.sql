-- ════════════════════════════════════════════════════════════════════════════
--  CRM module — schema additions
--  Run this once in Supabase → SQL Editor (see CRM_SETUP.md).
--  Safe to re-run: every statement is idempotent (IF NOT EXISTS / guards).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Extend existing tables ────────────────────────────────────────────────
-- Leads (enquiries): where the lead came from, and how it closed.
alter table public.enquiries add column if not exists lead_source text;
alter table public.enquiries add column if not exists outcome     text;  -- 'won' | 'lost' | null

-- Accounts (customers): CRM metadata.
alter table public.customers add column if not exists tags        text[] default '{}';
alter table public.customers add column if not exists lead_source text;
alter table public.customers add column if not exists crm_notes   text;

-- ── 2. Follow-up tasks ───────────────────────────────────────────────────────
create table if not exists public.crm_tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  details      text,
  due_date     date,
  status       text not null default 'open',     -- 'open' | 'done'
  priority     text not null default 'normal',    -- 'low' | 'normal' | 'high'
  customer_id  uuid references public.customers(id) on delete set null,
  enquiry_id   uuid references public.enquiries(id) on delete set null,
  assigned_to  uuid references public.profiles(id) on delete set null,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists crm_tasks_status_idx   on public.crm_tasks(status);
create index if not exists crm_tasks_customer_idx on public.crm_tasks(customer_id);
create index if not exists crm_tasks_due_idx       on public.crm_tasks(due_date);

-- ── 3. Interaction timeline (calls / visits / notes) ─────────────────────────
create table if not exists public.crm_activities (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  enquiry_id  uuid references public.enquiries(id) on delete set null,
  type        text not null default 'note',       -- 'note' | 'call' | 'visit' | 'email' | 'whatsapp'
  body        text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists crm_activities_customer_idx on public.crm_activities(customer_id, created_at desc);

-- ── 4. Row-Level Security ────────────────────────────────────────────────────
-- CRM is internal-staff only. Allow any authenticated user to read/write;
-- the UI already restricts the section to owner/admin roles.
alter table public.crm_tasks      enable row level security;
alter table public.crm_activities enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'crm_tasks' and policyname = 'crm_tasks_authenticated') then
    create policy crm_tasks_authenticated on public.crm_tasks
      for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'crm_activities' and policyname = 'crm_activities_authenticated') then
    create policy crm_activities_authenticated on public.crm_activities
      for all to authenticated using (true) with check (true);
  end if;
end $$;
