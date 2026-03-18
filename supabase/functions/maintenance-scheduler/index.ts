import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MaintenanceSchedule {
  id: string;
  vehicle_id: string;
  title: string;
  next_due_date: string;
  priority: string;
  auto_create_job_card: boolean;
  related_template_id: string | null;
  notification_recipients: any[];
  alert_before_hours: number[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting maintenance scheduler run...');

    // Check for overdue maintenance
    const { data: overdueSchedules, error: overdueError } = await supabase
      .rpc('check_overdue_maintenance');

    if (overdueError) {
      console.error('Error checking overdue maintenance:', overdueError);
    } else {
      console.log(`Found ${overdueSchedules?.length || 0} overdue schedules`);
    }

    // Generate alerts for upcoming maintenance
    const { data: alertCount, error: alertError } = await supabase
      .rpc('generate_maintenance_alerts');

    if (alertError) {
      console.error('Error generating alerts:', alertError);
    } else {
      console.log(`Generated ${alertCount || 0} new alerts`);
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
          priority
        )
      `)
      .eq('delivery_status', 'pending')
      .limit(50);

    if (alertsError) {
      console.error('Error fetching pending alerts:', alertsError);
    } else if (pendingAlerts && pendingAlerts.length > 0) {
      console.log(`Processing ${pendingAlerts.length} pending alerts`);

      // Send email notifications
      for (const alert of pendingAlerts) {
        try {
          await supabase.functions.invoke('send-maintenance-notification', {
            body: { alert },
          });

          // Mark as sent
          await supabase
            .from('maintenance_alerts')
            .update({ 
              delivery_status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', alert.id);

        } catch (error) {
          console.error(`Error sending alert ${alert.id}:`, error);
          
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
      .is('related_template_id', null); // Only if no job card exists yet

    if (dueError) {
      console.error('Error fetching due schedules:', dueError);
    } else if (dueSchedules && dueSchedules.length > 0) {
      console.log(`Auto-creating ${dueSchedules.length} job cards`);

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
            console.error(`Error creating job card for schedule ${schedule.id}:`, jobCardError);
          } else {
            console.log(`Created job card ${jobCard.id} for schedule ${schedule.id}`);
          }
        } catch (error) {
          console.error(`Error processing schedule ${schedule.id}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        overdueCount: overdueSchedules?.length || 0,
        alertsGenerated: alertCount || 0,
        alertsSent: pendingAlerts?.length || 0,
        jobCardsCreated: dueSchedules?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in maintenance scheduler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});