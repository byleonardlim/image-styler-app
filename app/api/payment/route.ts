import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getBaseUrl(req: Request) {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase && /^https?:\/\//i.test(envBase)) {
    return envBase.replace(/\/+$/, '');
  }
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host) {
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  const origin = new URL(req.url).origin;
  if (/^https?:\/\//i.test(origin)) {
    return origin.replace(/\/+$/, '');
  }
  throw new Error('Unable to determine base URL');
}

interface CreateSessionRequest {
  price_data: {
    currency: string;
    unit_amount: number; // amount in cents (e.g., $10.00 = 1000)
    product_data: {
      name: string;
      description: string;
    };
  };
  style: string;
  imageUrls: string[]; // Appwrite URLs
  fileIds: string[];   // Appwrite file IDs
  customerEmail?: string;
}

export async function POST(req: Request) {
  try {
    const { price_data, style, imageUrls, customerEmail, fileIds = [] } = await req.json() as CreateSessionRequest;

    if (!style || !imageUrls || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Style and at least one image URL are required' }, 
        { status: 400 }
      );
    }

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
      const baseUrl = getBaseUrl(req);
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
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/failure`,
      metadata: {
        productName: price_data.product_data.name,
        selectedStyle: style,
        // Note: Stripe metadata values have a character limit (500 characters).
        // If imageUrls or fileIds arrays can be very large, consider storing
        // them in a database linked by a unique ID in Stripe metadata.
        imageUrls: JSON.stringify(imageUrls),
        fileIds: JSON.stringify(fileIds),
      },
      customer_email: customerEmail,
    });

      return NextResponse.json({ url: session.url });
    } catch (error) {
      console.error('Stripe API error:', error);
      throw error; // Rethrow so it's caught by the outer catch block
    }

  } catch (error) {
    console.error('Stripe API error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
