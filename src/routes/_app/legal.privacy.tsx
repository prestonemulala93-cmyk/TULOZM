import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/legal/privacy")({
  component: Privacy,
});

function Privacy() {
  return (
    <article className="space-y-3 text-sm leading-relaxed">
      <h1 className="font-display text-3xl font-extrabold">Privacy</h1>
      <p>Tulo helps people anywhere in Zambia find a room or house, and helps landlords reach them. This page is the privacy policy for the website and the Android app.</p>
      <h2 className="font-display text-xl font-extrabold">What we store</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Account: name, email, and the password hash. If you use Google or X, we store the identity those services return.</li>
        <li>Optional phone number, and the contact number on a listing.</li>
        <li>Listings, photos, prices, and reports you send.</li>
        <li>Payment references and how many contacts you have left. We do not store card numbers. Mobile money is handled by Lenco. Cards are handled by Stripe. Play Store purchases are handled by Google.</li>
      </ul>
      <h2 className="font-display text-xl font-extrabold">Why</h2>
      <p>To show listings, hide landlord numbers until a plan is paid, stop scraping, and review reports. Contacts are only sent to someone with an active plan, and only after they ask to unlock that listing.</p>
      <h2 className="font-display text-xl font-extrabold">How long</h2>
      <p>We keep the account until you delete it from the Account page. Deleting removes the login, listings, photos, unlocks and plan. Payment providers may keep their own records as their law requires.</p>
      <h2 className="font-display text-xl font-extrabold">Children</h2>
      <p>Tulo is not for anyone under 18.</p>
      <h2 className="font-display text-xl font-extrabold">Play Store data safety</h2>
      <p>Data is collected and encrypted in transit. Account and listing data is required for the service. Users can request deletion inside the app. Data is not sold.</p>
      <Link to="/account" className="inline-flex min-h-11 items-center font-semibold text-green">Back to account</Link>
    </article>
  );
}
