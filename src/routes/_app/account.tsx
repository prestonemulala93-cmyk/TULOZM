import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button, Field, TextInput } from "@/components/ui";
import { claimAdminAccount, deleteAccount, getMe, updateProfile } from "@/lib/tulo/api";
import type { Me } from "@/lib/tulo/format";
import { signOut } from "@/lib/auth/client";
import { errorText, toast } from "@/lib/tulo/toast";

export const Route = createFileRoute("/_app/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [phone, setPhone] = useState("");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;
    getMe()
      .then((next) => {
        setMe(next);
        setPhone(next.phone ?? "");
      })
      .catch((error) => toast(errorText(error)));
  }, [user?.id]);

  if (isPending) return <p className="text-muted">Loading…</p>;
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-extrabold">Account</h1>
      <section className="space-y-2 rounded-card border border-line bg-surface p-4">
        <p>
          Signed in as <b>{me?.email || user.primaryEmail}</b>
        </p>
        <p className="text-sm text-muted">
          {me?.role === "landlord" ? "You can list places." : "You are looking for a place."}
          {me?.isAdmin ? " You can approve listings from the Approve tab." : ""}
        </p>
        {me?.canClaimAdmin ? (
          <Button
            tone="amber"
            type="button"
            onClick={() =>
              void claimAdminAccount()
                .then((next) => {
                  setMe(next);
                  toast("This account can now approve listings.");
                })
                .catch((error) => toast(errorText(error)))
            }
          >
            Make this the admin account
          </Button>
        ) : null}
        <p className="text-sm text-muted">
          {me && me.credits > 0
            ? `You have ${me.credits} contact${me.credits === 1 ? "" : "s"} left.`
            : "No contacts left. A landlord number stays hidden until you buy some."}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            onClick={() =>
              void updateProfile({ data: { role: "seeker", phone: phone || undefined } })
                .then(setMe)
                .catch((error) => toast(errorText(error)))
            }
          >
            I am looking
          </Button>
          <Button
            tone="ghost"
            type="button"
            onClick={() =>
              void updateProfile({ data: { role: "landlord", phone: phone || undefined } })
                .then((next) => {
                  setMe(next);
                  toast("You can list a place now.");
                })
                .catch((error) => toast(errorText(error)))
            }
          >
            I am a landlord
          </Button>
        </div>
        <Field label="Phone saved on your account">
          <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0971234567" />
        </Field>
        <UserButton />
      </section>
      <section className="space-y-2 rounded-card border border-line bg-surface p-4 text-sm text-muted">
        <h2 className="font-display text-lg font-extrabold text-ink">How you pay</h2>
        <p>Website: MTN, Airtel, Zamtel{me?.payments.mobileMoney ? "" : " (not connected on this copy)"} and card{me?.payments.card ? "" : " (not connected on this copy)"}.</p>
        <p>Play Store app: Google Play only. The products are 4, 12, or 26 contacts.</p>
      </section>
      <section className="space-y-2 rounded-card border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-extrabold">Delete account</h2>
        <p className="text-sm text-muted">This removes your login, listings, photos and plan. Play Store policy requires this inside the app.</p>
        {confirm ? (
          <Button
            tone="amber"
            type="button"
            onClick={() =>
              void deleteAccount()
                .then(() => signOut("/"))
                .then(() => navigate({ to: "/" }))
                .catch((error) => toast(errorText(error)))
            }
          >
            Delete my account forever
          </Button>
        ) : (
          <Button tone="ghost" type="button" onClick={() => setConfirm(true)}>
            Delete account
          </Button>
        )}
      </section>
      <p className="text-sm text-muted">
        <a className="underline" href="/legal/privacy">Privacy</a>
        {" · "}
        <a className="underline" href="/legal/terms">Terms</a>
      </p>
    </div>
  );
}
