import { Link } from "@tanstack/react-router";
import { AMENITY_LABEL, coverSrc, kwacha, postedAgo, typeLabel, type Listing } from "@/lib/tulo/format";
import { House } from "lucide-react";

export function ListingCard({ listing }: { listing: Listing }) {
  const src = coverSrc(listing);
  return (
    <Link
      to="/listing/$id"
      params={{ id: listing.id }}
      className="block overflow-hidden rounded-card border border-line bg-surface active:opacity-90"
    >
      <div className="relative aspect-[4/3] bg-line">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-green">
            <House size={40} />
          </div>
        )}
        <span className="absolute bottom-3 left-3 rounded-lg bg-deep px-2 py-1 font-display text-lg font-extrabold text-foam">
          {kwacha(listing.price_zmw)}
          <span className="ml-1 text-xs font-semibold opacity-80">/mo</span>
        </span>
        {listing.verified ? (
          <span className="absolute top-3 left-3 rounded-full bg-amber px-2 py-1 text-xs font-bold text-amber-ink">Verified</span>
        ) : null}
        {listing.sample ? (
          <span className="absolute top-3 right-3 rounded-full bg-deep px-2 py-1 text-xs font-bold text-foam">Sample</span>
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <h3 className="font-display text-lg font-extrabold">{listing.title}</h3>
        <p className="text-sm text-muted">
          {listing.area}
          {listing.near_campus ? `, near ${listing.near_campus}` : ""}
        </p>
        <p className="text-sm text-muted">{postedAgo(listing.created_at)}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="rounded bg-paper px-2 py-0.5 text-sm text-deep">{typeLabel(listing.type)}</span>
          {listing.amenities.slice(0, 3).map((key) => (
            <span key={key} className="rounded bg-paper px-2 py-0.5 text-sm text-deep">
              {AMENITY_LABEL[key] ?? key}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
