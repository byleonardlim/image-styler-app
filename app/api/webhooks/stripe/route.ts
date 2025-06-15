import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// Define type for Supabase user data
interface SupabaseUser {
  id?: string;
  email: string;
  pin: string;
  stripe_customer_id: string;
  stripe_payment_intent: string;
  created_at: string;
  updated_at: string;
  payment_status?: string;
  last_payment_amount?: number;
  last_payment_currency?: string;
  last_payment_date?: string;
  profile_image_url?: string;
}

// Define type for Stripe checkout session metadata
interface CheckoutSessionMetadata {
  imageData?: string;
  imageContentType?: string;
  productName?: string;
}

// Define type for Supabase storage error
interface StorageError {
  message: string;
  details?: string;
}

// Define type for Supabase storage public URL response
interface StoragePublicUrlResponse {
  publicUrl: string;
  signedUrl: string;
}

// Define type for Supabase storage upload response
interface StorageUploadResponse {
  error?: StorageError;
  data?: {
    path: string;
  };
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export const POST = async (req: Request) => {
  try {
    // Get webhook secret from environment
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Parse the request body as raw text
    const sig = req.headers.get('stripe-signature');
    const body = await req.text();

    if (!sig) {
      return NextResponse.json(
        { error: 'No Stripe signature' },
        { status: 400 }
      );
    }

    // Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event);
        break;

      case 'payment_intent.created':
        await handlePaymentIntentCreated(event);
        break;

      case 'charge.succeeded':
        await handleChargeSucceeded(event);
        break;

      case 'charge.updated':
        await handleChargeUpdated(event);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Stripe webhook error:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
};

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  
  // Get the metadata that was stored during checkout
  const metadata = session.metadata || {};
  const productName = metadata.productName;
  const userEmail = session.customer_details?.email;
  
  if (!userEmail) {
    console.error('No email found in Stripe session');
    return;
  }

  // Generate an 8-character alphanumeric PIN
  const pin = crypto.randomBytes(4).toString('hex').toUpperCase();
  
  try {
    // Create user in Supabase using auth system
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userEmail,
      password: crypto.randomBytes(16).toString('hex'), // Generate secure password
      options: {
        data: {
          pin: pin,
          stripe_customer_id: session.customer,
          stripe_payment_intent: session.payment_intent,
          last_payment_amount: session.amount_total,
          last_payment_currency: session.currency,
          last_payment_date: new Date().toISOString(),
          payment_status: 'pending'
        }
      }
    });

    if (authError) {
      console.error('Error creating user in Supabase auth:', authError.message);
      throw authError;
    }

    if (!authData.user) {
      console.error('No user data returned from auth signup');
      throw new Error('Failed to create user');
    }

    console.log(`Successfully created user with email: ${userEmail}`);

    // Handle image upload if there's an image in the metadata
    if (metadata.imageData) {
      try {
        // Validate image data
        if (!metadata.imageData) {
          console.error('No image data provided');
          throw new Error('No image data provided');
        }

        // Generate a unique filename
        const fileName = `user_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
        const fileBuffer = Buffer.from(metadata.imageData, 'base64');

        // Determine file type from metadata or default to jpeg
        const contentType = metadata.imageContentType || 'image/jpeg';
        const validContentTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const maxFileSize = 10 * 1024 * 1024; // 10MB

        if (!validContentTypes.includes(contentType)) {
          console.error('Unsupported image type:', contentType);
          throw new Error(`Unsupported image type: ${contentType}`);
        }

        // Validate file size
        if (fileBuffer.length > maxFileSize) {
          console.error('Image file too large');
          throw new Error('Image file size exceeds 10MB limit');
        }

        // Upload image to Supabase storage
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('images')
          .upload(fileName, fileBuffer, {
            upsert: true,
            cacheControl: '3600',
            contentType: contentType,
            metadata: {
              uploaded_by: userEmail,
              uploaded_at: new Date().toISOString(),
              checkout_session_id: session.id
            }
          });

        if (uploadError) {
          console.error('Error uploading image to Supabase:', {
            message: uploadError.message,
            error: uploadError
          });
          throw uploadError;
        }

        if (!uploadData) {
          console.error('No upload data returned from Supabase');
          throw new Error('Failed to upload image');
        }

        // Get the public URL for the uploaded image
        const { data: publicUrlData } = supabase.storage
          .from('images')
          .getPublicUrl(fileName);

        if (!publicUrlData?.publicUrl) {
          console.error('Failed to get public URL for uploaded image');
          throw new Error('Failed to get public URL for uploaded image');
        }

        // Update user's profile image URL using auth system
        const { error: updateError } = await supabase.auth.updateUser({
          data: { profile_image_url: publicUrlData.publicUrl }
        });

        if (updateError) {
          console.error('Error updating user with image URL:', updateError.message);
        } else {
          console.log(`Successfully updated profile image for user: ${userEmail}`);
        }
      } catch (error) {
        console.error('Failed to process image upload:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        // Continue with user creation even if image upload fails
      }
    }
    
    console.log(`Payment amount: ${(session.amount_total! / 100).toFixed(2)} ${session.currency}`);
    console.log(`Customer ID: ${session.customer}`);
    console.log(`Payment intent: ${session.payment_intent}`);
    }

    console.log(`Payment amount: ${(session.amount_total! / 100).toFixed(2)} ${session.currency}`);
    console.log(`Customer ID: ${session.customer}`);
    console.log(`Payment intent: ${session.payment_intent}`);

  } catch (error) {
    console.error('Error processing checkout session:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  // Handle successful payment
  console.log(`Payment succeeded: ${paymentIntent.id}`);
}

async function handlePaymentIntentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  // Handle failed payment
  console.log(`Payment failed: ${paymentIntent.id}`);
}

async function handlePaymentIntentCreated(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  console.log(`Payment intent created: ${paymentIntent.id}`);
}

async function handleChargeSucceeded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  console.log(`Charge succeeded: ${charge.id}`);
  
  // Update payment status in Supabase if needed
  try {
    const { data, error: updateError } = await supabase
      .from('users')
      .update({ 
        payment_status: 'succeeded',
        last_payment_amount: charge.amount,
        last_payment_currency: charge.currency,
        last_payment_date: new Date().toISOString()
      })
      .eq('stripe_payment_intent', charge.payment_intent);
    
    if (updateError) {
      console.error('Error updating payment status:', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code
      });
      return;
    }

    if (data && Array.isArray(data)) {
      const updatedUser = data[0] as SupabaseUser;
      if (updatedUser && updatedUser.email) {
        console.log(`Successfully updated payment status for user: ${updatedUser.email}`);
      } else {
        console.error('Updated user data is missing email field');
      }
    }
  } catch (error) {
    console.error('Error handling charge succeeded:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

async function handleChargeUpdated(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  console.log(`Charge updated: ${charge.id}`);
  
  // Update payment status in Supabase if needed
  try {
    const { data, error: updateError } = await supabase
      .from('users')
      .update({ 
        payment_status: charge.status,
        last_payment_amount: charge.amount,
        last_payment_currency: charge.currency,
        last_payment_date: new Date().toISOString()
      })
      .eq('stripe_payment_intent', charge.payment_intent);
    
    if (updateError) {
      console.error('Error updating payment status:', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code
      });
      return;
    }

    if (data && Array.isArray(data)) {
      const updatedUser = data[0] as SupabaseUser;
      if (updatedUser && updatedUser.email) {
        console.log(`Successfully updated payment status for user: ${updatedUser.email}`);
      } else {
        console.error('Updated user data is missing email field');
      }
    }
  } catch (error) {
    console.error('Error handling charge updated:', error instanceof Error ? error.message : 'Unknown error');
  }
}
