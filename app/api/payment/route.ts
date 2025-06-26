import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

interface CreateSessionRequest {
  price_data: {
    currency: string;
    unit_amount: number; // amount in cents (e.g., $10.00 = 1000)
    product_data: {
      name: string;
      description: string;
    };
  };
  style?: string;
}

export async function POST(req: Request) {
  try {
    const { price_data, style } = await req.json() as CreateSessionRequest;

    // Validate price data
    if (!price_data || 
        !price_data.currency || 
        price_data.unit_amount === undefined || 
        !price_data.product_data || 
        !price_data.product_data.name || 
        !price_data.product_data.description) {
      return NextResponse.json({ error: 'Invalid price data' }, { status: 400 });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: price_data.currency,
            unit_amount: price_data.unit_amount, // amount in cents
            product_data: {
              name: price_data.product_data.name,
              description: price_data.product_data.description,
            },
          },
          quantity: 1,
        }],
      success_url: `${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : process.env.NEXT_PUBLIC_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : process.env.NEXT_PUBLIC_BASE_URL}/failure`,
      metadata: {
        productName: price_data.product_data.name,
        styleName: style || 'default'
      }
    });

      return NextResponse.json({ url: session.url });
    } catch (error) {
      console.error('Stripe API error:', error);
      throw error; // Rethrow so it's caught by the outer catch block
    }

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
