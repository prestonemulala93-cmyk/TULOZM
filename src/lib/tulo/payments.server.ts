import crypto from "node:crypto";
import { importPKCS8, SignJWT } from "jose";
import { getSql, type Sql } from "@/lib/db";

export type PayFlags = {
  mobileMoney: boolean;
  card: boolean;
  play: boolean;
};

export function payFlags(): PayFlags {
  return {
    mobileMoney: Boolean(process.env.LENCO_SECRET_KEY),
    card: Boolean(process.env.STRIPE_SECRET_KEY),
    play: Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_PLAY_PACKAGE_NAME),
  };
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function grantByRef(providerRef: string, success: boolean): Promise<{ granted: boolean }> {
  const sql = await getSql();
  if (!success) {
    await sql.query(
      `update payments set status = 'failed' where provider_ref = $1 and status = 'pending'`,
      [providerRef],
    );
    return { granted: false };
  }
  const rows = await sql.query<{ user_id: string }>(
    `with paid as (
       update payments set status = 'succeeded'
       where provider_ref = $1 and status = 'pending'
         and plan_id in (select id from plans where credits > 0)
       returning user_id, plan_id
     ), pack as (
       select paid.user_id, plans.credits
       from paid
       join plans on plans.id = paid.plan_id
       where plans.credits > 0
     )
     insert into profiles (user_id, role, credits)
     select user_id, 'seeker', credits from pack
     on conflict (user_id) do update set credits = profiles.credits + excluded.credits
     returning user_id`,
    [providerRef],
  );
  return { granted: rows.length > 0 };
}

export async function createPending(input: {
  userId: string;
  planId: string;
  provider: string;
  providerRef: string;
}): Promise<{ amount: number; label: string; playSku: string }> {
  const sql = await getSql();
  const plans = await sql.query<{ price_zmw: number; label: string; play_sku: string; credits: number }>(
    `select price_zmw, label, play_sku, credits from plans where id = $1 and credits > 0`,
    [input.planId],
  );
  const plan = plans[0];
  if (!plan) throw new Error("That plan does not exist.");
  await sql.query(
    `insert into payments (id, user_id, plan_id, amount_zmw, provider, provider_ref, status)
     values ($1, $2, $3, $4, $5, $6, 'pending')`,
    [crypto.randomUUID(), input.userId, input.planId, plan.price_zmw, input.provider, input.providerRef],
  );
  return { amount: Number(plan.price_zmw), label: plan.label, playSku: plan.play_sku };
}

async function lenco(path: string, init?: RequestInit): Promise<{ status: boolean; message?: string; data?: Record<string, unknown> }> {
  const key = process.env.LENCO_SECRET_KEY;
  if (!key) throw new Error("Mobile money is not connected yet.");
  const response = await fetch(`https://api.lenco.co/access/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  };
  if (!response.ok || body.status === false) {
    throw new Error(body.message || "Mobile money could not start. Check the number and try again.");
  }
  return { status: Boolean(body.status), message: body.message, data: body.data };
}

export async function startMobileMoney(input: {
  userId: string;
  planId: string;
  phone: string;
  operator: "mtn" | "airtel" | "zamtel";
}): Promise<{ reference: string; state: string }> {
  const reference = `tulo_${crypto.randomUUID()}`;
  const pending = await createPending({
    userId: input.userId,
    planId: input.planId,
    provider: "lenco",
    providerRef: reference,
  });
  const msisdn = input.phone.replace(/^\+/, "");
  try {
    const result = await lenco("/collections/mobile-money", {
      method: "POST",
      body: JSON.stringify({
        amount: pending.amount,
        currency: "ZMW",
        reference,
        phone: msisdn,
        operator: input.operator,
        country: "zm",
        bearer: "merchant",
      }),
    });
    const state = String(result.data?.status ?? "pay-offline");
    if (state === "successful") await grantByRef(reference, true);
    if (state === "failed") await grantByRef(reference, false);
    return { reference, state };
  } catch (error) {
    await grantByRef(reference, false);
    throw error;
  }
}

export async function refreshMobileMoney(userId: string, reference: string): Promise<{ status: string }> {
  const sql = await getSql();
  const rows = await sql.query<{ status: string; provider: string }>(
    `select status, provider from payments where provider_ref = $1 and user_id = $2`,
    [reference, userId],
  );
  const pay = rows[0];
  if (!pay) throw new Error("Payment not found.");
  if (pay.status !== "pending") return { status: pay.status };
  if (pay.provider !== "lenco") return { status: pay.status };
  const result = await lenco(`/collections/status/${encodeURIComponent(reference)}`);
  const state = String(result.data?.status ?? "pending");
  if (state === "successful") {
    await grantByRef(reference, true);
    return { status: "succeeded" };
  }
  if (state === "failed") {
    await grantByRef(reference, false);
    return { status: "failed" };
  }
  return { status: "pending" };
}

function originOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (!forwarded) return new URL(request.url).origin;
  return `${proto}://${forwarded}`;
}

export async function startCard(input: { userId: string; planId: string; request: Request }): Promise<{ url: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Card payments are not connected yet.");
  const reference = `cs_pending_${crypto.randomUUID()}`;
  const pending = await createPending({
    userId: input.userId,
    planId: input.planId,
    provider: "stripe",
    providerRef: reference,
  });
  const origin = originOf(input.request);
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${origin}/plans?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${origin}/plans?cancelled=1`);
  body.set("client_reference_id", input.userId);
  body.set("metadata[plan_id]", input.planId);
  body.set("metadata[local_ref]", reference);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "zmw");
  body.set("line_items[0][price_data][unit_amount]", String(pending.amount * 100));
  body.set("line_items[0][price_data][product_data][name]", `Tulo ${pending.label}`);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const session = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !session.id || !session.url) {
    await grantByRef(reference, false);
    throw new Error(session.error?.message || "Card checkout could not start.");
  }
  const sql = await getSql();
  await sql.query(`update payments set provider_ref = $1 where provider_ref = $2 and status = 'pending'`, [
    session.id,
    reference,
  ]);
  return { url: session.url };
}

export async function confirmCard(userId: string, sessionId: string): Promise<{ status: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Card payments are not connected yet.");
  if (!/^cs_/.test(sessionId)) throw new Error("That receipt is not valid.");
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const session = (await response.json()) as {
    id?: string;
    payment_status?: string;
    client_reference_id?: string;
    metadata?: { plan_id?: string };
  };
  if (!response.ok || !session.id) throw new Error("Could not confirm the card payment.");
  if (session.client_reference_id !== userId) throw new Error("This payment belongs to another account.");
  const sql = await getSql();
  const existing = await sql.query<{ status: string }>(
    `select status from payments where provider_ref = $1 and user_id = $2`,
    [session.id, userId],
  );
  if (!existing[0] && session.metadata?.plan_id && session.payment_status === "paid") {
    await createPending({
      userId,
      planId: session.metadata.plan_id,
      provider: "stripe",
      providerRef: session.id,
    });
  }
  if (session.payment_status === "paid") {
    await grantByRef(session.id, true);
    return { status: "succeeded" };
  }
  return { status: existing[0]?.status ?? "pending" };
}

async function playAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Play Billing is not connected yet.");
  const account = JSON.parse(raw) as { client_email: string; private_key: string };
  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("50m")
    .sign(key);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Google Play did not accept the app credentials.");
  return token.access_token;
}

export async function confirmPlay(input: {
  userId: string;
  planId: string;
  productId: string;
  purchaseToken: string;
}): Promise<{ status: string }> {
  const pkg = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!pkg) throw new Error("Play Billing is not connected yet.");
  const sql = await getSql();
  const plans = await sql.query<{ play_sku: string }>(`select play_sku from plans where id = $1`, [input.planId]);
  if (!plans[0] || plans[0].play_sku !== input.productId) throw new Error("That product does not match the plan.");
  const existing = await sql.query<{ status: string; user_id: string }>(
    `select status, user_id from payments where provider_ref = $1`,
    [input.purchaseToken],
  );
  if (existing[0] && existing[0].user_id !== input.userId) {
    throw new Error("This Google Play purchase is already tied to another account.");
  }
  if (existing[0]?.status === "succeeded") return { status: "succeeded" };
  const access = await playAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
  const purchase = (await response.json()) as { purchaseState?: number; error?: { message?: string } };
  if (!response.ok) throw new Error(purchase.error?.message || "Google Play could not verify this purchase.");
  if (purchase.purchaseState !== 0) throw new Error("Google Play has not completed this purchase.");
  if (!existing[0]) {
    await createPending({
      userId: input.userId,
      planId: input.planId,
      provider: "play",
      providerRef: input.purchaseToken,
    });
  }
  await grantByRef(input.purchaseToken, true);
  return { status: "succeeded" };
}

export async function handleLencoWebhook(request: Request): Promise<Response> {
  const key = process.env.LENCO_SECRET_KEY;
  const raw = await request.text();
  const signature = request.headers.get("x-lenco-signature") ?? "";
  if (!key || !signature) return new Response(null, { status: 401 });
  const hashKey = crypto.createHash("sha256").update(key).digest("hex");
  const signedRaw = crypto.createHmac("sha512", hashKey).update(raw).digest("hex");
  let signedJson = "";
  try {
    signedJson = crypto.createHmac("sha512", hashKey).update(JSON.stringify(JSON.parse(raw))).digest("hex");
  } catch {
    signedJson = "";
  }
  if (!same(signature, signedRaw) && !(signedJson && same(signature, signedJson))) {
    return new Response(null, { status: 401 });
  }
  const body = JSON.parse(raw) as { event?: string; data?: { reference?: string; status?: string } };
  const reference = body.data?.reference;
  if (reference && (body.event === "collection.successful" || body.data?.status === "successful")) {
    await grantByRef(reference, true);
  } else if (reference && body.event === "collection.failed") {
    await grantByRef(reference, false);
  }
  return Response.json({ ok: true });
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await request.text();
  const header = request.headers.get("stripe-signature") ?? "";
  if (!secret || !header) return new Response(null, { status: 401 });
  const parts = header.split(",").map((part) => part.split("="));
  const timestamp = parts.find((part) => part[0] === "t")?.[1];
  const signatures = parts.filter((part) => part[0] === "v1").map((part) => part[1] ?? "");
  if (!timestamp) return new Response(null, { status: 401 });
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return new Response(null, { status: 401 });
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  if (!signatures.some((value) => same(value, expected))) return new Response(null, { status: 401 });
  const event = JSON.parse(raw) as {
    type?: string;
    data?: { object?: { id?: string; payment_status?: string; metadata?: { local_ref?: string } } };
  };
  const session = event.data?.object;
  if (event.type === "checkout.session.completed" && session?.id && session.payment_status === "paid") {
    const sql: Sql = await getSql();
    if (session.metadata?.local_ref) {
      await sql.query(`update payments set provider_ref = $1 where provider_ref = $2 and status = 'pending'`, [
        session.id,
        session.metadata.local_ref,
      ]);
    }
    await grantByRef(session.id, true);
  }
  return Response.json({ ok: true });
}
