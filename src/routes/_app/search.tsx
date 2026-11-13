import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ListingCard } from "@/components/listing-card";
import { Button, Field, Select, TextInput } from "@/components/ui";
import { getListings } from "@/lib/tulo/api";
import { AMENITIES, CAMPUSES, type Listing } from "@/lib/tulo/format";
import { errorText, toast } from "@/lib/tulo/toast";

type Search = { area: string; campus: string; type: string; max: string };

export const Route = createFileRoute("/_app/search")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    area: typeof search.area === "string" ? search.area : "",
    campus: typeof search.campus === "string" ? search.campus : "",
    type: typeof search.type === "string" ? search.type : "",
    max: typeof search.max === "string" ? search.max : "",
  }),
  component: SearchPage,
});

function SearchPage() {
  const initial = Route.useSearch();
  const [area, setArea] = useState(initial.area);
  const [campus, setCampus] = useState(initial.campus);
  const [type, setType] = useState(initial.type);
  const [max, setMax] = useState(initial.max);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [listings, setListings] = useState<Listing[] | null>(null);

  async function load(next = { area, campus, type, max, amenities }) {
    setListings(null);
    try {
      const rows = await getListings({
        data: {
          area: next.area || undefined,
          campus: next.campus || undefined,
          type: next.type === "room" || next.type === "bedspace" || next.type === "house" || next.type === "boarding_house" ? next.type : undefined,
          maxPrice: next.max ? Number(next.max) : undefined,
          amenities: next.amenities.length
            ? (next.amenities as Array<"water" | "electricity" | "wifi" | "security" | "parking" | "furnished" | "own_bathroom">)
            : undefined,
        },
      });
      setListings(rows);
    } catch (error) {
      setListings([]);
      toast(errorText(error));
    }
  }

  useEffect(() => {
    void load();
    // Initial filters come from the route. Later searches are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <form
        className="space-y-3 rounded-card border border-line bg-surface p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <Field label="Town or area">
          <TextInput value={area} onChange={(event) => setArea(event.target.value)} placeholder="Kitwe, Kabwe, Kalingalinga" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Near a college">
            <Select value={campus} onChange={(event) => setCampus(event.target.value)}>
              <option value="">Any</option>
              {CAMPUSES.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Any</option>
              <option value="room">Room</option>
              <option value="bedspace">Bedspace</option>
              <option value="boarding_house">Boarding house</option>
              <option value="house">House</option>
            </Select>
          </Field>
        </div>
        <Field label="Maximum rent (K per month)">
          <TextInput inputMode="numeric" value={max} onChange={(event) => setMax(event.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map(([key, label]) => {
            const on = amenities.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setAmenities(on ? amenities.filter((item) => item !== key) : [...amenities, key])}
                className={`rounded-full border px-3 py-2 text-sm ${on ? "border-green bg-green text-foam" : "border-green text-green"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <Button full type="submit">
          Search rooms
        </Button>
      </form>
      {listings === null ? <p className="text-muted">Searching…</p> : null}
      {listings?.length === 0 ? <p className="rounded-card border border-line bg-surface p-4 text-muted">No places match. Remove a filter or check back soon.</p> : null}
      <div className="space-y-3">
        {listings?.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}
