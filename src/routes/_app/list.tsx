import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button, Field, Select, TextInput, Area } from "@/components/ui";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMe, postListing, postPhoto } from "@/lib/tulo/api";
import { AMENITIES, CAMPUSES } from "@/lib/tulo/format";
import { errorText, toast } from "@/lib/tulo/toast";

export const Route = createFileRoute("/_app/list")({
  component: ListPlace,
});

function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not read that photo."));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.7).split(",")[1] ?? "";
      URL.revokeObjectURL(image.src);
      resolve(data);
    };
    image.onerror = () => reject(new Error("Could not read that photo."));
    image.src = URL.createObjectURL(file);
  });
}

function ListPlace() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [amenities, setAmenities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (isPending) return <p className="text-muted">Loading…</p>;
  if (!user) return <RedirectToSignIn />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const me = await getMe();
      if (me.role !== "landlord") {
        toast("Switch to landlord on your account first.");
        await navigate({ to: "/account" });
        return;
      }
      const created = await postListing({
        data: {
          type: String(form.get("type")) as "room" | "bedspace" | "boarding_house" | "house",
          title: String(form.get("title") ?? ""),
          description: String(form.get("description") ?? ""),
          priceZmw: Number(form.get("price")),
          area: String(form.get("area") ?? ""),
          nearCampus: String(form.get("campus") ?? "") || undefined,
          amenities: amenities as Array<"water" | "electricity" | "wifi" | "security" | "parking" | "furnished" | "own_bathroom">,
          contactPhone: String(form.get("phone") ?? ""),
        },
      });
      const files = (form.getAll("photos") as File[]).filter((file) => file.size > 0).slice(0, 5);
      for (let index = 0; index < files.length; index += 1) {
        toast(`Uploading photo ${index + 1} of ${files.length}`);
        const data = await shrink(files[index]);
        await postPhoto({ data: { listingId: created.id, data } });
      }
      toast("Sent. We will review it before it goes live.");
      await navigate({ to: "/mine" });
    } catch (error) {
      toast(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3 rounded-card border border-line bg-surface p-4" onSubmit={(event) => void onSubmit(event)}>
      <h1 className="font-display text-2xl font-extrabold">List a place</h1>
      <Field label="Type">
        <Select name="type" defaultValue="room">
          <option value="room">Room</option>
          <option value="bedspace">Bedspace</option>
          <option value="boarding_house">Boarding house</option>
          <option value="house">House</option>
        </Select>
      </Field>
      <Field label="Title">
        <TextInput name="title" required minLength={5} placeholder="Self-contained room" />
      </Field>
      <Field label="Description">
        <Area name="description" rows={3} placeholder="Rules, deposit, nearest shops or bus stop" />
      </Field>
      <Field label="Rent per month (K)">
        <TextInput name="price" required type="number" min={1} />
      </Field>
      <Field label="Town or area">
        <TextInput name="area" required placeholder="Kitwe, Kabwe, or a neighbourhood" />
      </Field>
      <Field label="Near a college">
        <Select name="campus" defaultValue="">
          <option value="">None</option>
          {CAMPUSES.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </Select>
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
      <Field label="Contact phone">
        <TextInput name="phone" required type="tel" placeholder="0971234567" />
      </Field>
      <Field label="Photos (up to 5)">
        <TextInput name="photos" type="file" accept="image/*" multiple />
      </Field>
      <Button full disabled={busy} type="submit">
        Send for approval
      </Button>
    </form>
  );
}
