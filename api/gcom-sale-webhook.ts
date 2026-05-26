import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * GCOM Sale Webhook
 * Receives store-wide sale data from GCOM via N8N
 * Awards points to ALL players who had presence today
 * 
 * Expected payload:
 * {
 *   "delivery_title": "Product Name",
 *   "price": 100.50
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
    const { delivery_title, price } = req.body;

    // Validate required fields
    if (!delivery_title || price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: delivery_title, price'
      });
    }

    // Validate price is a number
    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid price value'
      });
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the log_store_sale function (awards to ALL players with presence)
    const { data, error } = await supabase.rpc('log_store_sale', {
      p_delivery_title: delivery_title,
      p_price: priceNum,
      p_sale_timestamp: new Date().toISOString()
    });

    if (error) {
      console.error('Error logging store sale:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to log store sale',
        details: error.message
      });
    }

    console.log('Store sale logged successfully:', {
      delivery_title,
      price: priceNum,
      players_awarded: data.players_awarded,
      total_points_awarded: data.total_points_awarded,
      points_per_player: data.points_per_player
    });

    return res.status(200).json(data);

  } catch (error: any) {
    console.error('Unexpected error in GCOM sale webhook:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
