import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getListing, postReport, postUnlock } from "@/lib/tulo/api";
import { AMENITY_LABEL, coverSrc, kwacha, postedAgo, typeLabel, type Listing } from "@/lib/tulo/format";
import { errorText, toast } from "@/lib/tulo/toast";
import { Button } from "@/components/ui";

export const Route = createFileRoute("/_app/listing/$id")({
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    let live = true;
    getListing({ data: id })
      .then((row) => {
        if (live) setListing(row);
      })
      .catch(() => {
        if (live) setListing(null);
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (listing === undefined) return <p className="text-muted">Loading…</p>;
  if (!listing) return <p className="text-muted">This place is not available.</p>;

  const images = listing.photo_ids.length
    ? listing.photo_ids.map((photoId) => `/api/photos/${photoId}`)
    : coverSrc(listing)
      ? [coverSrc(listing) as string]
      : [];
  const share = encodeURIComponent(
    `${listing.title} in ${listing.area}, ${kwacha(listing.price_zmw)} a month. See it on Tulo: ${window.location.origin}/listing/${listing.id}`,
  );

  async function unlock() {
    try {
      const result = await postUnlock({ data: id });
      setPhone(result.contactPhone);
    } catch (error) {
      const message = errorText(error);
      if (message.includes("Log in")) {
        void navigate({ to: "/login" });
        return;
      }
      if (message.includes("Buy contacts")) {
        toast(message);
        void navigate({ to: "/plans", search: { session_id: "", cancelled: "" } });
        return;
      }
      toast(message);
    }
  }

  async function report(reason: "unreachable" | "rented" | "scam") {
    try {
      const result = await postReport({ data: { id, reason } });
      toast(result.credited ? "Thanks. We put 1 contact back." : "Thanks. We will check this listing.");
    } catch (error) {
      toast(errorText(error));
    }
  }

  return (
    <div className="space-y-3">
      <Link to="/search" search={{ area: "", campus: "", type: "", max: "" }} className="text-sm font-semibold text-green">
        Back to results
      </Link>
      <article className="space-y-3 rounded-card border border-line bg-surface p-4">
        {images.length ? (
          <div className="flex gap-2 overflow-x-auto">
            {images.map((src) => (
              <img key={src} src={src} alt="" className="h-64 w-10/12 shrink-0 rounded-2xl object-cover" />
            ))}
          </div>
        ) : null}
        <p className="font-display text-3xl font-extrabold text-green">
          {kwacha(listing.price_zmw)} <span className="text-base font-semibold text-muted">/month</span>
        </p>
        <h1 className="font-display text-2xl font-extrabold">{listing.title}</h1>
        <p className="text-sm text-muted">
          {listing.area}
          {listing.near_campus ? `, near ${listing.near_campus}` : ""}
        </p>
        <p className="text-sm text-muted">{postedAgo(listing.created_at)}</p>
        <div className="flex flex-wrap gap-1">
          <span className="rounded bg-paper px-2 py-0.5 text-sm text-deep">{typeLabel(listing.type)}</span>
          {listing.verified ? <span className="rounded bg-amber px-2 py-0.5 text-sm font-bold text-amber-ink">Verified</span> : null}
          {listing.sample ? <span className="rounded bg-deep px-2 py-0.5 text-sm text-foam">Sample</span> : null}
          {listing.amenities.map((key) => (
            <span key={key} className="rounded bg-paper px-2 py-0.5 text-sm text-deep">
              {AMENITY_LABEL[key] ?? key}
            </span>
          ))}
        </div>
        {listing.description ? <p>{listing.description}</p> : null}
        <div className="rounded-xl border-2 border-dashed border-amber bg-paper p-4 text-center">
          {phone ? (
            <div className="space-y-3">
              <p className="font-display text-2xl font-extrabold">{phone}</p>
              <div className="flex justify-center gap-2">
                <a href={`tel:${phone}`}><Button>Call</Button></a>
                <a href={`https://wa.me/${phone.replace("+", "")}`} target="_blank" rel="noreferrer"><Button tone="amber">WhatsApp</Button></a>
              </div>
              <p className="text-sm text-muted">Number not working?</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button tone="ghost" type="button" onClick={() => void report("unreachable")}>Not reachable</Button>
                <Button tone="ghost" type="button" onClick={() => void report("rented")}>Already rented</Button>
                <Button tone="ghost" type="button" onClick={() => void report("scam")}>Looks like a scam</Button>
              </div>
            </div>
          ) : (
            <>
              <p>Landlord contact is locked</p>
              <Button tone="amber" className="mt-3" type="button" onClick={() => void unlock()}>
                Unlock contact
              </Button>
            </>
          )}
        </div>
        <a href={`https://wa.me/?text=${share}`} target="_blank" rel="noreferrer" className="block">
          <Button tone="ghost" full type="button">Share on WhatsApp</Button>
        </a>
      </article>
    </div>
  );
}
