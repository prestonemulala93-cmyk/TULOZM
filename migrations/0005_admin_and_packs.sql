alter table profiles add column if not exists is_admin boolean not null default false;

update plans set label = '12 contacts', credits = 12 where id = 'pack10';
update plans set label = '26 contacts', credits = 26 where id = 'pack30';
