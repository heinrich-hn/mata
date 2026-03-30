import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Email configuration
const FALLBACK_EMAIL = "heinrich@matanuska.co.zw";
// Update this to your verified domain once you set it up in Resend
const SENDER_EMAIL = "onboarding@resend.dev"; // Change to maintenance@matanuska.co.zw after domain verification
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Function to send email using Resend
async function sendEmail(to: string, subject: string, html: string) {
  try {
    console.log(`Attempting to send email to ${to} from ${SENDER_EMAIL}`);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: SENDER_EMAIL,
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend API error response:', error);
      throw new Error(`Resend API error: ${error}`);
    }

    const result = await response.json();
    console.log(`✅ Email sent successfully to ${to}, ID: ${result.id}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return false;
  }
}

// Function to format email HTML
function formatMaintenanceEmail(alert: any, schedule: any): string {
  const priorityColor = schedule?.priority === 'high' ? '#dc2626' :
    schedule?.priority === 'medium' ? '#f59e0b' : '#10b981';

  const priorityText = schedule?.priority ? schedule.priority.toUpperCase() : 'NORMAL';

  const eventType = alert?.alert_type === 'overdue' ? 'OVERDUE' :
    alert?.alert_type === 'upcoming' ? 'UPCOMING' : 'MAINTENANCE';

  const urgencyMessage = alert?.alert_type === 'overdue'
    ? 'This maintenance is OVERDUE and requires immediate attention!'
    : 'This maintenance is due soon and requires attention.';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #f4f4f4; }
        .header { background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h2 { margin: 0; font-size: 24px; }
        .header p { margin: 10px 0 0; opacity: 0.9; }
        .content { background-color: #ffffff; padding: 30px; margin: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .alert-banner { background-color: ${alert?.alert_type === 'overdue' ? '#fee2e2' : '#fff3cd'}; border-left: 4px solid ${alert?.alert_type === 'overdue' ? '#dc2626' : '#ffc107'}; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; color: white; background-color: ${priorityColor}; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .event-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; background-color: #e5e7eb; color: #374151; font-size: 12px; font-weight: bold; margin-left: 8px; }
        .details-table { width: 100%; margin: 20px 0; border-collapse: collapse; }
        .details-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
        .details-table td:first-child { font-weight: bold; width: 40%; background-color: #f9fafb; }
        .button { display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
        .button:hover { background: linear-gradient(135deg, #1e3a8a 0%, #1e2a6a 100%); }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; margin-top: 20px; }
        .vehicle-icon { font-size: 48px; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🚛 Matanuska Maintenance Alert</h2>
          <p>Fleet Management System</p>
        </div>
        
        <div class="content">
          <div style="text-align: center;">
            <span class="priority-badge">${priorityText} Priority</span>
            <span class="event-badge">${eventType}</span>
          </div>
          
          <div class="alert-banner">
            <strong>⚠️ ${urgencyMessage}</strong>
          </div>
          
          <div class="vehicle-icon">
            🚛
          </div>
          
          <h3 style="text-align: center; margin-bottom: 20px;">${schedule?.title || 'Maintenance Required'}</h3>
          
          <table class="details-table">
            <tr>
              <td>Vehicle ID:</td>
              <td><strong>${schedule?.vehicle_id || 'N/A'}</strong></td>
            </tr>
            <tr>
              <td>Due Date:</td>
              <td><strong>${schedule?.next_due_date || 'N/A'}</strong></td>
            </tr>
            <tr>
              <td>Alert Type:</td>
              <td><strong>${alert?.alert_type === 'overdue' ? '⚠️ Overdue' : '⏰ Upcoming'}</strong></td>
            </tr>
            <tr>
              <td>Maintenance Type:</td>
              <td><strong>${schedule?.maintenance_type || 'Scheduled'}</strong></td>
            </tr>
          </table>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <strong>📋 Message:</strong><br>
            ${alert?.message || `Maintenance for vehicle ${schedule?.vehicle_id} is ${alert?.alert_type === 'overdue' ? 'overdue' : 'due soon'}. Please schedule this service immediately.`}
          </div>
          
          ${schedule?.description ? `
          <div style="margin: 20px 0;">
            <strong>📝 Description:</strong><br>
            ${schedule.description}
          </div>
          ` : ''}
          
          <div style="text-align: center;">
            <a href="${Deno.env.get('APP_URL') || 'https://matanuska.co.zw'}/dashboard/maintenance" class="button">View in Dashboard →</a>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated message from the Matanuska Fleet Management System.</p>
          <p>For urgent matters, please contact the maintenance team directly.</p>
          <p>© ${new Date().getFullYear()} Matanuska. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Starting maintenance scheduler run...');
    console.log(`� From: ${SENDER_EMAIL}`);

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    // Check for overdue maintenance
    const { data: overdueSchedules, error: overdueError } = await supabase
      .rpc('check_overdue_maintenance');

    if (overdueError) {
      console.error('❌ Error checking overdue maintenance:', overdueError);
    } else {
      console.log(`📊 Found ${overdueSchedules?.length || 0} overdue schedules`);
    }

    // Generate alerts for upcoming maintenance
    const { data: alertCount, error: alertError } = await supabase
      .rpc('generate_maintenance_alerts');

    if (alertError) {
      console.error('❌ Error generating alerts:', alertError);
    } else {
      console.log(`📊 Generated ${alertCount || 0} new alerts`);
    }

    // Get pending alerts to send
    const { data: pendingAlerts, error: alertsError } = await supabase
      .from('maintenance_alerts')
      .select(`
        *,
        maintenance_schedules (
          id,
          title,
          vehicle_id,
          maintenance_type,
          next_due_date,
          priority,
          description
        )
      `)
      .eq('delivery_status', 'pending')
      .limit(50);

    let sentCount = 0;
    let failedCount = 0;

    if (alertsError) {
      console.error('❌ Error fetching pending alerts:', alertsError);
    } else if (pendingAlerts && pendingAlerts.length > 0) {
      console.log(`📧 Processing ${pendingAlerts.length} pending alerts`);

      // Send email notifications directly
      for (const alert of pendingAlerts) {
        try {
          const schedule = alert.maintenance_schedules;

          // Format email content
          const emailSubject = `⚠️ ${alert.alert_type === 'overdue' ? 'OVERDUE' : 'Upcoming'} Maintenance: ${schedule?.title || 'Maintenance'} - Vehicle ${schedule?.vehicle_id || 'N/A'}`;
          const emailHtml = formatMaintenanceEmail(alert, schedule);

          // Determine recipient: use alert's recipient_email, fall back to default
          const recipientEmail = alert.recipient_email || FALLBACK_EMAIL;

          // Send email directly using Resend
          const emailSent = await sendEmail(recipientEmail, emailSubject, emailHtml);
          console.log(`📧 Sending to: ${recipientEmail}`);

          if (emailSent) {
            // Mark as sent in database
            await supabase
              .from('maintenance_alerts')
              .update({
                delivery_status: 'sent',
                sent_at: new Date().toISOString()
              })
              .eq('id', alert.id);

            sentCount++;
            console.log(`✅ Alert ${alert.id} sent successfully`);
          } else {
            throw new Error('Failed to send email via Resend');
          }

        } catch (error) {
          failedCount++;
          console.error(`❌ Error sending alert ${alert.id}:`, error);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          await supabase
            .from('maintenance_alerts')
            .update({
              delivery_status: 'failed',
              error_message: errorMessage
            })
            .eq('id', alert.id);
        }
      }
    }

    // Auto-create job cards for due maintenance
    const today = new Date().toISOString().split('T')[0];
    const { data: dueSchedules, error: dueError } = await supabase
      .from('maintenance_schedules')
      .select('*')
      .eq('is_active', true)
      .eq('auto_create_job_card', true)
      .lte('next_due_date', today)
      .is('related_template_id', null);

    let jobCardsCreated = 0;

    if (dueError) {
      console.error('❌ Error fetching due schedules:', dueError);
    } else if (dueSchedules && dueSchedules.length > 0) {
      console.log(`🔧 Auto-creating ${dueSchedules.length} job cards`);

      for (const schedule of dueSchedules) {
        try {
          // Create job card
          const { data: jobCard, error: jobCardError } = await supabase
            .from('job_cards')
            .insert({
              vehicle_id: schedule.vehicle_id,
              title: `Scheduled: ${schedule.title}`,
              description: `Auto-created from maintenance schedule\n\n${schedule.description || ''}`,
              priority: schedule.priority,
              status: 'open',
              category: schedule.category,
              maintenance_schedule_id: schedule.id,
            })
            .select()
            .single();

          if (jobCardError) {
            console.error(`❌ Error creating job card for schedule ${schedule.id}:`, jobCardError);
          } else {
            jobCardsCreated++;
            console.log(`✅ Created job card ${jobCard.id} for schedule ${schedule.id}`);
          }
        } catch (error) {
          console.error(`❌ Error processing schedule ${schedule.id}:`, error);
        }
      }
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      emailRecipient: 'per-alert recipient_email',
      emailSender: SENDER_EMAIL,
      overdueCount: overdueSchedules?.length || 0,
      alertsGenerated: alertCount || 0,
      alertsProcessed: pendingAlerts?.length || 0,
      alertsSent: sentCount,
      alertsFailed: failedCount,
      jobCardsCreated: jobCardsCreated,
    };

    console.log('✨ Maintenance scheduler completed:', response);

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('💥 Error in maintenance scheduler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});