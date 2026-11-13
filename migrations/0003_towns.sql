insert into listings (
  id, landlord_id, type, title, description, price_zmw, area, near_campus, amenities,
  contact_phone, status, verified, sample, cover_path
)
select * from (values
  (
    '55555555-5555-4555-8555-555555555555', 'sample', 'room',
    'Room in Nkana East, Kitwe',
    'Sample listing so the catalogue is not empty. This is not a real landlord.',
    1100, 'Kitwe', 'CBU', '{water,electricity,wifi}'::text[],
    '+260970000105', 'active', true, true, '/samples/room.jpg'
  ),
  (
    '66666666-6666-4666-8666-666666666666', 'sample', 'house',
    'Two-bedroom house in Kansenshi, Ndola',
    'Sample listing so the catalogue is not empty. This is not a real landlord.',
    4000, 'Ndola', null, '{water,electricity,security,parking}'::text[],
    '+260970000106', 'active', true, true, '/samples/house.jpg'
  ),
  (
    '77777777-7777-4777-8777-777777777777', 'sample', 'boarding_house',
    'Boarding house bed in Livingstone',
    'Sample listing so the catalogue is not empty. This is not a real landlord.',
    800, 'Livingstone', null, '{water,electricity}'::text[],
    '+260970000107', 'active', false, true, '/samples/boarding.jpg'
  ),
  (
    '88888888-8888-4888-8888-888888888888', 'sample', 'room',
    'Self-contained room in Chipata',
    'Sample listing so the catalogue is not empty. This is not a real landlord.',
    700, 'Chipata', null, '{water,electricity,own_bathroom}'::text[],
    '+260970000108', 'active', true, true, '/samples/campus.jpg'
  )
) as seed (
  id, landlord_id, type, title, description, price_zmw, area, near_campus, amenities,
  contact_phone, status, verified, sample, cover_path
)
where not exists (select 1 from listings where listings.id = seed.id);
