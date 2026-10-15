-- =====================================================================
-- Salon booking app — full database setup
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE where possible).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Roles ----------
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

drop policy if exists "read own roles" on public.user_roles;
create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  city text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profile select" on public.profiles;
create policy "profile select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
drop policy if exists "profile update own" on public.profiles;
create policy "profile update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Settings (single row) ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  salon_name text not null default 'Maison Rosé',
  tagline text default 'Luxury grooming & beauty studio',
  bank_name text default 'Al Rajhi Bank',
  account_holder text default 'Maison Rose Salon',
  account_number text default '000000000000',
  iban text default 'SA0000000000000000000000',
  bank_qr_url text,
  bank_enabled boolean not null default true,
  stc_enabled boolean not null default true,
  bookings_full boolean not null default false,
  full_message text default 'Bookings are currently unavailable because we have too many customers. Please check back soon.',
  advance_percent int not null default 50 check (advance_percent between 0 and 100),
  open_time time not null default '10:00',
  close_time time not null default '23:00',
  slot_minutes int not null default 30,
  whatsapp text default '966500000000',
  phone text default '+966 50 000 0000',
  address text default 'King Fahd Road, Riyadh, Saudi Arabia',
  map_url text default 'https://maps.google.com/?q=Riyadh',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;
alter table public.settings enable row level security;

drop policy if exists "settings public read" on public.settings;
create policy "settings public read" on public.settings for select to anon, authenticated using (true);
drop policy if exists "settings admin update" on public.settings;
create policy "settings admin update" on public.settings for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ---------- Services ----------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Haircuts',
  description text,
  price numeric(10,2) not null check (price >= 0),
  duration_min int not null default 30,
  image_url text,
  popular boolean not null default false,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.services enable row level security;

drop policy if exists "services public read" on public.services;
create policy "services public read" on public.services for select to anon, authenticated
  using (active or public.has_role(auth.uid(), 'admin'));
drop policy if exists "services admin all" on public.services;
create policy "services admin all" on public.services for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

insert into public.services (name, category, description, price, duration_min, popular, sort)
select * from (values
  ('Signature Haircut', 'Haircuts', 'Consultation, precision cut, wash and style.', 80, 45, true, 1),
  ('Skin Fade', 'Haircuts', 'Seamless fade finished with a sharp line-up.', 70, 40, true, 2),
  ('Kids Haircut', 'Haircuts', 'Gentle cut for under 12s.', 50, 30, false, 3),
  ('Beard Sculpt', 'Beard', 'Shape, trim and hot-towel finish.', 50, 25, true, 4),
  ('Royal Shave', 'Beard', 'Straight-razor shave with hot towels and balm.', 60, 30, false, 5),
  ('Hydra Facial', 'Facial', 'Deep cleanse, exfoliation and hydration.', 180, 60, true, 6),
  ('Gold Mask Facial', 'Facial', 'Brightening 24k gold treatment.', 220, 60, false, 7),
  ('Relax Massage', 'Massage', 'Full-body relaxing massage.', 200, 60, true, 8),
  ('Head & Shoulder Massage', 'Massage', 'Tension relief for neck and shoulders.', 90, 30, false, 9)
) v(name, category, description, price, duration_min, popular, sort)
where not exists (select 1 from public.services);

-- ---------- Bookings ----------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('BK-' || upper(substr(md5(random()::text), 1, 6))),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  phone text not null,
  city text,
  notes text,
  booking_date date not null,
  booking_time time not null,
  items jsonb not null default '[]'::jsonb,       -- [{service_id, name, price, qty}]
  total numeric(10,2) not null default 0,
  advance_amount numeric(10,2) not null default 0,
  remaining_amount numeric(10,2) not null default 0,
  payment_method text not null check (payment_method in ('bank', 'stc')),
  recharge_pin text,
  screenshot_path text,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'verified', 'rejected')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  extra_enabled boolean not null default false,
  extra_amount numeric(10,2) not null default 0,
  extra_method text check (extra_method in ('bank', 'stc')),
  extra_recharge_pin text,
  extra_screenshot_path text,
  extra_payment_status text not null default 'none'
    check (extra_payment_status in ('none', 'awaiting', 'under_verification', 'verified', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_user_idx on public.bookings(user_id);
alter table public.bookings enable row level security;

drop policy if exists "bookings select" on public.bookings;
create policy "bookings select" on public.bookings for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
drop policy if exists "bookings insert own" on public.bookings;
create policy "bookings insert own" on public.bookings for insert to authenticated
  with check (
    user_id = auth.uid() and payment_status = 'pending' and status = 'pending'
    and extra_enabled = false and extra_payment_status = 'none'
  );
drop policy if exists "bookings admin update" on public.bookings;
create policy "bookings admin update" on public.bookings for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "bookings admin delete" on public.bookings;
create policy "bookings admin delete" on public.bookings for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Recalculate prices from the services table and enforce "bookings full" + payment toggles.
create or replace function public.bookings_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.settings;
  it jsonb;
  svc public.services;
  q int;
  tot numeric := 0;
  clean jsonb := '[]'::jsonb;
begin
  select * into s from public.settings where id = 1;
  if s.bookings_full then
    raise exception 'BOOKINGS_FULL';
  end if;
  if new.payment_method = 'bank' and not s.bank_enabled then raise exception 'BANK_DISABLED'; end if;
  if new.payment_method = 'stc' and not s.stc_enabled then raise exception 'STC_DISABLED'; end if;
  if new.payment_method = 'stc' and (new.recharge_pin is null or new.recharge_pin !~ '^[0-9]{10,20}$') then
    raise exception 'INVALID_PIN';
  end if;
  if new.payment_method = 'bank' and new.screenshot_path is null then raise exception 'SCREENSHOT_REQUIRED'; end if;

  for it in select * from jsonb_array_elements(new.items) loop
    select * into svc from public.services where id = (it->>'service_id')::uuid and active;
    if svc.id is null then raise exception 'INVALID_SERVICE'; end if;
    q := greatest(1, least(10, coalesce((it->>'qty')::int, 1)));
    tot := tot + svc.price * q;
    clean := clean || jsonb_build_object('service_id', svc.id, 'name', svc.name, 'price', svc.price, 'qty', q);
  end loop;
  if jsonb_array_length(clean) = 0 then raise exception 'EMPTY_CART'; end if;

  new.items := clean;
  new.total := tot;
  new.advance_amount := round(tot * s.advance_percent / 100.0, 2);
  new.remaining_amount := tot - new.advance_amount;
  return new;
end $$;

drop trigger if exists bookings_before_insert on public.bookings;
create trigger bookings_before_insert before insert on public.bookings
  for each row execute function public.bookings_before_insert();

-- ---------- Notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists "notif own read" on public.notifications;
create policy "notif own read" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notif own update" on public.notifications;
create policy "notif own update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Automatic in-app notifications whenever admin changes a booking.
create or replace function public.bookings_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.payment_status is distinct from old.payment_status then
    if new.payment_status = 'verified' then
      insert into public.notifications(user_id, booking_id, title, body)
      values (new.user_id, new.id, 'Payment approved', 'Your advance payment for booking ' || new.code || ' was approved. See you soon!');
    elsif new.payment_status = 'rejected' then
      insert into public.notifications(user_id, booking_id, title, body)
      values (new.user_id, new.id, 'Payment rejected', 'Your payment for booking ' || new.code || ' was rejected. Please pay again from My Bookings.');
    end if;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'completed' then
      insert into public.notifications(user_id, booking_id, title, body)
      values (new.user_id, new.id, 'Service completed', 'Thank you for visiting! Booking ' || new.code || ' is complete.');
    elsif new.status = 'cancelled' then
      insert into public.notifications(user_id, booking_id, title, body)
      values (new.user_id, new.id, 'Appointment cancelled', 'Booking ' || new.code || ' has been cancelled.');
    elsif new.status = 'confirmed' then
      insert into public.notifications(user_id, booking_id, title, body)
      values (new.user_id, new.id, 'Appointment confirmed', 'Booking ' || new.code || ' is confirmed.');
    end if;
  end if;
  if new.extra_payment_status is distinct from old.extra_payment_status then
    if new.extra_payment_status = 'awaiting' then
      insert into public.notifications(user_id, booking_id, title, body)
      values (new.user_id, new.id, 'Pay remaining balance online', 'You can now pay the remaining ' || new.extra_amount || ' SAR for booking ' || new.code || ' online.');
    elsif new.extra_payment_status = 'verified' then
      insert into public.notifications(user_id, booking_id, title, body)
      values (new.user_id, new.id, 'Balance payment approved', 'Your remaining balance for ' || new.code || ' was approved.');
    elsif new.extra_payment_status = 'rejected' then
      insert into public.notifications(user_id, booking_id, title, body)
      values (new.user_id, new.id, 'Balance payment rejected', 'Your balance payment for ' || new.code || ' was rejected. Please try again.');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists bookings_after_update on public.bookings;
create trigger bookings_after_update before update on public.bookings
  for each row execute function public.bookings_after_update();

-- Customer: pay again after rejection
create or replace function public.resubmit_payment(p_booking uuid, p_method text, p_pin text, p_screenshot text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings; s public.settings;
begin
  select * into b from public.bookings where id = p_booking and user_id = auth.uid();
  if b.id is null then raise exception 'NOT_FOUND'; end if;
  if b.payment_status <> 'rejected' then raise exception 'NOT_REJECTED'; end if;
  select * into s from public.settings where id = 1;
  if p_method = 'bank' and (not s.bank_enabled or p_screenshot is null) then raise exception 'BANK_INVALID'; end if;
  if p_method = 'stc' and (not s.stc_enabled or p_pin !~ '^[0-9]{10,20}$') then raise exception 'STC_INVALID'; end if;
  update public.bookings set payment_method = p_method,
    recharge_pin = case when p_method = 'stc' then p_pin else null end,
    screenshot_path = case when p_method = 'bank' then p_screenshot else null end,
    payment_status = 'pending'
  where id = p_booking;
end $$;

-- Customer: pay remaining balance online (when admin enabled it)
create or replace function public.submit_extra_payment(p_booking uuid, p_method text, p_pin text, p_screenshot text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings; s public.settings;
begin
  select * into b from public.bookings where id = p_booking and user_id = auth.uid();
  if b.id is null then raise exception 'NOT_FOUND'; end if;
  if not b.extra_enabled or b.extra_payment_status not in ('awaiting', 'rejected') then raise exception 'NOT_ALLOWED'; end if;
  select * into s from public.settings where id = 1;
  if p_method = 'bank' and (not s.bank_enabled or p_screenshot is null) then raise exception 'BANK_INVALID'; end if;
  if p_method = 'stc' and (not s.stc_enabled or p_pin !~ '^[0-9]{10,20}$') then raise exception 'STC_INVALID'; end if;
  update public.bookings set extra_method = p_method,
    extra_recharge_pin = case when p_method = 'stc' then p_pin else null end,
    extra_screenshot_path = case when p_method = 'bank' then p_screenshot else null end,
    extra_payment_status = 'under_verification'
  where id = p_booking;
end $$;

grant execute on function public.resubmit_payment(uuid, text, text, text) to authenticated;
grant execute on function public.submit_extra_payment(uuid, text, text, text) to authenticated;

-- ---------- Support chat ----------
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- conversation owner (customer)
  sender text not null check (sender in ('user', 'admin')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.support_messages enable row level security;
drop policy if exists "support read" on public.support_messages;
create policy "support read" on public.support_messages for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
drop policy if exists "support user insert" on public.support_messages;
create policy "support user insert" on public.support_messages for insert to authenticated
  with check ((user_id = auth.uid() and sender = 'user') or (public.has_role(auth.uid(), 'admin') and sender = 'admin'));

-- ---------- Telegram logs ----------
create table if not exists public.telegram_logs (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  message text not null,
  status text not null,  -- sent | skipped | failed
  created_at timestamptz not null default now()
);
alter table public.telegram_logs enable row level security;
drop policy if exists "tg insert" on public.telegram_logs;
create policy "tg insert" on public.telegram_logs for insert to authenticated with check (true);
drop policy if exists "tg admin read" on public.telegram_logs;
create policy "tg admin read" on public.telegram_logs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ---------- Grants ----------
grant select on public.settings, public.services to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- ---------- Realtime ----------
do $$ begin
  alter publication supabase_realtime add table public.support_messages;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null; end $$;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values ('payments', 'payments', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;

drop policy if exists "payments upload own" on storage.objects;
create policy "payments upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'payments' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "payments read" on storage.objects;
create policy "payments read" on storage.objects for select to authenticated
  using (bucket_id = 'payments' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'admin')));
drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select to anon, authenticated using (bucket_id = 'media');
drop policy if exists "media admin write" on storage.objects;
create policy "media admin write" on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'media' and public.has_role(auth.uid(), 'admin'));

