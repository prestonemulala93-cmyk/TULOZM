create table if not exists profiles (
  user_id text primary key,
  role text not null default 'seeker' check (role in ('seeker', 'landlord')),
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists listings (
  id text primary key,
  landlord_id text not null,
  type text not null check (type in ('room', 'boarding_house', 'house')),
  title text not null,
  description text not null default '',
  price_zmw integer not null check (price_zmw > 0 and price_zmw <= 1000000),
  area text not null,
  near_campus text,
  amenities text[] not null default '{}',
  contact_phone text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'rented', 'rejected')),
  verified boolean not null default false,
  sample boolean not null default false,
  cover_path text,
  created_at timestamptz not null default now()
);

create index if not exists listings_browse_idx on listings (status, verified, created_at desc);

create table if not exists photos (
  id text primary key,
  listing_id text not null references listings (id) on delete cascade,
  data text not null,
  position integer not null default 0
);

create table if not exists plans (
  id text primary key,
  label text not null,
  price_zmw integer not null,
  duration_days integer not null,
  play_sku text not null
);

insert into plans (id, label, price_zmw, duration_days, play_sku) values
  ('week', '1 week', 50, 7, 'tulo_week'),
  ('month', '1 month', 150, 30, 'tulo_month'),
  ('year', '1 year', 1200, 365, 'tulo_year')
on conflict (id) do nothing;

create table if not exists payments (
  id text primary key,
  user_id text not null,
  plan_id text not null references plans (id),
  amount_zmw integer not null,
  provider text not null,
  provider_ref text not null unique,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id text primary key,
  user_id text not null,
  payment_id text unique references payments (id),
  starts_at timestamptz not null,
  expires_at timestamptz not null
);

create index if not exists subscriptions_user_idx on subscriptions (user_id, expires_at);

create table if not exists contact_unlocks (
  user_id text not null,
  listing_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists reports (
  id text primary key,
  listing_id text not null,
  user_id text not null,
  reason text not null,
  credited boolean not null default false,
  created_at timestamptz not null default now(),
  unique (listing_id, user_id)
);

insert into listings (
  id, landlord_id, type, title, description, price_zmw, area, near_campus, amenities,
  contact_phone, status, verified, sample, cover_path
)
select * from (values
  (
    '11111111-1111-4111-8111-111111111111', 'sample', 'room',
    'Self-contained room in Kalingalinga',
    'Sample listing so the catalogue is not empty. This is not a real landlord.',
    1200, 'Kalingalinga', null, '{water,electricity,own_bathroom}'::text[],
    '+260970000101', 'active', true, true, '/samples/room.jpg'
  ),
  (
    '22222222-2222-4222-8222-222222222222', 'sample', 'house',
    'Two-bedroom house in Woodlands',
    'Sample listing so the catalogue is not empty. This is not a real landlord.',
    6500, 'Woodlands', null, '{water,electricity,security,parking}'::text[],
    '+260970000102', 'active', true, true, '/samples/house.jpg'
  ),
  (
    '33333333-3333-4333-8333-333333333333', 'sample', 'boarding_house',
    'Boarding house room in Chelstone',
    'Sample listing so the catalogue is not empty. This is not a real landlord.',
    900, 'Chelstone', null, '{water,electricity,security}'::text[],
    '+260970000103', 'active', false, true, '/samples/boarding.jpg'
  ),
  (
    '44444444-4444-4444-8444-444444444444', 'sample', 'room',
    'Student room near UNZA',
    'Sample listing so the catalogue is not empty. This is not a real landlord.',
    1500, 'Roma', 'UNZA', '{water,electricity,wifi,furnished}'::text[],
    '+260970000104', 'active', false, true, '/samples/campus.jpg'
  )
) as seed (
  id, landlord_id, type, title, description, price_zmw, area, near_campus, amenities,
  contact_phone, status, verified, sample, cover_path
)
where not exists (select 1 from listings where listings.id = seed.id);
