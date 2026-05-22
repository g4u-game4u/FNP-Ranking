import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * GCOM Sale Webhook
 * Receives sale data from GCOM via N8N
 * 
 * Expected payload:
 * {
 *   "_id": "player@email.com",
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
    const { _id, delivery_title, price } = req.body;

    // Validate required fields
    if (!_id || !delivery_title || price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: _id, delivery_title, price'
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

    // Call the log_sale function
    const { data, error } = await supabase.rpc('log_sale', {
      p_player_email: _id,
      p_delivery_title: delivery_title,
      p_price: priceNum,
      p_sale_timestamp: new Date().toISOString()
    });

    if (error) {
      console.error('Error logging sale:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to log sale',
        details: error.message
      });
    }

    // Check if player was found
    if (!data.success) {
      return res.status(404).json(data);
    }

    console.log('Sale logged successfully:', {
      player_id: data.player_id,
      player_name: data.player_name,
      points_awarded: data.points_awarded,
      has_presence: data.has_presence,
      price: priceNum
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
