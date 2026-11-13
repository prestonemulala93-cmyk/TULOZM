import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui";
import { getMine, postMineStatus, postPrice } from "@/lib/tulo/api";
import { coverSrc, kwacha, typeLabel } from "@/lib/tulo/format";
import { errorText, toast } from "@/lib/tulo/toast";

type Mine = {
  id: string;
  title: string;
  price_zmw: number;
  area: string;
  status: string;
  verified: boolean;
  type: string;
  cover_path: string | null;
  photo_ids: string[];
  unlocks: number;
};

const STATUS: Record<string, string> = {
  active: "Live",
  pending: "Awaiting approval",
  rented: "Rented",
  rejected: "Rejected",
};

export const Route = createFileRoute("/_app/mine")({
  component: MinePage,
});

function MinePage() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Mine[] | null>(null);
  const [edit, setEdit] = useState<{ id: string; price: string } | null>(null);

  async function load() {
    const next = await getMine();
    setRows(next);
  }

  useEffect(() => {
    if (!user) return;
    load().catch((error) => toast(errorText(error)));
  }, [user?.id]);

  if (isPending) return <p className="text-muted">Loading…</p>;
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl font-extrabold">Your listings</h1>
      {rows === null ? <p className="text-muted">Loading…</p> : null}
      {rows?.length === 0 ? <p className="text-muted">You have no listings yet. Tap List to add one.</p> : null}
      {rows?.map((listing) => {
        const src = coverSrc(listing);
        return (
          <article key={listing.id} className="space-y-2 rounded-card border border-line bg-surface p-4">
            {src ? <img src={src} alt="" className="h-36 w-full rounded-xl object-cover" /> : null}
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-lg font-extrabold">{listing.title}</h2>
              <span className="rounded bg-paper px-2 py-1 text-xs font-bold text-deep">{STATUS[listing.status] ?? listing.status}</span>
            </div>
            <p className="text-sm text-muted">
              {kwacha(listing.price_zmw)}, {listing.area} · {typeLabel(listing.type)}
            </p>
            <p className="text-sm text-muted">
              {listing.unlocks} {listing.unlocks === 1 ? "person has" : "people have"} unlocked this contact
            </p>
            {listing.status !== "rejected" ? (
              edit?.id === listing.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void postPrice({ data: { id: listing.id, priceZmw: Math.round(Number(edit.price)) } })
                      .then(() => {
                        toast("Price updated");
                        setEdit(null);
                        return load();
                      })
                      .catch((error) => toast(errorText(error)));
                  }}
                >
                  <input
                    className="min-h-11 flex-1 rounded-xl border border-line px-3"
                    inputMode="numeric"
                    value={edit.price}
                    onChange={(event) => setEdit({ id: listing.id, price: event.target.value })}
                  />
                  <Button type="submit">Save</Button>
                </form>
              ) : (
                <Button tone="ghost" full type="button" onClick={() => setEdit({ id: listing.id, price: String(listing.price_zmw) })}>
                  Change price
                </Button>
              )
            ) : null}
            {listing.status === "active" ? (
              <Button
                tone="ghost"
                full
                type="button"
                onClick={() =>
                  void postMineStatus({ data: { id: listing.id, status: "rented" } })
                    .then(() => load())
                    .catch((error) => toast(errorText(error)))
                }
              >
                Mark as rented
              </Button>
            ) : null}
            {listing.status === "rented" ? (
              <Button
                full
                type="button"
                onClick={() =>
                  void postMineStatus({ data: { id: listing.id, status: "active" } })
                    .then(() => {
                      toast("Back on the market");
                      return load();
                    })
                    .catch((error) => toast(errorText(error)))
                }
              >
                Mark as available
              </Button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
