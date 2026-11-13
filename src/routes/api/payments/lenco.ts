import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/payments/lenco")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleLencoWebhook } = await import("@/lib/tulo/payments.server");
        return handleLencoWebhook(request);
      },
    },
  },
});
