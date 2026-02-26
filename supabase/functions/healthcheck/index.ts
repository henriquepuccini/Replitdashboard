// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
    // CORS Headers
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
    }

    // Simple ping endpoint for uptime monitors
    return new Response(
        JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'Replitdashboard Monitoring Edge Functions'
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
    );
});
