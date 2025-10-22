import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { IMAGE_PRICING } from '@/config/pricing';
import { storage as appwriteStorage } from '@/lib/appwriteServer';
import { appwriteBucketId } from '@/lib/appwrite';

// Simple in-memory rate limit (best-effort, single-instance)
const rlMap = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60 * 1000; // 1 minute
const LIMIT = 20; // 20 ops per window

function keyForRateLimit(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'ip:unknown';
  const cookieHeader = req.headers.get('cookie') || '';
  const sidMatch = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  const sid = sidMatch ? decodeURIComponent(sidMatch[1]) : 'sid:unknown';
  return `${sid}|${ip}`;
}

function checkRateLimit(req: Request) {
  const key = keyForRateLimit(req);
  const now = Date.now();
  const entry = rlMap.get(key);
  if (!entry || now - entry.ts > WINDOW_MS) {
    rlMap.set(key, { count: 1, ts: now });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count += 1;
  return true;
}

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
  // Client-provided price_data is ignored for amount; we compute on server.
  price_data?: {
    currency?: string;
    unit_amount?: number;
    product_data?: {
      name?: string;
      description?: string;
    };
  };
  style: string;
  imageUrls?: string[]; // deprecated in favor of fileIds
  fileIds: string[];   // Appwrite file IDs
  customerEmail?: string;
  appwriteUserId?: string;
}

export async function POST(req: Request) {
  try {
    if (!checkRateLimit(req)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const { price_data, style, imageUrls, customerEmail, fileIds = [], appwriteUserId } = await req.json() as CreateSessionRequest;

    // Basic input validation
    if (!style) {
      return NextResponse.json({ error: 'Style is required' }, { status: 400 });
    }
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'At least one fileId is required' }, { status: 400 });
    }

    // Validate fileIds exist in storage (best-effort)
    try {
      await Promise.all(
        fileIds.map((fid) => appwriteStorage.getFile(appwriteBucketId, fid))
      );
    } catch (e) {
      return NextResponse.json({ error: 'One or more files not found' }, { status: 400 });
    }

    // Compute server-side pricing from file count
    const imageCount = fileIds.length;
    const baseCount = Math.min(imageCount, IMAGE_PRICING.BULK_THRESHOLD);
    const extraCount = Math.max(imageCount - IMAGE_PRICING.BULK_THRESHOLD, 0);
    const total = baseCount * IMAGE_PRICING.STANDARD_PRICE + extraCount * IMAGE_PRICING.BULK_PRICE;
    const unitAmountCents = Math.round(total * 100);

    try {
      const baseUrl = getBaseUrl(req);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: (price_data?.currency || 'usd'),
            unit_amount: unitAmountCents,
            product_data: {
              name: (price_data?.product_data?.name || 'Image Styler Service'),
              description: (price_data?.product_data?.description || `${imageCount} images with ${style} style`),
            },
          },
          quantity: 1,
        }],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/failure`,
      metadata: {
        productName: 'Image Styler Service',
        selectedStyle: style,
        // Note: Stripe metadata values have a character limit (500 characters).
        // If imageUrls or fileIds arrays can be very large, consider storing
        // them in a database linked by a unique ID in Stripe metadata.
        imageUrls: JSON.stringify(imageUrls || []),
        fileIds: JSON.stringify(fileIds),
        appwriteUserId: appwriteUserId || '',
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
