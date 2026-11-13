import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/legal/terms")({
  component: Terms,
});

function Terms() {
  return (
    <article className="space-y-3 text-sm leading-relaxed">
      <h1 className="font-display text-3xl font-extrabold">Terms</h1>
      <p>Tulo is a noticeboard for rooms and houses across Zambia. We do not rent the property, hold a deposit, or promise that a listing is still free.</p>
      <h2 className="font-display text-xl font-extrabold">Searching and plans</h2>
      <p>Browsing is free. Contacts are sold in packs: K20 for 4, K50 for 12, and K100 for 26. Each new landlord number uses one contact. Opening a number you already unlocked does not use another. A reported number that does not work can return one contact, up to three times in 30 days. Sample listings are examples and their numbers are not real.</p>
      <h2 className="font-display text-xl font-extrabold">Payments</h2>
      <p>On the website, plans are paid with Zambian mobile money or card. Inside the Android app from the Play Store, the same plans are paid with Google Play. Access starts only after the provider confirms the payment. Refunds follow that provider's rules.</p>
      <h2 className="font-display text-xl font-extrabold">Listings</h2>
      <p>Landlords must describe a real place and a number that works. New listings stay hidden until they are approved. Three reports send a listing back for review. Do not post someone else's home, a scam, or anything unlawful.</p>
      <h2 className="font-display text-xl font-extrabold">Accounts</h2>
      <p>You can delete your account in the app. We may close an account that abuses unlocks or posts false listings.</p>
      <Link to="/" className="inline-flex min-h-11 items-center font-semibold text-green">Home</Link>
    </article>
  );
}
