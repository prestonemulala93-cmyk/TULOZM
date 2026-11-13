import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: async () => {
        const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
        const fingerprints = (process.env.GOOGLE_PLAY_SHA256 || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        const body =
          packageName && fingerprints.length
            ? [
                {
                  relation: ["delegate_permission/common.handle_all_urls"],
                  target: {
                    namespace: "android_app",
                    package_name: packageName,
                    sha256_cert_fingerprints: fingerprints,
                  },
                },
              ]
            : [];
        return new Response(JSON.stringify(body), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
