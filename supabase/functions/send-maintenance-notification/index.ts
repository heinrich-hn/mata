import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { alert } = await req.json();

    if (!alert || !alert.recipient_email) {
      throw new Error('Invalid alert data');
    }

    const schedule = alert.maintenance_schedules;
    const alertType = alert.alert_type;
    
    let subject = '';
    let htmlContent = '';

    if (alertType === 'overdue') {
      const daysOverdue = Math.abs(
        Math.floor((new Date().getTime() - new Date(schedule.next_due_date).getTime()) / (1000 * 60 * 60 * 24))
      );

      subject = `⚠️ OVERDUE: ${schedule.title}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">⚠️ Overdue Maintenance Alert</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #ef4444; margin-top: 0;">${schedule.title}</h2>
              <p style="font-size: 16px; color: #4b5563;">
                <strong>Type:</strong> ${schedule.maintenance_type}<br>
                <strong>Priority:</strong> <span style="color: #ef4444; text-transform: uppercase;">${schedule.priority}</span><br>
                <strong>Due Date:</strong> ${new Date(schedule.next_due_date).toLocaleDateString()}<br>
                <strong>Days Overdue:</strong> <span style="color: #ef4444; font-weight: bold;">${daysOverdue} days</span>
              </p>
            </div>

            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 20px;">
              <p style="margin: 0; color: #991b1b;">
                <strong>⚠️ Action Required:</strong> This maintenance task is now overdue. 
                Please schedule and complete this maintenance as soon as possible to avoid potential issues.
              </p>
            </div>

            <p style="text-align: center; margin-top: 30px;">
              <a href="${Deno.env.get('VITE_SUPABASE_URL')}" 
                 style="background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                View in System
              </a>
            </p>
          </div>

          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p>This is an automated notification from your Fleet Management System</p>
          </div>
        </div>
      `;
    } else if (alertType === 'upcoming') {
      subject = `🔔 Upcoming: ${schedule.title}`;
      const hoursUntil = Math.round(alert.hours_until_due);

      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">🔔 Upcoming Maintenance Reminder</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #3b82f6; margin-top: 0;">${schedule.title}</h2>
              <p style="font-size: 16px; color: #4b5563;">
                <strong>Type:</strong> ${schedule.maintenance_type}<br>
                <strong>Priority:</strong> <span style="text-transform: uppercase;">${schedule.priority}</span><br>
                <strong>Due Date:</strong> ${new Date(schedule.next_due_date).toLocaleDateString()}<br>
                <strong>Time Until Due:</strong> <span style="color: #f59e0b; font-weight: bold;">${hoursUntil} hours</span>
              </p>
            </div>

            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 20px;">
              <p style="margin: 0; color: #1e40af;">
                <strong>📅 Reminder:</strong> This maintenance task is coming up soon. 
                Please ensure resources and parts are available.
              </p>
            </div>

            <p style="text-align: center; margin-top: 30px;">
              <a href="${Deno.env.get('VITE_SUPABASE_URL')}" 
                 style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                View Details
              </a>
            </p>
          </div>

          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p>This is an automated notification from your Fleet Management System</p>
          </div>
        </div>
      `;
    } else if (alertType === 'completed') {
      subject = `✅ Completed: ${schedule.title}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">✅ Maintenance Completed</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #10b981; margin-top: 0;">${schedule.title}</h2>
              <p style="font-size: 16px; color: #4b5563;">
                <strong>Type:</strong> ${schedule.maintenance_type}<br>
                <strong>Status:</strong> <span style="color: #10b981;">Completed</span>
              </p>
            </div>

            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px;">
              <p style="margin: 0; color: #065f46;">
                <strong>✅ Success:</strong> This maintenance task has been completed successfully.
              </p>
            </div>
          </div>

          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p>This is an automated notification from your Fleet Management System</p>
          </div>
        </div>
      `;
    }

    const { error } = await resend.emails.send({
      from: "Fleet Management <onboarding@resend.dev>",
      to: [alert.recipient_email],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      throw error;
    }

    console.log(`Email sent successfully to ${alert.recipient_email}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-maintenance-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});