import { NextRequest, NextResponse } from 'next/server';
import { databases } from '@/lib/appwriteServer';

// This is a dynamic route handler
export async function GET(
  request: NextRequest,
  context: any
): Promise<Response> {
  try {
    const jobId = context?.params?.id as string | undefined;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get the job by ID
    const job = await databases.getDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!,
      jobId
    );

    return NextResponse.json({
      id: job.$id,
      status: job.job_status || 'pending',
      progress: job.progress || 0,
      resultUrl: job.result_url || null,
      error: job.error_message || null,
      createdAt: job.$createdAt,
      updatedAt: job.$updatedAt,
      metadata: {
        style: job.selected_style_name || 'Unknown',
        imageCount: job.image_urls?.length || 0,
        customerEmail: job.customer_email || '',
        paymentStatus: job.payment_status || 'unknown'
      }
    });

  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
  }
}

