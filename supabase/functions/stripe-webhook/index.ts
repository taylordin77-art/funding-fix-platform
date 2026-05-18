import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const TIER_MAP: Record<string, string> = {
  founding_member_monthly: 'founding_member',
  premium_monthly: 'premium',
  premium_annual: 'premium',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    let event: Stripe.Event;

    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};
      const priceKey = metadata.priceKey as string | undefined;
      const userId = metadata.userId as string | undefined;
      const workshopId = metadata.workshopId as string | undefined;
      const registrationId = metadata.registrationId as string | undefined;

      if (workshopId || registrationId) {
        if (registrationId) {
          await supabase
            .from('workshop_registrations')
            .update({ payment_status: 'paid', stripe_session_id: session.id })
            .eq('id', registrationId);
        }
      } else if (priceKey && userId && TIER_MAP[priceKey]) {
        await supabase
          .from('profiles')
          .update({
            membership_tier: TIER_MAP[priceKey],
            stripe_customer_id: session.customer as string ?? '',
            stripe_subscription_id: session.subscription as string ?? '',
            subscription_status: 'active',
            role: 'member',
          })
          .eq('id', userId);
      }
    }

    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.paused') {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from('profiles')
        .update({ membership_tier: 'free', subscription_status: 'inactive' })
        .eq('stripe_subscription_id', sub.id);
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      const status = sub.status === 'active' ? 'active' : 'inactive';
      await supabase
        .from('profiles')
        .update({ subscription_status: status })
        .eq('stripe_subscription_id', sub.id);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
