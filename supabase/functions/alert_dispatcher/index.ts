// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1";

// Resend API URL
const RESEND_API_URL = "https://api.resend.com/emails";

interface AlertPayload {
    type: string;
    table: string;
    record: {
        id: string;
        connector_id: string;
        alert_type: string;
        severity: string;
        message: string;
        status: string;
        created_at: string;
        metadata: any;
    };
    schema: string;
}

serve(async (req) => {
    try {
        const payload: AlertPayload = await req.json();

        // Only process INSERT events for notifications
        if (payload.type !== "INSERT") {
            return new Response("Not an insert event, ignoring", { status: 200 });
        }

        const alert = payload.record;

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch SLA to get escalation emails
        const { data: sla } = await supabase
            .from('connector_slas')
            .select('escalation_emails')
            .eq('connector_id', alert.connector_id)
            .single();

        const emails = sla?.escalation_emails || [];
        const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
        const resendApiKey = Deno.env.get('RESEND_API_KEY');

        const notificationsToInsert = [];

        // 1. Send Slack Notification
        if (slackWebhookUrl) {
            try {
                const slackResponse = await fetch(slackWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        blocks: [
                            {
                                type: "header",
                                text: { type: "plain_text", text: `🚨 ${alert.severity.toUpperCase()} Alert: Integration Issue` }
                            },
                            {
                                type: "section",
                                text: { type: "mrkdwn", text: `*Alert Type:* ${alert.alert_type}\n*Connector ID:* \`${alert.connector_id}\`\n*Message:* ${alert.message}` }
                            }
                        ]
                    })
                });

                if (slackResponse.ok) {
                    notificationsToInsert.push({
                        alert_id: alert.id,
                        channel: 'slack',
                        status: 'sent',
                        sent_at: new Date().toISOString()
                    });
                } else {
                    console.error("Slack sending failed", await slackResponse.text());
                }
            } catch (err) {
                console.error("Error calling Slack webhook", err);
            }
        }

        // 2. Send Email Notification (using Resend as an example)
        if (resendApiKey && emails.length > 0) {
            try {
                const emailResponse = await fetch(RESEND_API_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resendApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: 'alerts@yourdomain.com', // Change this to verified sender
                        to: emails,
                        subject: `[${alert.severity.toUpperCase()}] Integration Alert for Connector ${alert.connector_id}`,
                        html: `
              <h2>Integration Alert: ${alert.alert_type}</h2>
              <p><strong>Severity:</strong> ${alert.severity}</p>
              <p><strong>Message:</strong> ${alert.message}</p>
              <p><strong>Time:</strong> ${alert.created_at}</p>
              <hr />
              <p>Metadata: <pre>${JSON.stringify(alert.metadata, null, 2)}</pre></p>
            `
                    })
                });

                if (emailResponse.ok) {
                    notificationsToInsert.push({
                        alert_id: alert.id,
                        channel: 'email',
                        status: 'sent',
                        payload: { emails },
                        sent_at: new Date().toISOString()
                    });
                } else {
                    console.error("Email sending failed", await emailResponse.text());
                }
            } catch (err) {
                console.error("Error sending email", err);
            }
        }

        // 3. Log notifications sent
        if (notificationsToInsert.length > 0) {
            await supabase.from('alert_notifications').insert(notificationsToInsert);
        }

        return new Response(JSON.stringify({ success: true, notifications: notificationsToInsert.length }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("Dispatcher failed:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        });
    }
});
