import Stripe from 'npm:stripe@14';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
});

type Mode = Stripe.Checkout.SessionCreateParams.Mode;

const PRICE_MAP: Record<string, { amount: number; name: string; mode: Mode; interval?: 'month' | 'year' }> = {
  founding_member_monthly: { amount: 2499, name: 'Founding Member (Monthly)', mode: 'subscription', interval: 'month' },
  premium_monthly:         { amount: 4999, name: 'Premium (Monthly)', mode: 'subscription', interval: 'month' },
  premium_annual:          { amount: 59988, name: 'Premium (Annual)', mode: 'subscription', interval: 'year' },
  workshop_standard:       { amount: 3999, name: 'Workshop Standard Access', mode: 'payment' },
  workshop_premium_access: { amount: 7900, name: 'Workshop Premium Access', mode: 'payment' },
  summit_general:          { amount: 9700, name: 'Mission to Money Summit: General Admission', mode: 'payment' },
  summit_vip:              { amount: 15000, name: 'Mission to Money Summit: VIP Experience', mode: 'payment' },
  summit_premier:          { amount: 19700, name: 'Mission to Money Summit: Premier Experience', mode: 'payment' },
  application_fee:         { amount: 2000, name: 'Program Application Fee', mode: 'payment' },
  hot_seat_sponsorship:    { amount: 100000, name: 'Making Missions Make Cents Hot Seat Sponsorship', mode: 'payment' },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { priceKey, successUrl, cancelUrl, customerEmail, metadata } = body;

    if (!priceKey || !PRICE_MAP[priceKey]) {
      return new Response(JSON.stringify({ error: `Invalid price key: ${priceKey}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceConfig = PRICE_MAP[priceKey];
    const origin = req.headers.get('origin') ?? '';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: priceConfig.mode,
      success_url: successUrl || `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=${priceKey}`,
      cancel_url: cancelUrl || `${origin}/payment-cancel`,
      metadata: metadata || {},
    };

    if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    if (priceConfig.mode === 'subscription' && priceConfig.interval) {
      sessionParams.line_items = [{
        price_data: {
          currency: 'usd',
          product_data: { name: priceConfig.name },
          unit_amount: priceConfig.amount,
          recurring: { interval: priceConfig.interval },
        },
        quantity: 1,
      }];
    } else {
      sessionParams.line_items = [{
        price_data: {
          currency: 'usd',
          product_data: { name: priceConfig.name },
          unit_amount: priceConfig.amount,
        },
        quantity: 1,
      }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
