import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

const amenity = z.enum(["water", "electricity", "wifi", "security", "parking", "furnished", "own_bathroom"]);
const planId = z.enum(["week", "month", "year"]);
const id = z.string().regex(/^[0-9a-f-]{36}$/i);

const browseInput = z.object({
  area: z.string().max(80).optional(),
  campus: z.string().max(40).optional(),
  type: z.enum(["room", "boarding_house", "house"]).optional(),
  maxPrice: z.number().int().positive().max(1_000_000).optional(),
  amenities: z.array(amenity).max(7).optional(),
  limit: z.number().int().positive().max(50).optional(),
});

export const getListings = createServerFn({ method: "GET" })
  .validator((input: unknown) => browseInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { browseListings } = await import("./handlers.server");
    return browseListings(data);
  });

export const getListing = createServerFn({ method: "GET" })
  .validator((listingId: string) => id.parse(listingId))
  .handler(async ({ data }) => {
    const { readListing } = await import("./handlers.server");
    return readListing(data);
  });

export const getPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { listPlans } = await import("./handlers.server");
  return listPlans();
});

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { readMe } = await import("./handlers.server");
    return readMe(context.userId);
  });

export const claimAdminAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { claimAdmin } = await import("./handlers.server");
    return claimAdmin(context.userId);
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ role: z.enum(["seeker", "landlord"]), phone: z.string().max(20).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { saveRole } = await import("./handlers.server");
    return saveRole(context.userId, data.role, data.phone);
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { removeAccount } = await import("./handlers.server");
    return removeAccount(context.userId);
  });

const listingInput = z.object({
  type: z.enum(["room", "bedspace", "boarding_house", "house"]),
  title: z.string().trim().min(5).max(80),
  description: z.string().trim().max(800),
  priceZmw: z.number().int().positive().max(1_000_000),
  area: z.string().trim().min(2).max(80),
  nearCampus: z.string().optional(),
  amenities: z.array(amenity).max(7),
  contactPhone: z.string().min(9).max(20),
});

export const postListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => listingInput.parse(input))
  .handler(async ({ context, data }) => {
    const { createListing } = await import("./handlers.server");
    return createListing(context.userId, data);
  });

export const postPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ listingId: id, data: z.string().min(100).max(900_000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { addPhoto } = await import("./handlers.server");
    return addPhoto(context.userId, data.listingId, data.data);
  });

export const getMine = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { myListings } = await import("./handlers.server");
    return myListings(context.userId);
  });

export const postMineStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id, status: z.enum(["active", "rented"]) }).parse(input))
  .handler(async ({ context, data }) => {
    const { setMineStatus } = await import("./handlers.server");
    return setMineStatus(context.userId, data.id, data.status);
  });

export const postPrice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ id, priceZmw: z.number().int().positive().max(1_000_000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { setPrice } = await import("./handlers.server");
    return setPrice(context.userId, data.id, data.priceZmw);
  });

export const postUnlock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((listingId: string) => id.parse(listingId))
  .handler(async ({ context, data }) => {
    const { unlockContact } = await import("./handlers.server");
    return unlockContact(context.userId, data);
  });

export const postReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ id, reason: z.enum(["unreachable", "rented", "scam"]) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { reportListing } = await import("./handlers.server");
    return reportListing(context.userId, data.id, data.reason);
  });

export const getAdminQueue = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { adminQueue } = await import("./handlers.server");
    return adminQueue(context.userId);
  });

export const postAdminStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ id, status: z.enum(["active", "rejected"]), verified: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { adminSetStatus } = await import("./handlers.server");
    return adminSetStatus(context.userId, data.id, data.status, data.verified);
  });

const channel = z.enum(["web", "play"]).default("web");

export const postMobileMoney = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        planId,
        phone: z.string().min(9).max(20),
        operator: z.enum(["mtn", "airtel", "zamtel"]),
        channel,
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { beginMobileMoney } = await import("./handlers.server");
    return beginMobileMoney(context.userId, data.planId, data.phone, data.operator, data.channel);
  });

export const postPollPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((reference: string) => z.string().min(8).max(80).parse(reference))
  .handler(async ({ context, data }) => {
    const { pollPayment } = await import("./handlers.server");
    return pollPayment(context.userId, data);
  });

export const postCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ planId, channel }).parse(input))
  .handler(async ({ context, data }) => {
    const { beginCard } = await import("./handlers.server");
    return beginCard(context.userId, data.planId, data.channel);
  });

export const postConfirmCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((sessionId: string) => z.string().startsWith("cs_").max(120).parse(sessionId))
  .handler(async ({ context, data }) => {
    const { finishCard } = await import("./handlers.server");
    return finishCard(context.userId, data);
  });

export const postConfirmPlay = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        planId,
        productId: z.string().min(3).max(80),
        purchaseToken: z.string().min(8).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { finishPlay } = await import("./handlers.server");
    return finishPlay(context.userId, data.planId, data.productId, data.purchaseToken);
  });
