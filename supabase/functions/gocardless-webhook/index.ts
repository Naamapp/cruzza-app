import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();

    console.log("GoCardless Webhook Received:", payload);

    const events = payload.events || [];

    for (const event of events) {
      const { resource_type, action, links } = event;

      if (resource_type === "payments") {
        if (action === "confirmed" || action === "paid_out") {
          const mandateId = links?.mandate;

          if (mandateId) {
            const { data: mandate } = await supabase
              .from("payment_mandates")
              .select("driver_id, gocardless_mandate_id")
              .eq("gocardless_mandate_id", mandateId)
              .maybeSingle();

            if (mandate) {
              console.log(`Payment confirmed for driver: ${mandate.driver_id}`);

              await supabase
                .from("driver_profiles")
                .update({
                  payment_status: "active",
                  subscription_renewal_date: new Date(
                    Date.now() + 30 * 24 * 60 * 60 * 1000
                  ).toISOString(),
                })
                .eq("id", mandate.driver_id);

              console.log(
                `Driver ${mandate.driver_id} subscription renewed successfully`
              );
            }
          }
        } else if (action === "failed" || action === "cancelled") {
          const mandateId = links?.mandate;

          if (mandateId) {
            const { data: mandate } = await supabase
              .from("payment_mandates")
              .select("driver_id")
              .eq("gocardless_mandate_id", mandateId)
              .maybeSingle();

            if (mandate) {
              await supabase
                .from("driver_profiles")
                .update({
                  payment_status: "failed",
                })
                .eq("id", mandate.driver_id);

              console.log(
                `Driver ${mandate.driver_id} payment failed - access restricted`
              );
            }
          }
        }
      }

      if (resource_type === "mandates") {
        if (action === "active") {
          const mandateId = links?.mandate || event.links?.customer_bank_account;

          if (mandateId) {
            await supabase
              .from("payment_mandates")
              .update({
                status: "active",
              })
              .eq("gocardless_mandate_id", mandateId);

            console.log(`Mandate ${mandateId} activated`);
          }
        } else if (action === "cancelled" || action === "failed") {
          const mandateId = links?.mandate;

          if (mandateId) {
            await supabase
              .from("payment_mandates")
              .update({
                status: "cancelled",
              })
              .eq("gocardless_mandate_id", mandateId);

            console.log(`Mandate ${mandateId} cancelled/failed`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true, processed: events.length }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Webhook processing error:", error);

    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
