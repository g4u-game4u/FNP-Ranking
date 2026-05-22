// Supabase Edge Function: Update Leaderboard
// Updates leaderboard entries from external source or manual input

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeaderboardEntry {
  player_code: string;
  position: number;
  total: number;
}

interface RequestBody {
  leaderboard_id: string;
  entries: LeaderboardEntry[];
  snapshot_date?: string;
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
    const body: RequestBody = await req.json();
    const { leaderboard_id, entries, snapshot_date } = body;

    if (!leaderboard_id || !entries || !Array.isArray(entries)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: leaderboard_id, entries' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const date = snapshot_date || new Date().toISOString().split('T')[0];
    const results = [];
    const errors = [];

    // Process each entry
    for (const entry of entries) {
      try {
        // Find player by player_code
        const { data: player, error: playerError } = await supabaseClient
          .from('players')
          .select('id')
          .eq('player_code', entry.player_code)
          .single();

        if (playerError || !player) {
          errors.push({
            player_code: entry.player_code,
            error: 'Player not found',
          });
          continue;
        }

        // Call upsert function
        const { error: upsertError } = await supabaseClient.rpc(
          'upsert_leaderboard_entry',
          {
            p_leaderboard_id: leaderboard_id,
            p_player_id: player.id,
            p_position: entry.position,
            p_total: entry.total,
            p_snapshot_date: date,
          }
        );

        if (upsertError) {
          errors.push({
            player_code: entry.player_code,
            error: upsertError.message,
          });
        } else {
          results.push({
            player_code: entry.player_code,
            position: entry.position,
            total: entry.total,
          });
        }
      } catch (error) {
        errors.push({
          player_code: entry.player_code,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: results.length,
        errors: errors.length,
        results,
        errors,
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
