// Supabase Edge Function: Challenge Webhook
// Receives challenge completion events and records them

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChallengeEvent {
  player_code: string;
  challenge_id?: string;
  challenge_name?: string;
  event_type: 'started' | 'progress' | 'completed';
  points_awarded?: number;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Parse request body
    const event: ChallengeEvent = await req.json();

    if (!event.player_code || !event.event_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: player_code, event_type' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Find player
    const { data: player, error: playerError } = await supabaseClient
      .from('players')
      .select('id')
      .eq('player_code', event.player_code)
      .single();

    if (playerError || !player) {
      return new Response(
        JSON.stringify({ error: 'Player not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Find or create challenge
    let challengeId = event.challenge_id;
    
    if (!challengeId && event.challenge_name) {
      // Try to find challenge by name
      const { data: challenge } = await supabaseClient
        .from('challenges')
        .select('id')
        .eq('name', event.challenge_name)
        .single();

      if (challenge) {
        challengeId = challenge.id;
      } else {
        // Create new challenge
        const { data: newChallenge, error: createError } = await supabaseClient
          .from('challenges')
          .insert({
            name: event.challenge_name,
            challenge_type: event.metadata?.type || 'general',
            points: event.points_awarded || 0,
          })
          .select('id')
          .single();

        if (createError) {
          return new Response(
            JSON.stringify({ error: 'Failed to create challenge', details: createError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        challengeId = newChallenge.id;
      }
    }

    if (!challengeId) {
      return new Response(
        JSON.stringify({ error: 'Challenge ID or name required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Record challenge event using the helper function
    const { data: eventId, error: recordError } = await supabaseClient.rpc(
      'record_challenge_event',
      {
        p_player_id: player.id,
        p_challenge_id: challengeId,
        p_event_type: event.event_type,
        p_points_awarded: event.points_awarded || 0,
        p_metadata: event.metadata || {},
      }
    );

    if (recordError) {
      return new Response(
        JSON.stringify({ error: 'Failed to record event', details: recordError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: eventId,
        player_id: player.id,
        challenge_id: challengeId,
        event_type: event.event_type,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
