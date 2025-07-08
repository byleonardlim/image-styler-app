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
  images: string[];
  style: string;
}

export default function CheckoutForm({ 
  onPayment, 
  loading, 
  disabled, 
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
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images, style }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create checkout session. Please try again.');
        return;
      }

      const { url } = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.assign(url);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
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
