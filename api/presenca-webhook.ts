import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Presença (Attendance) Webhook
 * Receives attendance data from Raspberry Pi via N8N
 * 
 * Expected payload:
 * {
 *   "uid": "player_uid",
 *   "station": "station_name",
 *   "ts": 1234567890
 * }
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    const { uid, station, ts } = req.body;

    // Validate required fields
    if (!uid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: uid'
      });
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Convert timestamp to ISO string if provided
    const timestamp = ts ? new Date(ts * 1000).toISOString() : new Date().toISOString();

    // Call the log_presenca function
    const { data, error } = await supabase.rpc('log_presenca', {
      p_uid: uid,
      p_station: station || null,
      p_timestamp: timestamp
    });

    if (error) {
      console.error('Error logging presença:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to log presence',
        details: error.message
      });
    }

    // Check if player was found
    if (!data.success) {
      return res.status(404).json(data);
    }

    console.log('Presença logged successfully:', {
      player_id: data.player_id,
      player_name: data.player_name,
      points_awarded: data.points_awarded,
      is_first_today: data.is_first_today
    });

    return res.status(200).json(data);

  } catch (error: any) {
    console.error('Unexpected error in presença webhook:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
