import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { Databases, Storage, ID, type Models } from 'node-appwrite';
import { databases, storage, functions } from '@/lib/appwriteServer';  // Import initialized instances
import { getFilePreviewUrl, getFileViewUrl, appwriteBucketId } from '@/lib/appwrite';
import { triggerStyleTransfer } from '@/lib/triggerFunction';
import { Query } from 'node-appwrite';
import { nanoid } from 'nanoid';
import { Resend } from 'resend';


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

// Resolve a base URL for links in emails (no request context here)
const getBaseUrl = (): string => {
  // Prefer explicitly configured public base URL
  const direct = process.env.NEXT_PUBLIC_BASE_URL;
  if (direct && direct.trim().length > 0) return direct.replace(/\/$/, '');

  // Common platform vars (add protocol if missing)
  const vercel = process.env.VERCEL_URL; // e.g. my-app.vercel.app
  if (vercel && vercel.trim().length > 0) {
    const hasProtocol = /^https?:\/\//i.test(vercel);
    return (hasProtocol ? vercel : `https://${vercel}`).replace(/\/$/, '');
  }

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && appUrl.trim().length > 0) return appUrl.replace(/\/$/, '');

  // Local dev fallback
  return 'http://localhost:3000';
};

// Types
interface ImageUploadResult {
  fileId: string;
  fileUrl: string;
  previewUrl: string;
}

interface JobData extends Models.Document {
  // $id is the unique document ID in Appwrite, automatically assigned
  $id: string;
  stripe_session_id: string;
  stripe_payment_intent: string;
  customer_email: string;
  customer_name: string;
  job_status: 'pending' | 'processing' | 'completed' | 'failed' | 'queuing';
  payment_status: string;
  payment_amount: number;
  payment_currency: string;
  selected_style_name: string;
  image_urls: string[];  // Array to store URLs of the uploaded images
  function_execution_id?: string;  // Store the Appwrite Function execution ID
  created_at: string;
  updated_at: string;
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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);

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

  const bucketId = appwriteBucketId;

  const file = new File([fileBuffer], fileName, { type: contentType });

  const uploadedFile = await storage.createFile(
    bucketId,
    ID.unique(),
    file
  );

  const fileUrl = getFileViewUrl(bucketId, uploadedFile.$id);
  const filePreviewUrl = getFilePreviewUrl(bucketId, uploadedFile.$id, 800);

  return {
    fileId: uploadedFile.$id,
    fileUrl: fileUrl,
    previewUrl: filePreviewUrl,
  };
};

const sendJobConfirmationEmail = async (job: JobData | null) => {
      if (!job) {
        log.warn('sendJobConfirmationEmail called with null job');
        return;
    }
    try {
    const { customer_email, customer_name, $id: jobId } = job;
    const jobUrl = `${getBaseUrl()}/jobs/${jobId!}`;

    await resend.emails.send({
      from: 'order@tx.styllio.co',
      to: customer_email!,
      subject: 'Your Image Styling',
      html: `
        <h1>Hi ${customer_name || 'there'},</h1>
        <p>Your payment was successful and your image styling job has been created.</p>
        <p>You can view the status of your job here:</p>
        <a href="${jobUrl}">${jobUrl}</a>
        <p>Thanks for using Image Styler!</p>
      `,
    });

    log.info('Job confirmation email sent successfully', { jobId: job.$id });
  } catch (error) {
    log.error('Failed to send job confirmation email', error, { jobId: job?.$id });
  }
};

const createJob = async function createJob(
  session: Stripe.Checkout.Session,
  imageUrls: string[],
) {
  try {
    const customerName = session.customer_details?.name || 'Guest';
    const customerEmail = session.customer_details?.email || 'guest@example.com';
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || '';
    const metadata = session.metadata as unknown as CheckoutSessionMetadata;
    const selectedStyle = metadata.selectedStyle || 'default';
    const paymentAmount = session.amount_total ? session.amount_total / 100 : 0;
    const paymentCurrency = session.currency?.toUpperCase() || 'USD';

    // Generate a unique job ID
    const jobId = generateJobId(customerEmail);

    // Create the job document with all required fields for the processor
    const jobData = {
      // Required by the processor
      job_status: 'queuing',
      image_urls: imageUrls,
      selected_style_name: selectedStyle,
      
      // Additional metadata
      stripe_session_id: session.id,
      stripe_payment_intent: paymentIntentId,
      customer_name: customerName,
      customer_email: customerEmail,
      payment_status: session.payment_status || 'unpaid',
      payment_amount: paymentAmount,
      payment_currency: paymentCurrency,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    log.info('Creating job document', { 
      jobId, 
      sessionId: session.id,
      status: 'pending',
      imageCount: imageUrls.length
    });
    
    const job = await databases.createDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!,
      jobId,
      jobData
    );

    log.info('Job document created successfully', { 
      jobId,
      status: 'pending',
      imageCount: imageUrls.length
    });
    
    return job;
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

const updateJob = async function updateJob(
  jobId: string,
  data: Partial<JobData>
) {
  try {
    const updatedJob = await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!,
      jobId,
      {
        ...data,
        updated_at: new Date().toISOString(),
      }
    );
    log.info('Job document updated successfully', { jobId, data });
    return updatedJob;
  } catch (error) {
    log.error('Failed to update job', error, { jobId, data });
    throw error;
  }
};

const findJobBySessionId = async (sessionId: string): Promise<JobData | null> => {
  try {
    const result = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!,
      [Query.equal('stripe_session_id', sessionId)]
    );
    log.info('findJobBySessionId result', { sessionId, documentsFound: result.documents.length });
    
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
    log.info('Processing checkout session from payment intent', { sessionId });
    
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      await processCheckoutSessionCompletion(session);
      log.info('Successfully processed checkout session from payment intent', { sessionId });
    } catch (error) {
      log.error('Error processing checkout session from payment intent', error, {
        sessionId,
        paymentIntentId: paymentIntent.id
      });
      throw error; // Re-throw to be caught by the outer try-catch
    }
  } else {
    log.info('No session_id found in payment intent metadata');
    // Fallback: find the Checkout Session by payment_intent and process it
    try {
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntent.id,
        limit: 1,
      });
      if (sessions.data.length > 0) {
        const session = sessions.data[0];
        log.info('Found checkout session via payment_intent', { sessionId: session.id, paymentIntentId: paymentIntent.id });
        await processCheckoutSessionCompletion(session);
        log.info('Successfully processed checkout session via payment_intent lookup', { sessionId: session.id });
      } else {
        log.warn('No checkout session found for payment_intent', { paymentIntentId: paymentIntent.id });
      }
    } catch (error) {
      log.error('Failed to resolve checkout session from payment_intent', error, { paymentIntentId: paymentIntent.id });
      throw error;
    }
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

async function processCheckoutSessionCompletion(session: Stripe.Checkout.Session) {
  log.info('processCheckoutSessionCompletion called', { sessionId: session.id });
  const metadata = session.metadata as unknown as CheckoutSessionMetadata || {};
  const userEmail = session.customer_details?.email || 'unknown@example.com';
  let job: Models.Document | null = null;
  
  // Log the metadata for debugging
  log.info('Checkout session metadata', { metadata, sessionId: session.id });
  
  try {
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
      getFileViewUrl(appwriteBucketId, fileId)
    );

    // Check if job already exists for this session
    const existingJob = await findJobBySessionId(session.id);

    if (existingJob) {
      log.info('Job already exists for session, checking status', { 
        sessionId: session.id, 
        jobId: existingJob.$id, 
        status: existingJob.job_status 
      });
      
      // If job is already in a non-terminal state, don't process it again
      if (existingJob.job_status !== 'completed' && existingJob.job_status !== 'failed') {
        log.info('Job is already being processed, skipping duplicate processing', { 
          jobId: existingJob.$id,
          status: existingJob.job_status
        });
        return;
      }
      
      // If job is in a terminal state, update it but don't trigger processing
      job = await updateJob(existingJob.$id, {
        payment_status: session.payment_status || 'unknown',
        updated_at: new Date().toISOString(),
      });
      log.info('Updated existing job in terminal state', { jobId: job.$id, status: job.job_status });
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

    // Create the job document with status 'pending' and all required fields
    job = await createJob(session, imageUrls);
    log.info('Created new job', { jobId: job.$id, status: job.job_status });

    // Send job confirmation email
    await sendJobConfirmationEmail(job as JobData);
    
    // Trigger the style transfer function
    log.info('Triggering style transfer function', { jobId: job.$id });
    const execution = await triggerStyleTransfer(job.$id, job.image_urls, job.selected_style_name);
    await updateJob(job.$id, { 
      function_execution_id: execution,
      job_status: 'queuing' 
    });
    log.info('Style transfer function triggered', { jobId: job.$id, executionId: execution });

  } catch (error) {
    // Log error details
    const errorDetails = {
      sessionId: session.id,
      jobId: job?.$id || 'job-not-created',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    // Only try to update the job if it was created
    if (job?.$id) {
      try {
        await updateJob(job.$id, {
          job_status: 'failed',
          error: 'Failed to start image processing',
        });
      } catch (updateError) {
        log.error('Failed to update job status', {
          ...errorDetails,
          updateError: updateError instanceof Error ? updateError.message : 'Unknown error'
        });
      }
    }
    
    log.error('Failed to process checkout session completion', {
      ...errorDetails,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Re-throw the error to mark the webhook as failed
    throw error;
  }
}

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  log.info('handleCheckoutSessionCompleted called', { eventId: event.id });
  const session = event.data.object as Stripe.Checkout.Session;
  await processCheckoutSessionCompletion(session);
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
    'NEXT_PUBLIC_APPWRITE_COLLECTION_ID',
    'RESEND_API_KEY'
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
        case 'charge.succeeded':
          // No-op for job creation; logged for visibility
          log.info('Handling charge.succeeded event');
          await handleChargeSucceeded(event);
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