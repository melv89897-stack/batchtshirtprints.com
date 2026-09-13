import { useState } from 'react';

/**
 * <CheckoutButton plan="pro" checkoutUrl="/api/checkout" />
 *
 * Calls your backend to create a Stripe Checkout session, then redirects
 * the browser to Stripe's hosted payment page. No card details ever touch
 * your own frontend or server — Stripe handles that entirely.
 *
 * Props:
 *   plan         (required) — plan key matching a key in checkoutRouter's `prices` config
 *   checkoutUrl  (default '/api/checkout') — your backend's checkout endpoint
 *   label        (default 'Subscribe')
 *   onError      (optional) — called with an error message string on failure
 */
export function CheckoutButton({ plan, checkoutUrl = '/api/checkout', label = 'Subscribe', onError, className }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    // What-if: user double-clicks — ignore repeat clicks while a request is in flight.
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(checkoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      // What-if: backend responds with an error (not configured, invalid
      // plan, not logged in) — surface it instead of redirecting to nothing.
      if (!res.ok || !data.url) {
        onError?.(data.error || 'Could not start checkout. Please try again.');
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      onError?.('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={loading} className={className}>
      {loading ? 'Redirecting…' : label}
    </button>
  );
}
