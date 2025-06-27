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
  image_urls: string[];  // Array to store URLs of the uploaded images
  created_at: Date;
  updated_at: Date;
  // Allows for additional dynamic properties on the object
  [key: string]: any;
}

interface CheckoutSessionMetadata {
  imageData?: string;
  imageContentType?: string;
  productName?: string;
  imageUrls?: string | string[];  // Can be string (JSON) or array
  selectedStyle?: string;
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

const createJob = async function createJob(
  session: Stripe.Checkout.Session,
  imageUrls: string[] = []
) {
  try {

    const currentDate = new Date().toISOString();
    const jobId = generateJobId(session.customer_details?.email || 'user');
    
    const metadata = session.metadata as unknown as CheckoutSessionMetadata || {};
  
    const jobData: Partial<JobData> = {
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent as string,
      customer_email: session.customer_details?.email || '',
      customer_name: session.customer_details?.name || 'Unknown',
      job_status: 'pending',
      payment_status: session.payment_status,
      payment_amount: session.amount_total ? session.amount_total / 100 : 0,
      payment_currency: session.currency?.toUpperCase() || 'USD',
      selected_style_name: metadata.selectedStyle || '',
      image_urls: imageUrls,
      created_at: new Date(),
      updated_at: new Date(),
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
      process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!,
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
  console.log('PaymentIntent was successful!', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    metadata: paymentIntent.metadata
  });
  
  // If this payment intent is associated with a checkout session, we'll handle it there
  if (paymentIntent.metadata?.session_id) {
    const sessionId = paymentIntent.metadata.session_id;
    console.log('Processing checkout session:', sessionId);
    
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items']
      });
      
      console.log('Retrieved session:', {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email
      });
      
      if (session.payment_status === 'paid') {
        try {
          await handleCheckoutSessionCompleted({
            id: 'evt_' + Date(),
            object: 'event',
            api_version: '2025-05-28.basil',
            created: Math.floor(Date.now() / 1000),
            data: { object: session },
            livemode: false,
            pending_webhooks: 0,
            request: null,
            type: 'checkout.session.completed'
          } as Stripe.Event);
          console.log('Successfully processed checkout session:', sessionId);
        } catch (error) {
          console.error('Error in handleCheckoutSessionCompleted:', {
            error,
            sessionId,
            paymentIntentId: paymentIntent.id
          });
          throw error; // Re-throw to be caught by the outer try-catch
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error retrieving checkout session:', {
          error: error.message,
          sessionId,
          paymentIntentId: paymentIntent.id,
          stack: error.stack
        });
        
        if ('type' in error && 'code' in error && 
            error.type === 'StripeInvalidRequestError' && 
            error.code === 'resource_missing') {
          console.warn('Checkout session not found, but payment was successful. This might indicate a stale webhook event.');
          // Consider creating a support ticket or logging to an error tracking service
          return { success: true, warning: 'Checkout session not found' };
        }
      }
      throw error; // Re-throw the error if it's not a missing session
    }
  } else {
    console.log('No session_id found in payment intent metadata');
  }
  
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

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata as unknown as CheckoutSessionMetadata || {};
  const userEmail = session.customer_details?.email || 'unknown@example.com';
  
  try {
    // Check if job already exists for this session
    const existingJob = await findJobBySessionId(session.id);
    if (existingJob) {
      console.log('Job already exists for session:', session.id);
      return;
    }

    // Get the payment intent to check if payment was successful
    const paymentIntent = await stripe.paymentIntents.retrieve(
      session.payment_intent as string
    );

    if (paymentIntent.status !== 'succeeded') {
      console.log('Payment not successful, skipping job creation');
      return;
    }

    // Get image URLs from metadata
    let imageUrls: string[] = [];
    if (metadata.imageUrls) {
      try {
        // Handle both string (JSON) and array formats
        imageUrls = typeof metadata.imageUrls === 'string' 
          ? JSON.parse(metadata.imageUrls) 
          : metadata.imageUrls;
        
        // Ensure it's an array
        if (!Array.isArray(imageUrls)) {
          imageUrls = [];
        }
      } catch (error) {
        console.error('Error parsing image URLs:', error);
        imageUrls = [];
      }
    }
    
    // Create the job with the session and image data
    await createJob(session, imageUrls);
    
    console.log('Successfully created job for session:', session.id, 'with', imageUrls.length, 'images');
  } catch (error) {
    console.error('Error in handleCheckoutSessionCompleted:', error);
    throw error;
  }
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