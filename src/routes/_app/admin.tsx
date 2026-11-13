import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui";
import { getAdminQueue, postAdminStatus } from "@/lib/tulo/api";
import { coverSrc, kwacha, type Listing } from "@/lib/tulo/format";
import { errorText, toast } from "@/lib/tulo/toast";

type Queue = Listing & { contactPhone: string };

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Queue[] | null>(null);
  const [denied, setDenied] = useState(false);

  async function load() {
    const next = await getAdminQueue();
    setRows(next);
  }

  useEffect(() => {
    if (!user) return;
    load().catch(() => setDenied(true));
  }, [user?.id]);

  if (isPending) return <p className="text-muted">Loading…</p>;
  if (!user) return <RedirectToSignIn />;
  if (denied) return <p className="rounded-card border border-line bg-surface p-4">This page is for admins only. Add your email to the admin list before publishing.</p>;

  async function setStatus(id: string, status: "active" | "rejected", verified?: boolean) {
    try {
      await postAdminStatus({ data: { id, status, verified } });
      toast(status === "active" ? (verified ? "Approved as verified" : "Approved") : "Rejected");
      await load();
    } catch (error) {
      toast(errorText(error));
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl font-extrabold">Waiting for approval</h1>
      {rows?.length === 0 ? <p className="text-muted">No listings waiting.</p> : null}
      {rows?.map((listing) => {
        const src = coverSrc(listing);
        return (
          <article key={listing.id} className="space-y-2 rounded-card border border-line bg-surface p-4">
            {src ? <img src={src} alt="" className="h-40 w-full rounded-xl object-cover" /> : null}
            <h2 className="font-display text-lg font-extrabold">{listing.title}</h2>
            <p className="text-sm text-muted">
              {kwacha(listing.price_zmw)}, {listing.area}
            </p>
            <p className="text-sm">{listing.contactPhone}</p>
            <p>{listing.description}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void setStatus(listing.id, "active", true)}>Approve as verified</Button>
              <Button tone="ghost" type="button" onClick={() => void setStatus(listing.id, "active")}>Approve</Button>
              <Button tone="ghost" type="button" onClick={() => void setStatus(listing.id, "rejected")}>Reject</Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
