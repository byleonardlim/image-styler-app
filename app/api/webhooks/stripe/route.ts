import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { Account, Databases, Storage, ID, type Models } from 'node-appwrite';
import { account, databases, storage } from '@/lib/appwrite';  // Import initialized instances
import { Query } from 'node-appwrite';
import crypto from 'crypto';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const PIN_LENGTH = 8;

// Types
interface ImageUploadResult {
  fileId: string;
  fileUrl: string;
}

interface AppwriteUser extends Models.Document {
  $id: string;
  email: string;
  name?: string;
  stripe_customer_id: string;
  stripe_payment_intent: string;
  created_at: string;
  updated_at: string;
  payment_status: string;
  last_payment_amount: number;
  last_payment_currency: string;
  last_payment_date: string;
  profile_image_url: string;
  [key: string]: any;
}

interface CheckoutSessionMetadata {
  imageData?: string;
  imageContentType?: string;
  productName?: string;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

// Helper functions
const sendMagicLink = async (email: string, userId: string): Promise<void> => {
  try {
    const verificationUrl = `${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : process.env.NEXT_PUBLIC_BASE_URL}/verify`;
    await account.createMagicURLToken(userId, verificationUrl);
    console.log(`Magic link sent to ${email}`);
  } catch (error) {
    console.error('Error sending magic link:', error);
    throw new Error('Failed to send magic link');
  }
};

const validateImageUpload = (buffer: Buffer, contentType: string): void => {
  if (!VALID_IMAGE_TYPES.includes(contentType as any)) {
    throw new Error(`Unsupported image type: ${contentType}`);
  }
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('Image file size exceeds 10MB limit');
  }
};

const uploadImageToStorage = async (
  imageData: string, 
  contentType: string, 
  userEmail: string
): Promise<ImageUploadResult> => {
  const fileName = `user_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
  const fileBuffer = Buffer.from(imageData, 'base64');
  
  validateImageUpload(fileBuffer, contentType);

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: contentType });
  formData.append('fileId', ID.unique());
  formData.append('file', new File([blob], fileName, { type: contentType }));

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/images/files`,
    {
      method: 'POST',
      headers: {
        'X-Appwrite-Project': process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!,
        'X-Appwrite-Key': process.env.APPWRITE_API_KEY!,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to upload file: ${errorText}`);
  }

  const uploadedFile = await response.json() as StorageFileResponse;
  if (!uploadedFile?.$id) {
    throw new Error('No file data returned from Appwrite');
  }

  // Get the file preview URL
  const filePreview = storage.getFilePreview('images', uploadedFile.$id);
  const fileUrl = typeof filePreview === 'string' 
    ? filePreview 
    : `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/images/files/${uploadedFile.$id}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;

  return {
    fileId: uploadedFile.$id,
    fileUrl
  };
};

const createJob = async (userId: string) => {
  return databases.createDocument(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    'jobs',
    ID.unique(),
    {
      userId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );
};

const updateExistingUser = async (
  userId: string,
  session: Stripe.Checkout.Session,
  currentDate: string
): Promise<void> => {
  const existingUser = await databases.getDocument(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID!,
    userId
  );

  if (!existingUser) return;

  const userData = {
    ...existingUser,
    stripe_customer_id: session.customer as string || existingUser.stripe_customer_id,
    stripe_payment_intent: session.payment_intent as string || existingUser.stripe_payment_intent,
    updated_at: currentDate,
    last_payment_amount: session.amount_total ? session.amount_total / 100 : existingUser.last_payment_amount,
    last_payment_currency: session.currency || existingUser.last_payment_currency || 'usd',
    last_payment_date: currentDate,
    name: session.customer_details?.name || existingUser.name || ''
  };

  await databases.updateDocument(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID!,
    userId,
    userData
  );
};

const createNewUser = async (
  email: string,
  session: Stripe.Checkout.Session,
  currentDate: string
): Promise<string> => {
  const userId = ID.unique();
  
  try {
    // Create a new user with email/password (password will be reset via magic link)
    const tempPassword = crypto.randomBytes(32).toString('hex');
    const userName = session.customer_details?.name || 'User';
    await account.create(userId, email, tempPassword, userName);
    
    // Create the user document
    const userData = {
      email,
      name: session.customer_details?.name || '',
      stripe_customer_id: session.customer as string,
      stripe_payment_intent: session.payment_intent as string,
      created_at: currentDate,
      updated_at: currentDate,
      payment_status: 'pending',
      last_payment_amount: session.amount_total ? session.amount_total / 100 : 0,
      last_payment_currency: session.currency || 'usd',
      last_payment_date: currentDate,
      profile_image_url: ''
    };
    
    await databases.createDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID!,
      userId,
      userData
    );
    
    // Send magic link for email verification
    await sendMagicLink(email, userId);
    
    return userId;
  } catch (error) {
    console.error('Error creating user:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    throw new Error(`Failed to create user account: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Webhook event handlers
async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  console.log('PaymentIntent was successful:', paymentIntent.id);
  return { success: true };
}

async function handlePaymentIntentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  console.error('PaymentIntent failed:', paymentIntent.id, paymentIntent.last_payment_error);
  return { success: false, error: paymentIntent.last_payment_error };
}

async function handlePaymentIntentCreated(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  console.log('PaymentIntent was created:', paymentIntent.id);
  return { success: true };
}

async function handleChargeSucceeded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  console.log('Charge succeeded:', charge.id, 'Amount:', charge.amount, charge.currency);
  return { success: true };
}

async function handleChargeUpdated(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  console.log('Charge was updated:', charge.id, 'Status:', charge.status);
  return { success: true };
}

// Storage related types
interface StorageError {
  message: string;
  code?: number;
  type?: string;
}

interface StorageFileResponse {
  $id: string;
  bucketId: string;
  name: string;
  mimeType: string;
  sizeOriginal: number;
  signature: string;
  chunksTotal: number;
  chunksUploaded: number;
}

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
  const metadata = session.metadata as CheckoutSessionMetadata || {};
  const userEmail = session.customer_details?.email;
  
  if (!userEmail) {
    throw new Error('No email found in Stripe session');
  }

  try {
    const currentDate = new Date().toISOString();
    let userId: string;

    // Create new user
    try {
      userId = await createNewUser(userEmail, session, currentDate);
      
      // Send magic link for email verification
      await sendMagicLink(userEmail, userId);
    } catch (error) {
      console.error('Error creating new user:', error);
      throw error;
    }

    // Handle image upload if present
    if (metadata?.imageData) {
      try {
        const { fileUrl } = await uploadImageToStorage(
          metadata.imageData,
          metadata.imageContentType || 'image/jpeg',
          userEmail
        );

        await databases.updateDocument(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
          process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID!,
          userId,
          {
            profile_image_url: fileUrl,
            updated_at: currentDate
          }
        );
        
        console.log(`Successfully updated profile image for user: ${userEmail}`);
      } catch (error) {
        console.error('Image upload failed, continuing without image:', error);
      }
    }

    // Create job
    await createJob(userId);

    console.log('Checkout session processed successfully:', {
      userId,
      paymentAmount: session.amount_total ? (session.amount_total / 100).toFixed(2) : 0,
      currency: session.currency,
      customerId: session.customer,
      paymentIntent: session.payment_intent
    });

  } catch (error) {
    console.error('Error in handleCheckoutSessionCompleted:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      sessionId: session.id
    });
    throw error; // Re-throw to be caught by the main handler
  }
}