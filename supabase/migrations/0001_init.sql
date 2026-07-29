-- profiles：對應 auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  home_city text,
  home_district text,
  interests uuid[] default '{}',
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  cover_image text,
  organizer_name text,
  contact_info text,
  is_free boolean not null default true,
  fee_note text,
  city text not null,
  district text not null,
  address text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  registration_deadline timestamptz,
  capacity int,
  registration_fields jsonb not null default '{}',
  status text not null default 'draft'
    check (status in ('draft','pending','published','rejected','ended')),
  reject_reason text,
  source text not null default 'user' check (source in ('user','crawler')),
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_status_start_idx on public.events (status, start_at);

create table public.event_categories (
  event_id uuid references public.events(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  primary key (event_id, category_id)
);
