import { createFileRoute } from "@tanstack/react-router";
import { fulfilPurchase, mpFetch } from "@/lib/game.server";

// Mercado Pago notifies us of a payment id. We never trust the notification body:
// we fetch the payment from Mercado Pago with our own access token and only
// fulfil when Mercado Pago itself says it is approved.
export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const body = (await request.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
          const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
          const id = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
          if (type !== "payment" || !id || !/^\d+$/.test(String(id))) return new Response("ignored", { status: 200 });
          const pay = await mpFetch(`/v1/payments/${id}`);
          if (pay.status === "approved" && typeof pay.external_reference === "string") {
            await fulfilPurchase(pay.external_reference, String(pay.id));
          }
          return new Response("ok", { status: 200 });
        } catch (e) {
          console.error("mp webhook", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
