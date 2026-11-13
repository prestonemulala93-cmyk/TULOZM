alter table listings drop constraint if exists listings_type_check;
alter table listings add constraint listings_type_check
  check (type in ('room', 'bedspace', 'boarding_house', 'house'));

alter table plans add column if not exists credits integer not null default 0;
alter table profiles add column if not exists credits integer not null default 0;

insert into plans (id, label, price_zmw, duration_days, play_sku, credits) values
  ('pack4', '4 contacts', 20, 0, 'tulo_4', 4),
  ('pack10', '10 contacts', 50, 0, 'tulo_10', 10),
  ('pack30', '30 contacts', 100, 0, 'tulo_30', 30)
on conflict (id) do update set
  label = excluded.label,
  price_zmw = excluded.price_zmw,
  duration_days = excluded.duration_days,
  play_sku = excluded.play_sku,
  credits = excluded.credits;
