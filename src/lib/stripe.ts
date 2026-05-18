const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type PriceKey =
  | 'founding_member_monthly'
  | 'premium_monthly'
  | 'premium_annual'
  | 'workshop_standard'
  | 'workshop_premium_access'
  | 'summit_general'
  | 'summit_vip'
  | 'summit_premier'
  | 'application_fee'
  | 'hot_seat_sponsorship';

interface CheckoutOptions {
  priceKey: PriceKey;
  customerEmail?: string;
  userId?: string;
  metadata?: Record<string, string>;
}

export async function redirectToCheckout(opts: CheckoutOptions): Promise<void> {
  const origin = window.location.origin;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      priceKey: opts.priceKey,
      customerEmail: opts.customerEmail,
      successUrl: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=${opts.priceKey}`,
      cancelUrl: `${origin}/payment-cancel`,
      metadata: {
        priceKey: opts.priceKey,
        userId: opts.userId ?? '',
        ...opts.metadata,
      },
    }),
  });

  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  } else {
    throw new Error(data.error ?? 'Failed to create checkout session');
  }
}

export const PRICE_LABELS: Record<PriceKey, { label: string; amount: string }> = {
  founding_member_monthly: { label: 'Founding Member', amount: '$24.99/mo' },
  premium_monthly: { label: 'Premium', amount: '$49.99/mo' },
  premium_annual: { label: 'Premium Annual', amount: '$49.99/mo (billed annually)' },
  workshop_standard: { label: 'Workshop Standard Access', amount: 'varies' },
  workshop_premium_access: { label: 'Workshop Premium Access', amount: '$79' },
  summit_general: { label: 'Summit General Admission', amount: '$97' },
  summit_vip: { label: 'Summit VIP Experience', amount: '$150' },
  summit_premier: { label: 'Summit Premier Experience', amount: '$197' },
  application_fee: { label: 'Application Fee', amount: '$20' },
  hot_seat_sponsorship: { label: 'Hot Seat Sponsorship', amount: '$1,000' },
};
