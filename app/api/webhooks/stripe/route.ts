import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { Databases, Storage, ID, type Models } from 'node-appwrite';
import { databases, storage } from '@/lib/appwrite';  // Import initialized instances
import { Query } from 'node-appwrite';
import { nanoid } from 'nanoid';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Logging helper
const log = {
  info: (message: string, data: Record<string, any> = {}) => {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message,
      ...data
    }));
  },
  warn: (message: string, data: Record<string, any> = {}) => {
    console.warn(JSON.stringify({
      level: 'WARN',
      timestamp: new Date().toISOString(),
      message,
      ...data
    }));
  },
  error: (message: string, error: unknown, data: Record<string, any> = {}) => {
    const errorData = error instanceof Error 
      ? { error: error.message, stack: error.stack }
      : { error: String(error) };
    
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message,
      ...errorData,
      ...data
    }));
  }
};

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
  imageUrls?: string | string[];
  selectedStyle?: string;
  fileIds?: string | string[];
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

    log.info('Creating job', {
      jobId: jobId,
      customerEmail: jobData.customer_email,
      paymentStatus: jobData.payment_status,
      imageCount: jobData.image_urls?.length || 0
    });

    // Create document in Appwrite
    const result = await databases.createDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!,
      jobId,
      jobData
    );

    log.info('Job created successfully', { jobId: result.$id });
    return result;
  } catch (error: unknown) {
    const errorData = error as {
      message?: string;
      code?: string | number;
      type?: string;
      response?: any;
      stack?: string;
    };
    
    log.error('Failed to create job', error, {
      code: errorData.code,
      type: errorData.type,
      hasResponse: !!errorData.response
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
    log.error('Error finding job by session ID', error);
    return null;
  }
};

// Webhook event handlers
async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  log.info('PaymentIntent succeeded', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    hasMetadata: !!paymentIntent.metadata
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
          log.error('Error in handleCheckoutSessionCompleted', error, {
            sessionId,
            paymentIntentId: paymentIntent.id
          });
          throw error; // Re-throw to be caught by the outer try-catch
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        log.error('Error retrieving checkout session', error, {
          sessionId,
          paymentIntentId: paymentIntent.id
        });
        
        if ('type' in error && 'code' in error && 
            error.type === 'StripeInvalidRequestError' && 
            error.code === 'resource_missing') {
          log.warn('Checkout session not found for successful payment', {
            sessionId,
            paymentIntentId: paymentIntent.id,
            message: 'This might indicate a stale webhook event.'
          });
          // Consider creating a support ticket or logging to an error tracking service
          return { success: true, warning: 'Checkout session not found' };
        }
      }
      throw error; // Re-throw the error if it's not a missing session
    }
  } else {
    log.info('No session_id found in payment intent metadata');
  }
  
  return { success: true };
}

async function handlePaymentIntentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  log.error('PaymentIntent failed', new Error('Payment failed'), {
    paymentIntentId: paymentIntent.id,
    errorCode: paymentIntent.last_payment_error?.code,
    errorType: paymentIntent.last_payment_error?.type
  });
  return { success: false, error: paymentIntent.last_payment_error };
}

async function handlePaymentIntentCreated(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  log.info('PaymentIntent created', { paymentIntentId: paymentIntent.id });
  return { success: true };
}

async function handleChargeSucceeded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  log.info('Charge succeeded', {
    chargeId: charge.id,
    amount: charge.amount,
    currency: charge.currency
  });
  return { success: true };
}

async function handleChargeUpdated(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  log.info('Charge updated', {
    chargeId: charge.id,
    status: charge.status
  });
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
      log.info('Job already exists for session', { sessionId: session.id });
      return;
    }

    // Get the payment intent to check if payment was successful
    const paymentIntent = await stripe.paymentIntents.retrieve(
      session.payment_intent as string
    );

    if (paymentIntent.status !== 'succeeded') {
      log.info('Payment not successful, skipping job creation', {
        sessionId: session.id,
        paymentStatus: paymentIntent.status
      });
      return;
    }

    // Get file IDs from metadata
    let fileIds: string[] = [];
    if (metadata.fileIds) {
      try {
        // Handle both string (JSON) and array formats
        fileIds = typeof metadata.fileIds === 'string' 
          ? JSON.parse(metadata.fileIds) 
          : metadata.fileIds;
        
        // Ensure it's an array
        if (!Array.isArray(fileIds)) {
          fileIds = [];
        }
      } catch (error) {
        log.error('Error parsing file IDs', error);
        fileIds = [];
      }
    }
    
    // Generate Appwrite URLs from file IDs
    const imageUrls = fileIds.map(fileId => 
      `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID}/files/${fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`
    );
    
    // Create the job with the session and image data
    await createJob(session, imageUrls);
    
    log.info('Successfully created job', {
      sessionId: session.id,
      imageCount: imageUrls.length
    });
  } catch (error) {
    log.error('Error in handleCheckoutSessionCompleted', error);
    throw error;
  }
}

// Helper function to check required environment variables
const checkRequiredEnvVars = () => {
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_APPWRITE_ENDPOINT',
    'NEXT_PUBLIC_APPWRITE_PROJECT_ID',
    'APPWRITE_API_KEY',
    'NEXT_PUBLIC_APPWRITE_DATABASE_ID',
    'NEXT_PUBLIC_APPWRITE_COLLECTION_ID'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

export const POST = async (req: Request) => {
  try {
    // Check for required environment variables
    checkRequiredEnvVars();
    
    // Get webhook secret from environment
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      log.error('STRIPE_WEBHOOK_SECRET is not set', new Error('Configuration error'));
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Parse the request body as raw text
    const sig = req.headers.get('stripe-signature');
    if (!sig) {
      log.error('No Stripe signature found in request headers', new Error('Invalid request'));
      return NextResponse.json(
        { error: 'No Stripe signature' },
        { status: 400 }
      );
    }
    
    const body = await req.text();
    if (!body) {
      log.error('Empty request body', new Error('Invalid request'));
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }

    // Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      log.info('Received webhook event', {
        eventType: event.type,
        eventId: event.id
      });
    } catch (err) {
      const error = err as Error;
      log.error('Stripe webhook signature verification failed', error, {
        headers: Object.keys(Object.fromEntries(req.headers.entries()))
      });
      return NextResponse.json(
        { 
          error: 'Invalid webhook signature',
          details: error.message 
        },
        { status: 400 }
      );
    }

    // Handle the event
    try {
      log.info('Processing event', { eventType: event.type });
      
      switch (event.type) {
        case 'checkout.session.completed':
          log.info('Handling checkout.session.completed event');
          await handleCheckoutSessionCompleted(event);
          break;

        case 'payment_intent.succeeded':
          log.info('Handling payment_intent.succeeded event');
          await handlePaymentIntentSucceeded(event);
          break;

        case 'payment_intent.payment_failed':
          log.info('Handling payment_intent.payment_failed event');
          await handlePaymentIntentFailed(event);
          break;

        case 'payment_intent.created':
          log.info('Handling payment_intent.created event');
          await handlePaymentIntentCreated(event);
          break;

        case 'charge.succeeded':
          log.info('Handling charge.succeeded event');
          await handleChargeSucceeded(event);
          break;

        case 'charge.updated':
          log.info('Handling charge.updated event');
          await handleChargeUpdated(event);
          break;

        default:
          log.warn('Unhandled event type', { eventType: event.type });
          break;
      }

      log.info('Successfully processed event', { eventType: event.type });
      return NextResponse.json({ 
        received: true,
        eventType: event.type,
        eventId: event.id 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      log.error('Stripe webhook error', error, {
        eventType: event?.type
      });
      
      // Don't expose internal error details in production
      const isProduction = process.env.NODE_ENV === 'production';
      const errorResponse = isProduction 
        ? { error: 'Internal server error' } 
        : { 
            error: errorMessage,
            stack: errorStack,
            type: error?.constructor?.name
          };
      
      return NextResponse.json(
        errorResponse,
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    log.error('Unexpected error in webhook handler', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};