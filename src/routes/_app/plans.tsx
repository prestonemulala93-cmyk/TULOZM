import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Field, Select, TextInput } from "@/components/ui";
import { getMe, getPlans, postCard, postConfirmCard, postConfirmPlay, postMobileMoney, postPollPayment } from "@/lib/tulo/api";
import { kwacha, type PayFlags } from "@/lib/tulo/format";
import { errorText, toast } from "@/lib/tulo/toast";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type Plan = { id: "pack4" | "pack10" | "pack30"; label: string; price_zmw: number; credits: number; play_sku: string };

export const Route = createFileRoute("/_app/plans")({
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === "string" ? search.session_id : "",
    cancelled: search.cancelled === "1" || search.cancelled === 1 ? "1" : "",
  }),
  component: Plans,
});

function Plans() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [flags, setFlags] = useState<PayFlags>({ mobileMoney: false, card: false, play: false });
  const [playReady, setPlayReady] = useState(false);
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState<"mtn" | "airtel" | "zamtel">("mtn");
  const [busy, setBusy] = useState("");
  const [waiting, setWaiting] = useState("");

  useEffect(() => {
    getPlans()
      .then((result) => {
        setPlans(result.plans as Plan[]);
        setFlags(result.payments);
      })
      .catch((error) => toast(errorText(error)));
    const service = (window as Window & { getDigitalGoodsService?: (url: string) => Promise<unknown> }).getDigitalGoodsService;
    setPlayReady(typeof service === "function");
  }, []);

  useEffect(() => {
    if (!search.session_id || !user) return;
    postConfirmCard({ data: search.session_id })
      .then((result) => {
        toast(result.status === "succeeded" ? "Payment received. Contacts are unlocked." : "Payment is still pending.");
        void navigate({ to: "/plans", search: { session_id: "", cancelled: "" } });
      })
      .catch((error) => toast(errorText(error)));
  }, [search.session_id, user, navigate]);

  async function requireUser() {
    if (isPending) return false;
    if (!user) {
      toast("Log in to buy a plan");
      await navigate({ to: "/login" });
      return false;
    }
    return true;
  }

  async function payMoney(plan: Plan) {
    if (!(await requireUser())) return;
    setBusy(plan.id);
    try {
      const started = await postMobileMoney({ data: { planId: plan.id, phone, operator, channel: "web" } });
      if (started.state === "successful") {
        toast("Payment received. Contacts are unlocked.");
        return;
      }
      setWaiting(started.reference);
      toast("Approve the prompt on your phone, then tap I've paid.");
    } catch (error) {
      toast(errorText(error));
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      void paid(false);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [waiting]);

  async function paid(announce = true) {
    if (!waiting) return;
    try {
      const result = await postPollPayment({ data: waiting });
      if (result.status === "succeeded") {
        setWaiting("");
        toast("Payment received.");
        const me = await getMe();
        toast(`You have ${me.credits} contacts left.`);
      } else if (result.status === "failed") {
        setWaiting("");
        toast("The payment did not go through.");
      } else if (announce) {
        toast("Still waiting for the network. Approve the prompt, then try again.");
      }
    } catch (error) {
      toast(errorText(error));
    }
  }

  async function payCard(plan: Plan) {
    if (!(await requireUser())) return;
    setBusy(plan.id);
    try {
      const result = await postCard({ data: { planId: plan.id, channel: "web" } });
      window.location.href = result.url;
    } catch (error) {
      toast(errorText(error));
      setBusy("");
    }
  }

  async function payPlay(plan: Plan) {
    if (!(await requireUser())) return;
    const digital = (window as Window & {
      getDigitalGoodsService?: (url: string) => Promise<{ consume?: (token: string) => Promise<void> }>;
    }).getDigitalGoodsService;
    if (!digital) {
      toast("Play Billing is only available in the Android app.");
      return;
    }
    setBusy(plan.id);
    try {
      const service = await digital("https://play.google.com/billing");
      const request = new PaymentRequest(
        [{ supportedMethods: "https://play.google.com/billing", data: { sku: plan.play_sku } }],
        { total: { label: "Total", amount: { currency: "ZMW", value: plan.price_zmw.toFixed(2) } } },
      );
      const response = await request.show();
      const token = String((response.details as { purchaseToken?: string }).purchaseToken ?? "");
      if (!token) throw new Error("Google Play did not return a purchase.");
      await postConfirmPlay({ data: { planId: plan.id, productId: plan.play_sku, purchaseToken: token } });
      await response.complete("success");
      if (service.consume) await service.consume(token);
      toast("Payment received. Contacts are unlocked.");
    } catch (error) {
      toast(errorText(error));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold">Buy contacts</h1>
      <p className="text-muted">
        {playReady
          ? "In the Play Store app, Google Play sells the contacts. They are added after Google confirms the payment."
          : "On the website, pay with MTN, Airtel, Zamtel or a card. Contacts are added only after the payment is confirmed."}
      </p>
      {search.cancelled ? <p className="rounded-xl bg-paper p-3 text-sm">Card checkout was cancelled.</p> : null}
      <div className="rounded-card border border-line bg-surface p-4 text-sm text-muted">
        Each click that reveals a new landlord number uses one contact. Opening the same number again is free. A number that does not work can give one contact back, up to 3 times in 30 days.
      </div>
      {playReady ? null : (
        <>
          <Field label="Mobile money number">
            <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="0971234567" />
          </Field>
          <Field label="Network">
            <Select value={operator} onChange={(event) => setOperator(event.target.value as "mtn" | "airtel" | "zamtel")}>
              <option value="mtn">MTN</option>
              <option value="airtel">Airtel</option>
              <option value="zamtel">Zamtel</option>
            </Select>
          </Field>
        </>
      )}
      {plans.map((plan) => (
        <article key={plan.id} className={`relative rounded-card border bg-surface p-4 ${plan.id === "pack10" ? "border-amber" : "border-line"}`}>
          {plan.id === "pack10" ? <span className="absolute -top-3 right-3 rounded-full bg-amber px-2 py-0.5 text-xs font-bold text-amber-ink">Most popular</span> : null}
          {plan.id === "pack30" ? <span className="absolute -top-3 right-3 rounded-full bg-green px-2 py-0.5 text-xs font-bold text-foam">Best value</span> : null}
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold">{plan.label}</h2>
              <p className="text-sm text-muted">{plan.credits} contacts</p>
            </div>
            <p className="font-display text-3xl font-extrabold text-green">{kwacha(plan.price_zmw)}</p>
          </div>
          <div className="mt-3 space-y-2">
            {playReady ? (
              <Button full disabled={busy === plan.id} onClick={() => void payPlay(plan)}>
                Pay with Google Play
              </Button>
            ) : (
              <>
                <Button full tone="amber" disabled={!flags.mobileMoney || busy === plan.id} onClick={() => void payMoney(plan)}>
                  {flags.mobileMoney ? "Pay with mobile money" : "Mobile money is not live on this copy yet"}
                </Button>
                <Button full tone="ghost" disabled={!flags.card || busy === plan.id} onClick={() => void payCard(plan)}>
                  {flags.card ? "Pay with card" : "Card checkout is not live on this copy yet"}
                </Button>
              </>
            )}
          </div>
        </article>
      ))}
      {waiting ? (
        <Button full onClick={() => void paid(true)}>
          I've paid
        </Button>
      ) : null}
    </div>
  );
}
