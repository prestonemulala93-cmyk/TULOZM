import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { Button, Field, Select, TextInput } from "@/components/ui";
import { updateProfile } from "@/lib/tulo/api";
import { errorText, toast } from "@/lib/tulo/toast";

export const Route = createFileRoute("/_app/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"seeker" | "landlord">("seeker");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        if (!adult) throw new Error("You need to be 18 or older to use Tulo.");
        const result = await authClient.signUp.email({ email, password, name });
        if (result.error) throw new Error(result.error.message || "Could not create the account.");
      } else {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message || "Check the email and password.");
      }
      if (mode === "up") {
        await updateProfile({ data: { role } }).catch(() => undefined);
      }
      toast("Welcome to Tulo");
      await navigate({ to: role === "landlord" && mode === "up" ? "/list" : "/" });
    } catch (error) {
      toast(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form className="space-y-3 rounded-card border border-line bg-surface p-4" onSubmit={(event) => void submit(event)}>
        <h1 className="font-display text-2xl font-extrabold">Welcome to Tulo</h1>
        <p className="text-sm text-muted">Use your email to unlock contacts or list a place. Google and X work too.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" tone={mode === "up" ? "green" : "ghost"} onClick={() => setMode("up")}>Create account</Button>
          <Button type="button" tone={mode === "in" ? "green" : "ghost"} onClick={() => setMode("in")}>Log in</Button>
        </div>
        {mode === "up" ? (
          <Field label="Name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} required minLength={2} autoComplete="name" />
          </Field>
        ) : null}
        <Field label="Email">
          <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        </Field>
        <Field label="Password">
          <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "up" ? "new-password" : "current-password"} />
        </Field>
        {mode === "up" ? (
          <>
            <Field label="I am">
              <Select value={role} onChange={(event) => setRole(event.target.value as "seeker" | "landlord")}>
                <option value="seeker">Looking for a place</option>
                <option value="landlord">A landlord or agent</option>
              </Select>
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input className="mt-1" type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} />
              <span>I am 18 or older. Tulo is a housing noticeboard, not a service for children.</span>
            </label>
          </>
        ) : null}
        <Button full disabled={busy} type="submit">
          {mode === "up" ? "Create account" : "Continue"}
        </Button>
      </form>
      <div className="space-y-2">
        {GROK_PROVIDERS.map((provider) => (
          <Button
            key={provider.providerId}
            full
            tone="ghost"
            type="button"
            onClick={() => void signIn(provider.providerId, { callbackURL: "/" }).catch((error) => toast(errorText(error)))}
          >
            Continue with {provider.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
