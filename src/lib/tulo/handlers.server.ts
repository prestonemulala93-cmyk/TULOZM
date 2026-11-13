import crypto from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { asStringArray, CAMPUSES, normPhone } from "@/lib/tulo/format";
import {
  confirmCard,
  confirmPlay,
  payFlags,
  refreshMobileMoney,
  startCard,
  startMobileMoney,
} from "@/lib/tulo/payments.server";

const AMENITY_SET = new Set(["water", "electricity", "wifi", "security", "parking", "furnished", "own_bathroom"]);

type Role = "seeker" | "landlord";

export type PublicListing = {
  id: string;
  type: string;
  title: string;
  description: string;
  price_zmw: number;
  area: string;
  near_campus: string | null;
  amenities: string[];
  verified: boolean;
  sample: boolean;
  created_at: string;
  cover_path: string | null;
  photo_ids: string[];
};

function mapListing(row: Record<string, unknown>, withDescription: boolean): PublicListing {
  return {
    id: String(row.id),
    type: String(row.type),
    title: String(row.title),
    description: withDescription ? String(row.description ?? "") : "",
    price_zmw: Number(row.price_zmw),
    area: String(row.area),
    near_campus: row.near_campus ? String(row.near_campus) : null,
    amenities: asStringArray(row.amenities),
    verified: Boolean(row.verified),
    sample: Boolean(row.sample),
    created_at: String(row.created_at),
    cover_path: row.cover_path ? String(row.cover_path) : null,
    photo_ids: asStringArray(row.photo_ids),
  };
}

const PUBLIC_COLUMNS = `id, type, title, description, price_zmw, area, near_campus, amenities, verified, sample,
  created_at::text as created_at, cover_path,
  array(select p.id from photos p where p.listing_id = listings.id order by p.position, p.id) as photo_ids`;

async function ensureProfile(userId: string): Promise<{ email: string; role: Role; phone: string | null; isAdmin: boolean }> {
  const sql = await getSql();
  const users = await sql.query<{ email: string }>(`select email from "user" where id = $1`, [userId]);
  const email = users[0]?.email ?? "";
  await sql.query(
    `insert into profiles (user_id, role) values ($1, 'seeker') on conflict (user_id) do nothing`,
    [userId],
  );
  const profiles = await sql.query<{ role: string; phone: string | null; is_admin: boolean }>(
    `select role, phone, is_admin from profiles where user_id = $1`,
    [userId],
  );
  const allow = (process.env.TULO_ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const role: Role = profiles[0]?.role === "landlord" ? "landlord" : "seeker";
  const isAdmin = Boolean(profiles[0]?.is_admin) || allow.includes(email.toLowerCase());
  return { email, role, phone: profiles[0]?.phone ?? null, isAdmin };
}

export async function claimAdmin(userId: string) {
  const allow = (process.env.TULO_ADMIN_EMAILS || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (allow.length) throw new Error("Admin emails are already set on the server.");
  const sql = await getSql();
  await ensureProfile(userId);
  const rows = await sql.query<{ user_id: string }>(
    `update profiles set is_admin = true
     where user_id = $1 and not exists (select 1 from profiles where is_admin)
     returning user_id`,
    [userId],
  );
  if (!rows.length) throw new Error("An admin account already exists.");
  return readMe(userId);
}

async function creditBalance(userId: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql.query<{ credits: number }>(
    `select credits from profiles where user_id = $1`,
    [userId],
  );
  return Number(rows[0]?.credits ?? 0);
}

export async function readMe(userId: string) {
  const profile = await ensureProfile(userId);
  const sql = await getSql();
  const existing = await sql.query<{ n: number }>(`select count(*)::int as n from profiles where is_admin`);
  const envAdmins = (process.env.TULO_ADMIN_EMAILS || "").split(",").some((item) => item.trim());
  const canClaimAdmin = !profile.isAdmin && !envAdmins && Number(existing[0]?.n ?? 0) === 0;
  return { ...profile, expiresAt: null, credits: await creditBalance(userId), canClaimAdmin, payments: payFlags() };
}

export async function saveRole(userId: string, role: Role, phone?: string) {
  const sql = await getSql();
  await ensureProfile(userId);
  const normalized = phone?.trim() ? normPhone(phone) : null;
  await sql.query(`update profiles set role = $2, phone = coalesce($3, phone) where user_id = $1`, [
    userId,
    role,
    normalized,
  ]);
  return readMe(userId);
}

export async function removeAccount(userId: string) {
  const sql = await getSql();
  const profile = await ensureProfile(userId);
  await sql.query(
    `delete from reports where user_id = $1 or listing_id in (select id from listings where landlord_id = $1)`,
    [userId],
  );
  await sql.query(
    `delete from contact_unlocks where user_id = $1 or listing_id in (select id from listings where landlord_id = $1)`,
    [userId],
  );
  await sql.query(`delete from photos where listing_id in (select id from listings where landlord_id = $1)`, [userId]);
  await sql.query(`delete from subscriptions where user_id = $1`, [userId]);
  await sql.query(`delete from payments where user_id = $1`, [userId]);
  await sql.query(`delete from listings where landlord_id = $1`, [userId]);
  await sql.query(`delete from profiles where user_id = $1`, [userId]);
  await sql.query(`delete from "verification" where identifier = $1`, [profile.email]);
  await sql.query(`delete from "session" where "userId" = $1`, [userId]);
  await sql.query(`delete from "account" where "userId" = $1`, [userId]);
  await sql.query(`delete from "user" where id = $1`, [userId]);
  return { ok: true };
}

export async function browseListings(filters: {
  area?: string;
  campus?: string;
  type?: string;
  maxPrice?: number;
  amenities?: string[];
  limit?: number;
}) {
  const sql = await getSql();
  const amenities = (filters.amenities ?? []).filter((item) => AMENITY_SET.has(item));
  const rows = await sql.query<Record<string, unknown>>(
    `select ${PUBLIC_COLUMNS} from listings
     where status = 'active'
       and ($1::text is null or area ilike $1)
       and ($2::text is null or near_campus ilike $2)
       and ($3::text is null or type = $3)
       and ($4::int is null or price_zmw <= $4)
       and ($5::text[] is null or amenities @> $5::text[])
     order by verified desc, created_at desc
     limit $6`,
    [
      filters.area ? `%${filters.area}%` : null,
      filters.campus || null,
      filters.type || null,
      filters.maxPrice ?? null,
      amenities.length ? amenities : null,
      Math.min(filters.limit ?? 24, 50),
    ],
  );
  return rows.map((row) => mapListing(row, false));
}

export async function readListing(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select ${PUBLIC_COLUMNS} from listings where id = $1 and status = 'active'`,
    [id],
  );
  return rows[0] ? mapListing(rows[0], true) : null;
}

export async function listPlans() {
  const sql = await getSql();
  const rows = await sql.query<{
    id: string;
    label: string;
    price_zmw: number;
    play_sku: string;
    credits: number;
  }>(`select id, label, price_zmw, credits, play_sku from plans where credits > 0 order by price_zmw`);
  return {
    plans: rows.map((row) => ({
      ...row,
      price_zmw: Number(row.price_zmw),
      credits: Number(row.credits),
    })),
    payments: payFlags(),
  };
}

export async function createListing(
  userId: string,
  input: {
    type: "room" | "bedspace" | "boarding_house" | "house";
    title: string;
    description: string;
    priceZmw: number;
    area: string;
    nearCampus?: string;
    amenities: string[];
    contactPhone: string;
  },
) {
  const profile = await ensureProfile(userId);
  if (profile.role !== "landlord") throw new Error("Switch to landlord on your account before listing a place.");
  const sql = await getSql();
  const count = await sql.query<{ n: number }>(
    `select count(*)::int as n from listings where landlord_id = $1 and status in ('pending', 'active')`,
    [userId],
  );
  if (Number(count[0]?.n ?? 0) >= 30) throw new Error("You already have 30 open listings.");
  const id = crypto.randomUUID();
  const amenities = input.amenities.filter((item) => AMENITY_SET.has(item));
  const campus = input.nearCampus && (CAMPUSES as readonly string[]).includes(input.nearCampus) ? input.nearCampus : null;
  await sql.query(
    `insert into listings (id, landlord_id, type, title, description, price_zmw, area, near_campus, amenities, contact_phone, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, 'pending')`,
    [
      id,
      userId,
      input.type,
      input.title.trim(),
      input.description.trim(),
      input.priceZmw,
      input.area.trim(),
      campus,
      amenities,
      normPhone(input.contactPhone),
    ],
  );
  return { id };
}

export async function addPhoto(userId: string, listingId: string, data: string) {
  const sql = await getSql();
  const own = await sql.query(`select 1 from listings where id = $1 and landlord_id = $2`, [listingId, userId]);
  if (!own.length) throw new Error("That listing is not yours.");
  const count = await sql.query<{ n: number }>(`select count(*)::int as n from photos where listing_id = $1`, [listingId]);
  if (Number(count[0]?.n ?? 0) >= 5) throw new Error("Five photos is the limit.");
  const buf = Buffer.from(data, "base64");
  if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("Use a JPEG photo.");
  if (buf.length > 700_000) throw new Error("That photo is too large.");
  const id = crypto.randomUUID();
  await sql.query(`insert into photos (id, listing_id, data, position) values ($1, $2, $3, $4)`, [
    id,
    listingId,
    data,
    Number(count[0]?.n ?? 0),
  ]);
  return { id };
}

export async function readPhoto(id: string): Promise<Uint8Array | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sql = await getSql();
  const rows = await sql.query<{ data: string }>(`select data from photos where id = $1`, [id]);
  if (!rows[0]) return null;
  return new Uint8Array(Buffer.from(rows[0].data, "base64"));
}

export async function myListings(userId: string) {
  await ensureProfile(userId);
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select id, title, price_zmw, area, status, verified, type, created_at::text as created_at, cover_path,
      (select count(*)::int from contact_unlocks cu where cu.listing_id = listings.id) as unlocks,
      array(select p.id from photos p where p.listing_id = listings.id order by p.position) as photo_ids
     from listings where landlord_id = $1 order by created_at desc`,
    [userId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    price_zmw: Number(row.price_zmw),
    area: String(row.area),
    status: String(row.status),
    verified: Boolean(row.verified),
    type: String(row.type),
    created_at: String(row.created_at),
    cover_path: row.cover_path ? String(row.cover_path) : null,
    unlocks: Number(row.unlocks ?? 0),
    photo_ids: asStringArray(row.photo_ids),
  }));
}

export async function setMineStatus(userId: string, id: string, status: "active" | "rented") {
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    `update listings set status = $1 where id = $2 and landlord_id = $3 and status in ('active', 'rented') returning id`,
    [status, id, userId],
  );
  if (!rows.length) throw new Error("Only a live or rented listing can be switched.");
  return { ok: true };
}

export async function setPrice(userId: string, id: string, priceZmw: number) {
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    `update listings set price_zmw = $1 where id = $2 and landlord_id = $3 and status <> 'rejected' returning id`,
    [priceZmw, id, userId],
  );
  if (!rows.length) throw new Error("Could not update that price.");
  return { ok: true };
}

export async function unlockContact(userId: string, listingId: string) {
  const sql = await getSql();
  await ensureProfile(userId);
  const listing = await sql.query<{ contact_phone: string; sample: boolean }>(
    `select contact_phone, sample from listings where id = $1 and status = 'active'`,
    [listingId],
  );
  if (!listing[0]) throw new Error("That place is no longer listed.");
  if (listing[0].sample) throw new Error("This is a sample listing, not a real landlord.");
  const opened = await sql.query(
    `select 1 from contact_unlocks where user_id = $1 and listing_id = $2`,
    [userId, listingId],
  );
  if (!opened.length) {
    const spent = await sql.query(
      `with spent as (
         update profiles set credits = credits - 1
         where user_id = $1 and credits > 0
           and not exists (select 1 from contact_unlocks where user_id = $1 and listing_id = $2)
         returning user_id
       )
       insert into contact_unlocks (user_id, listing_id)
       select user_id, $2 from spent
       on conflict do nothing
       returning user_id`,
      [userId, listingId],
    );
    if (!spent.length) throw new Error("Buy contacts to see this number.");
  }
  return { contactPhone: listing[0].contact_phone };
}

export async function reportListing(userId: string, listingId: string, reason: "unreachable" | "rented" | "scam") {
  const sql = await getSql();
  const unlocked = await sql.query(`select 1 from contact_unlocks where user_id = $1 and listing_id = $2`, [
    userId,
    listingId,
  ]);
  if (!unlocked.length) throw new Error("Unlock the contact before reporting it.");
  const id = crypto.randomUUID();
  const inserted = await sql.query<{ id: string }>(
    `insert into reports (id, listing_id, user_id, reason) values ($1, $2, $3, $4)
     on conflict (listing_id, user_id) do nothing returning id`,
    [id, listingId, userId, reason],
  );
  if (!inserted.length) return { credited: false };
  const creditedCount = await sql.query<{ n: number }>(
    `select count(*)::int as n from reports where user_id = $1 and credited and created_at > now() - interval '30 days'`,
    [userId],
  );
  let credited = false;
  if (Number(creditedCount[0]?.n ?? 0) < 3) {
    const updated = await sql.query(
      `update profiles set credits = credits + 1 where user_id = $1 returning user_id`,
      [userId],
    );
    if (updated.length) {
      credited = true;
      await sql.query(`update reports set credited = true where id = $1`, [inserted[0].id]);
    }
  }
  const total = await sql.query<{ n: number }>(`select count(*)::int as n from reports where listing_id = $1`, [listingId]);
  if (Number(total[0]?.n ?? 0) >= 3) {
    await sql.query(`update listings set status = 'pending' where id = $1 and status = 'active' and sample = false`, [
      listingId,
    ]);
  }
  return { credited };
}

export async function adminQueue(userId: string) {
  const profile = await ensureProfile(userId);
  if (!profile.isAdmin) throw new Error("Admins only.");
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select ${PUBLIC_COLUMNS}, contact_phone from listings where status = 'pending' and sample = false order by created_at`,
  );
  return rows.map((row) => ({ ...mapListing(row, true), contactPhone: String(row.contact_phone) }));
}

export async function adminSetStatus(userId: string, id: string, status: "active" | "rejected", verified?: boolean) {
  const profile = await ensureProfile(userId);
  if (!profile.isAdmin) throw new Error("Admins only.");
  const sql = await getSql();
  await sql.query(`update listings set status = $1, verified = coalesce($3, verified) where id = $2 and sample = false`, [
    status,
    id,
    verified ?? null,
  ]);
  return { ok: true };
}

function rejectPlayBypass(channel: "web" | "play") {
  if (channel === "play") {
    throw new Error("Inside the Play Store app, plans are paid with Google Play.");
  }
}

export async function beginMobileMoney(
  userId: string,
  planId: string,
  phone: string,
  operator: "mtn" | "airtel" | "zamtel",
  channel: "web" | "play" = "web",
) {
  rejectPlayBypass(channel);
  await ensureProfile(userId);
  return startMobileMoney({ userId, planId, phone: normPhone(phone), operator });
}

export async function pollPayment(userId: string, reference: string) {
  return refreshMobileMoney(userId, reference);
}

export async function beginCard(userId: string, planId: string, channel: "web" | "play" = "web") {
  rejectPlayBypass(channel);
  await ensureProfile(userId);
  return startCard({ userId, planId, request: getRequest() });
}

export async function finishCard(userId: string, sessionId: string) {
  return confirmCard(userId, sessionId);
}

export async function finishPlay(userId: string, planId: string, productId: string, purchaseToken: string) {
  await ensureProfile(userId);
  return confirmPlay({ userId, planId, productId, purchaseToken });
}
