'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CheckoutFormProps {
  onPayment: () => void;
  loading: boolean;
  disabled: boolean;
  priceId: string;
  images: string[];
  style: string;
}

export default function CheckoutForm({ 
  onPayment, 
  loading, 
  disabled, 
  priceId,
  images,
  style 
}: CheckoutFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [stripe, setStripe] = useState<any>(null);

  useEffect(() => {
    if (!stripePromise) return;
    stripePromise.then(setStripe);
  }, []);

  const redirectToCheckout = async () => {
    if (!stripe) {
      setError('Stripe is not loaded');
      return;
    }

    try {
      const response = await fetch('/api/payment/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId, images, style }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();
      
      // Redirect to Stripe Checkout
      const result = await stripe.redirectToCheckout({ sessionId });

      if (result.error) {
        setError(result.error.message);
      } else {
        onPayment();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <Card className="p-6">
      {error && (
        <div className="text-red-500 text-sm mb-4">{error}</div>
      )}
      <Button 
        onClick={redirectToCheckout} 
        disabled={loading || disabled}
        className="w-full"
      >
        {loading ? 'Processing...' : 'Pay Now'}
      </Button>
    </Card>
  );
}
