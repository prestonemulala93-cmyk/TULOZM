type Push = (message: string) => void;

let push: Push = () => {};

export function bindToast(next: Push): () => void {
  push = next;
  return () => {
    push = () => {};
  };
}

export function toast(message: string): void {
  push(message);
}

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (error.message === "subscription_required") return "Pick a plan to unlock contacts.";
    if (error.message === "Unauthorized") return "Log in to continue.";
    if (error.message.startsWith("[")) return "Check the form and try again.";
    return error.message;
  }
  return "Something went wrong.";
}
