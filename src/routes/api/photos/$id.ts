import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/photos/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { readPhoto } = await import("@/lib/tulo/handlers.server");
        const bytes = await readPhoto(params.id);
        if (!bytes) return new Response("Not found", { status: 404 });
        const copy = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(copy).set(bytes);
        return new Response(copy, {
          headers: {
            "content-type": "image/jpeg",
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
