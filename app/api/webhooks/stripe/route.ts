import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { Databases, Storage, ID, type Models } from 'node-appwrite';
import { databases, storage } from '@/lib/appwrite';  // Import initialized instances
import { Query } from 'node-appwrite';
import { nanoid } from 'nanoid';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Types
interface ImageUploadResult {
  fileId: string;
  fileUrl: string;
}

interface JobData extends Models.Document {
  // $id is the unique document ID in Appwrite, automatically assigned
  $id: string;
  stripe_session_id: string;
  stripe_payment_intent: string;
  customer_email: string;
  customer_name: string;
  job_status: 'pending' | 'processing' | 'completed' | 'failed';
  payment_status: string;
  payment_amount: number;
  payment_currency: string;
  selected_style_name: string;
  created_at: Date;
  updated_at: Date;
  // Allows for additional dynamic properties on the object
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
// Generate a unique job ID using nanoid
const generateJobId = (email: string): string => {
  const emailPrefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '');
  const uniqueId = nanoid(10); // Generates a 10-character ID
  return `${emailPrefix}-${uniqueId}`;
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

const createJob = async (
  session: Stripe.Checkout.Session,
  imageUrl?: string
) => {
  try {

    const currentDate = new Date().toISOString();
    const jobId = generateJobId(session.customer_details?.email || 'user');
    
    // Document data with proper typing for Appwrite
    const jobData = {
      // System fields required by Appwrite
      $id: jobId,
      $createdAt: currentDate,
      $updatedAt: currentDate,
      $permissions: [], // Set appropriate permissions if needed
      
      // Custom fields
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent as string,
      customer_email: session.customer_details?.email || '',
      customer_name: session.customer_details?.name || '',
      job_status: 'pending',
      payment_status: 'paid',
      payment_amount: session.amount_total ? session.amount_total / 100 : 0,
      payment_currency: session.currency?.toUpperCase() || 'USD',
      selected_style_name: (session.metadata?.styleName || '').trim(),
      created_at: currentDate,
      updated_at: currentDate,
      // Include image URL if provided
      ...(imageUrl && { profile_image_url: imageUrl })
    };

    console.log('Creating job with data:', JSON.stringify(jobData, null, 2));
    console.log('Database ID:', process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID);
    console.log('Collection ID:', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID);

    // Create document in Appwrite
    const result = await databases.createDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!,
      jobId,
      jobData
    );

    console.log('Document created successfully:', result.$id);
    return result;
  } catch (error: unknown) {
    const errorData = error as {
      message?: string;
      code?: string | number;
      type?: string;
      response?: any;
      stack?: string;
    };
    
    console.error('Error in createJob:', {
      message: errorData.message || 'Unknown error',
      code: errorData.code,
      type: errorData.type,
      response: errorData.response ? JSON.stringify(errorData.response) : undefined,
      stack: errorData.stack
    });
    
    throw new Error(`Failed to create job: ${errorData.message}`);
  }
};

const updateJobWithImage = async (
  jobId: string,
  imageUrl: string
): Promise<void> => {
  await databases.updateDocument(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!,
    jobId,
    {
      profile_image_url: imageUrl,
      updated_at: new Date().toISOString()
    }
  );
};

const findJobBySessionId = async (sessionId: string): Promise<JobData | null> => {
  try {
    const result = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      'jobs',
      [Query.equal('stripe_session_id', sessionId)]
    );
    
    return result.documents.length > 0 ? result.documents[0] as unknown as JobData : null;
  } catch (error) {
    console.error('Error finding job by session ID:', error);
    return null;
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
  const userEmail = session.customer_details?.email || 'unknown@example.com';
  


  try {
    // Check if job already exists for this session
    const existingJob = await findJobBySessionId(session.id);
    if (existingJob) {
      console.log('Job already exists for session:', session.id);
      return;
    }

    let imageUrl = '';
    
    // Handle image upload if present
    if (metadata?.imageData) {
      try {
        const { fileUrl } = await uploadImageToStorage(
          metadata.imageData,
          metadata.imageContentType || 'image/jpeg',
          userEmail
        );
        imageUrl = fileUrl;
        console.log('Successfully uploaded image for session:', session.id);
      } catch (error) {
        console.error('Image upload failed, continuing without image:', error);
      }
    }

    // Create job
    const job = await createJob(session, imageUrl);

    if (!job) {
      throw new Error('Failed to create job: No job data returned');
    }

    console.log('Checkout session processed successfully:', {
      jobId: job.$id,
      sessionId: session.id,
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