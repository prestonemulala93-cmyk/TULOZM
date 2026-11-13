import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control = "w-full rounded-xl border border-line bg-surface px-3 py-3 text-base text-ink outline-none focus:border-green";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={control} />;
}

export function Area(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={control} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={control} />;
}

export function Button({
  tone = "green",
  full,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "green" | "amber" | "ghost"; full?: boolean }) {
  const tones = {
    green: "bg-green text-foam",
    amber: "bg-amber text-amber-ink",
    ghost: "border border-green bg-surface text-green",
  };
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-3 text-base font-semibold active:opacity-80 disabled:opacity-50 ${tones[tone]} ${full ? "w-full" : ""} ${props.className ?? ""}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card border border-line bg-surface p-4 ${className}`}>{children}</section>;
}
