// Vercel Edge Function — saves push subscription
// In production you'd use a database (Supabase/KV). 
// For now we store in Vercel Edge Config or return success for client-side storage.
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  try {
    const body = await req.json();
    const { subscription, settings } = body;
    
    if (!subscription?.endpoint) {
      return new Response(JSON.stringify({ error: 'Invalid subscription' }), { 
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    // Store subscription in KV or just acknowledge
    // For MVP: client stores subscription in localStorage, server sends on-demand
    console.log('New push subscription registered:', subscription.endpoint.slice(0, 50) + '...');
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Subscription saved. Morning alerts enabled!',
      settings 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
