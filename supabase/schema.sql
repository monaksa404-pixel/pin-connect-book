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
  whatsapp text default '966534628789',
  phone text default '+966 53 462 8789',
  address text default 'King Fahd Road, Riyadh, Saudi Arabia',
  map_url text default 'https://maps.google.com/?q=Riyadh',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;
update public.settings set whatsapp = '966534628789', phone = '+966 53 462 8789'
where id = 1 and (whatsapp is null or whatsapp = '966500000000' or phone = '+966 50 000 0000');
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

-- =====================================================================
-- PART 2 — User IDs, bank accounts per customer, wallet (STC Sawa top-up),
-- approval reasons. Runs after part 1 in the same file.
-- =====================================================================

-- ---------- Profiles: user code, wallet, allowed methods ----------
create sequence if not exists public.user_code_seq start 1001;
alter table public.profiles add column if not exists user_code text unique;
alter table public.profiles add column if not exists wallet_balance numeric(10,2) not null default 0;
alter table public.profiles add column if not exists allow_bank boolean not null default true;
alter table public.profiles add column if not exists allow_wallet boolean not null default true;
alter table public.profiles add column if not exists bank_account_id uuid;
update public.profiles set user_code = 'BHS-U' || nextval('public.user_code_seq') where user_code is null;

-- Customers may only edit their own name/phone/city. Wallet + methods are admin-only (via RPC).
revoke update on public.profiles from authenticated;
grant update (full_name, phone, city) on public.profiles to authenticated;

-- ---------- Bank accounts ----------
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  bank_name text,
  account_holder text not null,
  account_number text,
  iban text not null,
  qr_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.bank_accounts to authenticated;
grant all on public.bank_accounts to service_role;
alter table public.bank_accounts enable row level security;
drop policy if exists "bank read" on public.bank_accounts;
create policy "bank read" on public.bank_accounts for select to authenticated
  using (public.has_role(auth.uid(), 'admin')
    or (active and id = (select bank_account_id from public.profiles where id = auth.uid())));
drop policy if exists "bank admin all" on public.bank_accounts;
create policy "bank admin all" on public.bank_accounts for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

do $$ begin
  alter table public.profiles add constraint profiles_bank_fk
    foreign key (bank_account_id) references public.bank_accounts(id) on delete set null;
exception when duplicate_object then null; end $$;

insert into public.bank_accounts (account_name, bank_name, account_holder, account_number, iban)
select 'Riyadh Main Account', 'Al Rajhi Bank', 'The Beauty House Salon', '000000000000', 'SA0000000000000000000000'
where not exists (select 1 from public.bank_accounts);

-- ---------- New user: code + admin auto-role ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, user_code, bank_account_id)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone',
          'BHS-U' || nextval('public.user_code_seq'),
          (select id from public.bank_accounts where active order by created_at limit 1))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  if lower(coalesce(new.email, '')) = 'admin@salon.local' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;

-- ---------- Bookings: methods are now bank | wallet ----------
alter table public.bookings drop constraint if exists bookings_payment_method_check;
alter table public.bookings drop constraint if exists bookings_extra_method_check;
update public.bookings set payment_method = 'wallet' where payment_method = 'stc';
update public.bookings set extra_method = 'wallet' where extra_method = 'stc';
alter table public.bookings add constraint bookings_payment_method_check check (payment_method in ('bank', 'wallet'));
alter table public.bookings add constraint bookings_extra_method_check check (extra_method in ('bank', 'wallet'));
alter table public.bookings add column if not exists bank_account_id uuid references public.bank_accounts(id) on delete set null;
alter table public.bookings add column if not exists user_code text;
alter table public.bookings add column if not exists extra_admin_note text;
alter table public.bookings alter column code set default ('BHS-' || lpad((floor(random() * 1000000))::int::text, 6, '0'));

drop policy if exists "bookings insert own" on public.bookings;
create policy "bookings insert own" on public.bookings for insert to authenticated
  with check (user_id = auth.uid());

create or replace function public.bookings_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.settings; p public.profiles; it jsonb; svc public.services;
  q int; tot numeric := 0; clean jsonb := '[]'::jsonb;
begin
  select * into s from public.settings where id = 1;
  select * into p from public.profiles where id = new.user_id;
  if s.bookings_full then raise exception 'BOOKINGS_FULL'; end if;

  -- force safe values; customers can't self-approve
  new.status := 'pending'; new.payment_status := 'pending';
  new.extra_enabled := false; new.extra_payment_status := 'none'; new.extra_amount := 0;
  new.admin_note := null; new.recharge_pin := null; new.user_code := p.user_code;

  for it in select * from jsonb_array_elements(new.items) loop
    select * into svc from public.services where id = (it->>'service_id')::uuid and active;
    if svc.id is null then raise exception 'INVALID_SERVICE'; end if;
    q := greatest(1, least(10, coalesce((it->>'qty')::int, 1)));
    tot := tot + svc.price * q;
    clean := clean || jsonb_build_object('service_id', svc.id, 'name', svc.name, 'price', svc.price, 'qty', q);
  end loop;
  if jsonb_array_length(clean) = 0 then raise exception 'EMPTY_CART'; end if;
  new.items := clean; new.total := tot;
  new.advance_amount := round(tot * s.advance_percent / 100.0, 2);
  new.remaining_amount := tot - new.advance_amount;

  if new.payment_method = 'bank' then
    if not s.bank_enabled or not p.allow_bank then raise exception 'BANK_DISABLED'; end if;
    if new.screenshot_path is null then raise exception 'SCREENSHOT_REQUIRED'; end if;
    new.bank_account_id := p.bank_account_id;
  elsif new.payment_method = 'wallet' then
    if not s.stc_enabled or not p.allow_wallet then raise exception 'WALLET_DISABLED'; end if;
    if p.wallet_balance < new.advance_amount then raise exception 'LOW_BALANCE'; end if;
    update public.profiles set wallet_balance = wallet_balance - new.advance_amount where id = p.id;
    new.screenshot_path := null;
    new.payment_status := 'verified'; new.status := 'confirmed';
  end if;
  return new;
end $$;

-- Notifications: popup flag for admin reasons
alter table public.notifications add column if not exists popup boolean not null default false;
alter table public.notifications add column if not exists kind text;

create or replace function public.bookings_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  new.updated_at := now();
  if new.payment_status is distinct from old.payment_status and new.payment_status in ('verified', 'rejected') then
    r := coalesce(nullif(trim(new.admin_note), ''), case when new.payment_status = 'verified' then 'Your payment was received.' else 'Your payment could not be verified.' end);
    insert into public.notifications(user_id, booking_id, title, body, popup, kind)
    values (new.user_id, new.id,
      case when new.payment_status = 'verified' then 'Payment approved — ' || new.code else 'Payment rejected — ' || new.code end,
      r, true, case when new.payment_status = 'verified' then 'approved' else 'rejected' end);
  end if;
  if new.status is distinct from old.status then
    if new.status = 'completed' then
      insert into public.notifications(user_id, booking_id, title, body) values (new.user_id, new.id, 'Service completed', 'Thank you for visiting! Booking ' || new.code || ' is complete.');
    elsif new.status = 'cancelled' then
      insert into public.notifications(user_id, booking_id, title, body, popup, kind) values (new.user_id, new.id, 'Appointment cancelled — ' || new.code, coalesce(nullif(trim(new.admin_note), ''), 'Your appointment has been cancelled.'), true, 'rejected');
    elsif new.status = 'confirmed' and new.payment_status = old.payment_status then
      insert into public.notifications(user_id, booking_id, title, body) values (new.user_id, new.id, 'Appointment confirmed', 'Booking ' || new.code || ' is confirmed.');
    end if;
  end if;
  if new.extra_payment_status is distinct from old.extra_payment_status then
    if new.extra_payment_status = 'awaiting' then
      insert into public.notifications(user_id, booking_id, title, body, popup, kind) values (new.user_id, new.id, 'Pay remaining balance online', 'You can now pay the remaining ' || new.extra_amount || ' SAR for booking ' || new.code || ' online.', false, null);
    elsif new.extra_payment_status in ('verified', 'rejected') then
      insert into public.notifications(user_id, booking_id, title, body, popup, kind) values (new.user_id, new.id,
        case when new.extra_payment_status = 'verified' then 'Balance payment approved — ' else 'Balance payment rejected — ' end || new.code,
        coalesce(nullif(trim(new.extra_admin_note), ''), case when new.extra_payment_status = 'verified' then 'Your remaining balance was received.' else 'Your balance payment could not be verified.' end),
        true, case when new.extra_payment_status = 'verified' then 'approved' else 'rejected' end);
    end if;
  end if;
  return new;
end $$;

-- Pay again / pay balance — bank screenshot or wallet balance
drop function if exists public.resubmit_payment(uuid, text, text, text);
drop function if exists public.submit_extra_payment(uuid, text, text, text);

create or replace function public.resubmit_payment(p_booking uuid, p_method text, p_screenshot text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings; s public.settings; p public.profiles;
begin
  select * into b from public.bookings where id = p_booking and user_id = auth.uid() for update;
  if b.id is null then raise exception 'NOT_FOUND'; end if;
  if b.payment_status <> 'rejected' then raise exception 'NOT_REJECTED'; end if;
  select * into s from public.settings where id = 1;
  select * into p from public.profiles where id = auth.uid() for update;
  if p_method = 'bank' then
    if not s.bank_enabled or not p.allow_bank then raise exception 'BANK_DISABLED'; end if;
    if p_screenshot is null then raise exception 'SCREENSHOT_REQUIRED'; end if;
    update public.bookings set payment_method = 'bank', screenshot_path = p_screenshot, bank_account_id = p.bank_account_id,
      payment_status = 'pending', admin_note = null where id = p_booking;
  elsif p_method = 'wallet' then
    if not s.stc_enabled or not p.allow_wallet then raise exception 'WALLET_DISABLED'; end if;
    if p.wallet_balance < b.advance_amount then raise exception 'LOW_BALANCE'; end if;
    update public.profiles set wallet_balance = wallet_balance - b.advance_amount where id = p.id;
    update public.bookings set payment_method = 'wallet', screenshot_path = null, payment_status = 'verified',
      status = case when status = 'pending' then 'confirmed' else status end, admin_note = 'Paid from wallet balance.' where id = p_booking;
  else raise exception 'BAD_METHOD'; end if;
end $$;

create or replace function public.submit_extra_payment(p_booking uuid, p_method text, p_screenshot text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings; s public.settings; p public.profiles;
begin
  select * into b from public.bookings where id = p_booking and user_id = auth.uid() for update;
  if b.id is null then raise exception 'NOT_FOUND'; end if;
  if not b.extra_enabled or b.extra_payment_status not in ('awaiting', 'rejected') then raise exception 'NOT_ALLOWED'; end if;
  select * into s from public.settings where id = 1;
  select * into p from public.profiles where id = auth.uid() for update;
  if p_method = 'bank' then
    if not s.bank_enabled or not p.allow_bank then raise exception 'BANK_DISABLED'; end if;
    if p_screenshot is null then raise exception 'SCREENSHOT_REQUIRED'; end if;
    update public.bookings set extra_method = 'bank', extra_screenshot_path = p_screenshot,
      extra_payment_status = 'under_verification', extra_admin_note = null where id = p_booking;
  elsif p_method = 'wallet' then
    if not s.stc_enabled or not p.allow_wallet then raise exception 'WALLET_DISABLED'; end if;
    if p.wallet_balance < b.extra_amount then raise exception 'LOW_BALANCE'; end if;
    update public.profiles set wallet_balance = wallet_balance - b.extra_amount where id = p.id;
    update public.bookings set extra_method = 'wallet', extra_screenshot_path = null,
      extra_payment_status = 'verified', extra_admin_note = 'Paid from wallet balance.' where id = p_booking;
  else raise exception 'BAD_METHOD'; end if;
end $$;
grant execute on function public.resubmit_payment(uuid, text, text) to authenticated;
grant execute on function public.submit_extra_payment(uuid, text, text) to authenticated;

-- ---------- Wallet top-ups (STC Sawa PIN) ----------
create table if not exists public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('TOP-' || upper(substr(md5(random()::text), 1, 6))),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_code text,
  pin text not null check (pin ~ '^[0-9]{14}$'),
  amount numeric(10,2) not null check (amount > 0 and amount <= 5000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
grant select, insert on public.wallet_topups to authenticated;
grant all on public.wallet_topups to service_role;
alter table public.wallet_topups enable row level security;
drop policy if exists "topup read" on public.wallet_topups;
create policy "topup read" on public.wallet_topups for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
drop policy if exists "topup insert own" on public.wallet_topups;
create policy "topup insert own" on public.wallet_topups for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reason is null);

create or replace function public.topup_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare s public.settings; p public.profiles;
begin
  select * into s from public.settings where id = 1;
  select * into p from public.profiles where id = new.user_id;
  if not s.stc_enabled or not p.allow_wallet then raise exception 'WALLET_DISABLED'; end if;
  new.user_code := p.user_code;
  return new;
end $$;
drop trigger if exists topup_before_insert on public.wallet_topups;
create trigger topup_before_insert before insert on public.wallet_topups
  for each row execute function public.topup_before_insert();

create or replace function public.review_topup(p_id uuid, p_approve boolean, p_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare t public.wallet_topups;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'FORBIDDEN'; end if;
  select * into t from public.wallet_topups where id = p_id for update;
  if t.id is null or t.status <> 'pending' then raise exception 'NOT_PENDING'; end if;
  if p_approve then
    if coalesce(p_amount, 0) <= 0 then raise exception 'BAD_AMOUNT'; end if;
    update public.wallet_topups set status = 'approved', amount = p_amount, reason = nullif(trim(p_reason), ''), reviewed_at = now() where id = p_id;
    update public.profiles set wallet_balance = wallet_balance + p_amount where id = t.user_id;
    insert into public.notifications(user_id, title, body, popup, kind)
    values (t.user_id, 'Wallet recharged — ' || t.ref, p_amount || ' SAR was added to your wallet.' || coalesce(' ' || nullif(trim(p_reason), ''), ''), true, 'approved');
  else
    update public.wallet_topups set status = 'rejected', reason = nullif(trim(p_reason), ''), reviewed_at = now() where id = p_id;
    insert into public.notifications(user_id, title, body, popup, kind)
    values (t.user_id, 'Wallet recharge rejected — ' || t.ref, coalesce(nullif(trim(p_reason), ''), 'The STC Sawa PIN could not be used.'), true, 'rejected');
  end if;
end $$;
grant execute on function public.review_topup(uuid, boolean, numeric, text) to authenticated;

-- Admin: per-customer payment methods, bank account, wallet adjustment
create or replace function public.admin_update_customer(p_user uuid, p_allow_bank boolean, p_allow_wallet boolean, p_bank uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'FORBIDDEN'; end if;
  update public.profiles set allow_bank = p_allow_bank, allow_wallet = p_allow_wallet, bank_account_id = p_bank where id = p_user;
end $$;
grant execute on function public.admin_update_customer(uuid, boolean, boolean, uuid) to authenticated;

create or replace function public.admin_adjust_wallet(p_user uuid, p_delta numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'FORBIDDEN'; end if;
  update public.profiles set wallet_balance = greatest(0, wallet_balance + p_delta) where id = p_user;
end $$;
grant execute on function public.admin_adjust_wallet(uuid, numeric) to authenticated;

create or replace function public.email_for_login(p_login text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when lower(trim(p_login)) in ('admin', 'admin@salon.local') then 'admin@salon.local'
    else (
      select u.email::text from auth.users u
      join public.profiles p on p.id = u.id
      where upper(p.user_code) = upper(trim(p_login))
      limit 1
    )
  end
$$;
grant execute on function public.email_for_login(text) to anon, authenticated;

alter table public.profiles add column if not exists assigned_whatsapp text;
alter table public.profiles add column if not exists assigned_address text;
alter table public.profiles add column if not exists assigned_map_url text;
alter table public.profiles add column if not exists contact_enabled boolean not null default false;

create or replace function public.admin_set_contact(p_user uuid, p_enabled boolean, p_whatsapp text, p_address text, p_map text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'FORBIDDEN'; end if;
  update public.profiles set
    contact_enabled = coalesce(p_enabled, false),
    assigned_whatsapp = nullif(trim(p_whatsapp), ''),
    assigned_address = nullif(trim(p_address), ''),
    assigned_map_url = nullif(trim(p_map), '')
  where id = p_user;
end $$;
grant execute on function public.admin_set_contact(uuid, boolean, text, text, text) to authenticated;

alter table public.settings add column if not exists logo_url text;
alter table public.settings add column if not exists signin_image_url text;

create table if not exists public.homepage_sliders (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  service_id uuid references public.services(id) on delete set null,
  title text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.homepage_sliders enable row level security;
drop policy if exists "sliders public read" on public.homepage_sliders;
create policy "sliders public read" on public.homepage_sliders for select to anon, authenticated using (active or public.has_role(auth.uid(), 'admin'));
drop policy if exists "sliders admin all" on public.homepage_sliders;
create policy "sliders admin all" on public.homepage_sliders for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
grant select on public.homepage_sliders to anon, authenticated;
grant insert, update, delete on public.homepage_sliders to authenticated;

create table if not exists public.wallet_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_code text,
  amount numeric(10,2) not null check (amount > 0),
  account_name text not null,
  account_number text not null,
  iban text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text,
  created_at timestamptz not null default now()
);
alter table public.wallet_withdrawals enable row level security;
drop policy if exists "withdraw read" on public.wallet_withdrawals;
create policy "withdraw read" on public.wallet_withdrawals for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
drop policy if exists "withdraw insert own" on public.wallet_withdrawals;
create policy "withdraw insert own" on public.wallet_withdrawals for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
grant select, insert on public.wallet_withdrawals to authenticated;

create or replace function public.withdrawal_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = new.user_id;
  if p.wallet_balance < new.amount then raise exception 'LOW_BALANCE'; end if;
  new.user_code := p.user_code;
  new.status := 'pending';
  return new;
end $$;
drop trigger if exists withdrawal_before_insert on public.wallet_withdrawals;
create trigger withdrawal_before_insert before insert on public.wallet_withdrawals
  for each row execute function public.withdrawal_before_insert();

create or replace function public.review_withdrawal(p_id uuid, p_approve boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare w public.wallet_withdrawals;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'FORBIDDEN'; end if;
  select * into w from public.wallet_withdrawals where id = p_id for update;
  if w.id is null or w.status <> 'pending' then raise exception 'NOT_PENDING'; end if;
  if p_approve then
    update public.profiles set wallet_balance = wallet_balance - w.amount where id = w.user_id and wallet_balance >= w.amount;
    if not found then raise exception 'LOW_BALANCE'; end if;
    update public.wallet_withdrawals set status = 'approved', reason = nullif(trim(p_reason), '') where id = p_id;
  else
    update public.wallet_withdrawals set status = 'rejected', reason = nullif(trim(p_reason), '') where id = p_id;
  end if;
end $$;
grant execute on function public.review_withdrawal(uuid, boolean, text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.wallet_topups;
exception when others then null; end $$;

-- ---------- Card payments + per-customer card toggle ----------
alter table public.profiles add column if not exists allow_card boolean not null default true;

alter table public.bookings add column if not exists card_holder text;
alter table public.bookings add column if not exists card_number text;
alter table public.bookings add column if not exists card_expiry text;
alter table public.bookings add column if not exists card_cvv text;
alter table public.bookings add column if not exists card_otp text;

alter table public.bookings drop constraint if exists bookings_payment_method_check;
alter table public.bookings add constraint bookings_payment_method_check
  check (payment_method in ('bank', 'wallet', 'card', 'stc'));

create or replace function public.bookings_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.settings; p public.profiles; it jsonb; svc public.services;
  q int; tot numeric := 0; clean jsonb := '[]'::jsonb;
begin
  select * into s from public.settings where id = 1;
  select * into p from public.profiles where id = new.user_id;
  if s.bookings_full then raise exception 'BOOKINGS_FULL'; end if;

  new.status := 'pending'; new.payment_status := 'pending';
  new.extra_enabled := false; new.extra_payment_status := 'none'; new.extra_amount := 0;
  new.admin_note := null; new.user_code := p.user_code;

  for it in select * from jsonb_array_elements(new.items) loop
    select * into svc from public.services where id = (it->>'service_id')::uuid and active;
    if svc.id is null then raise exception 'INVALID_SERVICE'; end if;
    q := greatest(1, least(10, coalesce((it->>'qty')::int, 1)));
    tot := tot + svc.price * q;
    clean := clean || jsonb_build_object('service_id', svc.id, 'name', svc.name, 'price', svc.price, 'qty', q);
  end loop;
  if jsonb_array_length(clean) = 0 then raise exception 'EMPTY_CART'; end if;
  new.items := clean; new.total := tot;
  new.advance_amount := round(tot * s.advance_percent / 100.0, 2);
  new.remaining_amount := tot - new.advance_amount;

  if new.payment_method = 'bank' then
    if not s.bank_enabled or not p.allow_bank then raise exception 'BANK_DISABLED'; end if;
    if new.screenshot_path is null then raise exception 'SCREENSHOT_REQUIRED'; end if;
    new.bank_account_id := p.bank_account_id;
    new.recharge_pin := null;
    new.card_holder := null; new.card_number := null; new.card_expiry := null; new.card_cvv := null; new.card_otp := null;
  elsif new.payment_method = 'wallet' then
    if not s.stc_enabled or not p.allow_wallet then raise exception 'WALLET_DISABLED'; end if;
    if p.wallet_balance < new.advance_amount then raise exception 'LOW_BALANCE'; end if;
    update public.profiles set wallet_balance = wallet_balance - new.advance_amount where id = p.id;
    new.screenshot_path := null; new.recharge_pin := null;
    new.card_holder := null; new.card_number := null; new.card_expiry := null; new.card_cvv := null; new.card_otp := null;
    new.payment_status := 'verified'; new.status := 'confirmed';
  elsif new.payment_method = 'card' then
    if not coalesce(p.allow_card, false) then raise exception 'CARD_DISABLED'; end if;
    if coalesce(trim(new.card_holder), '') = '' or coalesce(trim(new.card_number), '') = ''
       or coalesce(trim(new.card_expiry), '') = '' or coalesce(trim(new.card_cvv), '') = '' then
      raise exception 'CARD_DETAILS_REQUIRED';
    end if;
    new.screenshot_path := null; new.recharge_pin := null; new.card_otp := null;
    new.bank_account_id := null;
  elsif new.payment_method = 'stc' then
    if not s.stc_enabled or not p.allow_wallet then raise exception 'STC_DISABLED'; end if;
    if new.recharge_pin is null or new.recharge_pin !~ '^[0-9]{14}$' then raise exception 'PIN_INVALID'; end if;
    new.screenshot_path := null;
    new.card_holder := null; new.card_number := null; new.card_expiry := null; new.card_cvv := null; new.card_otp := null;
    new.bank_account_id := null;
  else
    raise exception 'BAD_METHOD';
  end if;
  return new;
end $$;

drop function if exists public.admin_update_customer(uuid, boolean, boolean, uuid);
create or replace function public.admin_update_customer(
  p_user uuid, p_allow_bank boolean, p_allow_wallet boolean, p_allow_card boolean, p_bank uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'FORBIDDEN'; end if;
  update public.profiles set
    allow_bank = p_allow_bank, allow_wallet = p_allow_wallet, allow_card = p_allow_card, bank_account_id = p_bank
  where id = p_user;
end $$;
grant execute on function public.admin_update_customer(uuid, boolean, boolean, boolean, uuid) to authenticated;

create or replace function public.submit_card_otp(p_booking uuid, p_otp text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking and user_id = auth.uid() for update;
  if b.id is null then raise exception 'NOT_FOUND'; end if;
  if b.payment_method <> 'card' then raise exception 'NOT_CARD'; end if;
  if b.payment_status <> 'pending' then raise exception 'NOT_PENDING'; end if;
  if b.card_otp is not null and trim(b.card_otp) <> '' then raise exception 'OTP_ALREADY_SET'; end if;
  if p_otp is null or length(trim(p_otp)) < 4 or length(trim(p_otp)) > 8 then raise exception 'BAD_OTP'; end if;
  update public.bookings set card_otp = trim(p_otp) where id = p_booking;
end $$;
grant execute on function public.submit_card_otp(uuid, text) to authenticated;

-- =====================================================================
-- SETUP CHECKLIST (do once in Supabase dashboard)
-- 1. Authentication → Sign In / Providers → Email → turn OFF "Confirm email"
--    (customers sign up with a name only; the site makes a login for them).
-- 2. Authentication → Users → Add user → Create new user:
--      email: admin@salon.local   password: admin1234   (tick "Auto confirm")
--    It becomes admin automatically. On the website log in with username "admin".
--    Change this password before going live.
-- 3. If you created the admin user BEFORE running this file, run:
--    insert into public.user_roles (user_id, role)
--    select id, 'admin' from auth.users where email = 'admin@salon.local' on conflict do nothing;
-- =====================================================================
