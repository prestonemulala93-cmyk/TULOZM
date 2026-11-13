import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { GraduationCap, Phone, Search, Tag } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui";
import { getListings, getPlans } from "@/lib/tulo/api";
import { CITIES, CAMPUSES, kwacha, type Listing } from "@/lib/tulo/format";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_app/")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [area, setArea] = useState("");
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [plans, setPlans] = useState<Array<{ id: string; label: string; price_zmw: number }>>([]);

  useEffect(() => {
    getListings({ data: { limit: 8 } })
      .then(setListings)
      .catch(() => setListings([]));
    getPlans()
      .then((result) => setPlans(result.plans))
      .catch(() => setPlans([]));
  }, []);

  return (
    <div className="space-y-8">
      <section className="-mx-4 -mt-4 rounded-b-3xl bg-green px-4 pt-6 pb-5 text-foam">
        <h1 className="font-display text-4xl leading-none font-extrabold">Find a room anywhere in Zambia</h1>
        <p className="mt-3 text-foam opacity-90">Rooms, boarding houses and houses in any town. Searching is free.</p>
        <form
          className="mt-4 flex gap-2 rounded-xl bg-surface p-1"
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({ to: "/search", search: { area, campus: "", type: "", max: "" } });
          }}
        >
          <input
            value={area}
            onChange={(event) => setArea(event.target.value)}
            placeholder="Town or area, for example Kitwe"
            className="min-h-11 flex-1 bg-transparent px-3 text-ink outline-none"
          />
          <Button tone="amber" type="submit">
            Search
          </Button>
        </form>
        {!isPending && !user ? (
          <Link to="/login" className="mt-3 inline-flex min-h-11 items-center font-semibold text-foam underline">
            Log in or create an account
          </Link>
        ) : null}
      </section>

      <section>
        <h2 className="font-display text-2xl font-extrabold">Towns</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {CITIES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => void navigate({ to: "/search", search: { area: name, campus: "", type: "", max: "" } })}
              className="shrink-0 rounded-full border border-green px-3 py-2 text-sm font-semibold text-green"
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-extrabold">Near a college</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {CAMPUSES.map((campus) => (
            <button
              key={campus}
              type="button"
              onClick={() => void navigate({ to: "/search", search: { area: "", campus, type: "", max: "" } })}
              className="flex min-h-20 w-28 shrink-0 flex-col items-start justify-between rounded-xl bg-deep p-3 text-left text-foam"
            >
              <GraduationCap size={20} />
              <b className="font-display text-base leading-tight">{campus}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-extrabold">New on Tulo</h2>
        {listings === null ? <p className="text-muted">Loading rooms…</p> : null}
        {listings?.length === 0 ? <p className="text-muted">Listings are on the way.</p> : null}
        {listings?.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
        <Link to="/search" search={{ area: "", campus: "", type: "", max: "" }} className="inline-flex min-h-11 items-center font-semibold text-green">
          See all rooms
        </Link>
      </section>

      <section>
        <h2 className="font-display text-2xl font-extrabold">How Tulo works</h2>
        <ol className="mt-2 divide-y divide-line">
          <Step icon={<Search size={18} />} title="Search for free" body="Browse photos, prices and areas. You do not need an account." />
          <Step icon={<Tag size={18} />} title="Unlock the contact" body="Buy a pack of contacts. Each new landlord number uses one." />
          <Step icon={<Phone size={18} />} title="Call or WhatsApp" body="Talk to the landlord directly. A bad number can return one contact." />
        </ol>
      </section>

      {plans.length ? (
        <section>
          <h2 className="font-display text-2xl font-extrabold">Contacts</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-xl border border-line bg-surface p-3 text-center">
                <p className="font-semibold">{plan.label}</p>
                <p className="font-display text-xl font-extrabold text-green">{kwacha(plan.price_zmw)}</p>
              </div>
            ))}
          </div>
          <Link to="/plans" search={{ session_id: "", cancelled: "" }} className="mt-3 inline-flex min-h-11 items-center font-semibold text-green">
            See contact packs
          </Link>
        </section>
      ) : null}

      <section className="rounded-3xl bg-amber p-5 text-amber-ink">
        <h2 className="font-display text-2xl font-extrabold">Have a room to rent?</h2>
        <p className="mt-1">List it on Tulo and reach tenants who are ready to move.</p>
        <Link to={user ? "/list" : "/login"} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-deep px-4 font-semibold text-foam">
          List your place
        </Link>
      </section>
      <p className="pb-2 text-center text-sm text-muted">Tulo. Rooms in every province of Zambia.</p>
      <p className="pb-4 text-center text-sm">
        <a href="/tulo-rooms.zip" download="tulo-rooms.zip" className="font-semibold text-green underline">
          Download the updated zip
        </a>
      </p>
    </div>
  );
}

function Step({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <li className="flex gap-3 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-paper text-green">{icon}</span>
      <span>
        <b className="block">{title}</b>
        <span className="text-sm text-muted">{body}</span>
      </span>
    </li>
  );
}
