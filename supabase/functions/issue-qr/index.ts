import { serve } from "https://deno.land/std/http/server.ts";
import QRCode from "npm:qrcode";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const shift_id = url.searchParams.get("shift_id");
    const purpose = url.searchParams.get("purpose") as "checkin" | "checkout";
    if (!shift_id || !purpose) return new Response("bad request", { status: 400 });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data, error: jerr } = await supabase
      .from("shifts")
      .select("id, event_id, events!inner(event_date)")
      .eq("id", shift_id)
      .single();

    if (jerr || !data) return new Response("shift/event not found", { status: 404 });

    const issued_for_date = (data as any).events.event_date;
    const expires_at = new Date(`${issued_for_date}T23:59:59Z`);

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.getRandomValues(new Uint8Array(8)).join("");

    const { error } = await supabase
      .from("qr_tokens")
      .insert({ shift_id, token, purpose, issued_for_date, expires_at });

    if (error) return new Response(error.message, { status: 500 });

    const png = await QRCode.toBuffer(token, { margin: 1, width: 256 });
    return new Response(png, { headers: { "Content-Type": "image/png" }, status: 200 });
  } catch (e) {
    return new Response(e?.message ?? "error", { status: 500 });
  }
});