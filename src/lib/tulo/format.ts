export const AMENITIES = [
  ["water", "Water"],
  ["electricity", "Electricity"],
  ["wifi", "WiFi"],
  ["security", "Security"],
  ["parking", "Parking"],
  ["furnished", "Furnished"],
  ["own_bathroom", "Own bathroom"],
] as const;

export const AMENITY_LABEL: Record<string, string> = Object.fromEntries(AMENITIES);

export const CITIES = [
  "Lusaka",
  "Kitwe",
  "Ndola",
  "Kabwe",
  "Livingstone",
  "Chipata",
  "Solwezi",
  "Mongu",
  "Kasama",
  "Choma",
  "Mazabuka",
  "Mansa",
] as const;

export const CAMPUSES = [
  "UNZA",
  "CBU",
  "Mulungushi",
  "UNILUS",
  "Cavendish",
  "Mukuba",
  "Chalimbana",
  "Rusangu",
  "Nkrumah",
] as const;

export type PayFlags = { mobileMoney: boolean; card: boolean; play: boolean };

export type Me = {
  email: string;
  role: "seeker" | "landlord";
  phone: string | null;
  isAdmin: boolean;
  canClaimAdmin: boolean;
  expiresAt: string | null;
  credits: number;
  payments: PayFlags;
};

export type Listing = {
  id: string;
  type: string;
  title: string;
  description?: string;
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

export function typeLabel(type: string): string {
  if (type === "bedspace") return "Bedspace";
  if (type === "boarding_house") return "Boarding house";
  if (type === "house") return "House";
  return "Room";
}

export function kwacha(amount: number): string {
  return `K${amount.toLocaleString("en-ZM")}`;
}

export function postedAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Posted recently";
  const days = (Date.now() - then) / 86_400_000;
  if (days < 1) return "Posted today";
  if (days < 2) return "Posted yesterday";
  if (days < 30) return `Posted ${Math.floor(days)} days ago`;
  return "Posted over a month ago";
}

export function normPhone(raw: string): string {
  const compact = raw.replace(/[\s-]/g, "");
  const withCode = compact.startsWith("+260")
    ? compact
    : compact.startsWith("260")
      ? `+${compact}`
      : `+260${compact.replace(/^0/, "")}`;
  if (!/^\+260\d{9}$/.test(withCode)) {
    throw new Error("Enter a Zambian number, for example 0971234567.");
  }
  return withCode;
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((part) => part.replace(/^"|"$/g, "").trim())
        .filter(Boolean);
    }
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        return [];
      }
    }
  }
  return [];
}

export function coverSrc(listing: Pick<Listing, "cover_path" | "photo_ids">): string | null {
  if (listing.photo_ids[0]) return `/api/photos/${listing.photo_ids[0]}`;
  return listing.cover_path;
}
