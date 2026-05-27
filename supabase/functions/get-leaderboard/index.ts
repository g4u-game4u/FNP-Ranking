// Supabase Edge Function: Get Leaderboard Data
// Returns leaderboard data with players in app-compatible format

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get leaderboard ID from URL
    const url = new URL(req.url);
    const leaderboardId = url.searchParams.get('id');
    const snapshotDate = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!leaderboardId) {
      return new Response(
        JSON.stringify({ error: 'Missing leaderboard ID' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get leaderboard info
    const { data: leaderboard, error: lbError } = await supabaseClient
      .from('leaderboards')
      .select('*')
      .eq('id', leaderboardId)
      .single();

    if (lbError || !leaderboard) {
      return new Response(
        JSON.stringify({ error: 'Leaderboard not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get leaderboard data using the function
    const { data: players, error: playersError } = await supabaseClient.rpc(
      'get_leaderboard_data',
      {
        p_leaderboard_id: leaderboardId,
        p_live: true,
        p_snapshot_date: snapshotDate,
      }
    );

    if (playersError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch players', details: playersError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Transform to app-compatible format
    const response = {
      leaderboard: {
        _id: leaderboard.id,
        title: leaderboard.title,
        description: leaderboard.description,
        principalType: leaderboard.principal_type,
        operation: {
          type: leaderboard.operation_type,
          achievement_type: leaderboard.achievement_type,
          item: leaderboard.operation_item,
          sort: leaderboard.sort_order,
        },
        period: {
          type: leaderboard.period_type,
          timeAmount: leaderboard.period_time_amount,
          timeScale: leaderboard.period_time_scale,
        },
      },
      leaders: (players || []).map((p: any) => ({
        _id: p.player_id,
        player: p.player_code,
        name: p.player_name,
        position: p.position,
        total: parseFloat(p.total),
        previous_position: p.previous_position,
        previous_total: p.previous_total ? parseFloat(p.previous_total) : undefined,
        move: p.move,
        image: p.image_url,
        extra: p.extra,
      })),
    };

    return new Response(
      JSON.stringify(response),
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
