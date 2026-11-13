import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/payments/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleStripeWebhook } = await import("@/lib/tulo/payments.server");
        return handleStripeWebhook(request);
      },
    },
  },
});
