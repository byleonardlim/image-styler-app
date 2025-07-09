import { NextResponse } from 'next/server';
import { databases } from '@/lib/appwriteServer';
import { Query } from 'node-appwrite';
import { JobResponse, JobStatus } from '@/types/job';

function formatJobResponse(job: any): JobResponse {
  // Ensure image URLs are always arrays
  const imageUrls = Array.isArray(job.image_urls) ? job.image_urls : [];
  const generatedImageUrls = Array.isArray(job.generated_image_urls) ? job.generated_image_urls : [];
  
  return {
    id: job.$id,
    status: (job.job_status || 'pending') as JobStatus,
    progress: job.progress || 0,
    resultUrl: job.result_url || null,
    originalImageUrls: imageUrls,
    processedImages: generatedImageUrls,
    error: job.error_message || null,
    createdAt: job.$createdAt,
    updatedAt: job.$updatedAt,
    completedAt: job.completed_at || null,
    metadata: {
      style: job.selected_style_name || 'Unknown',
      imageCount: imageUrls.length || 0,
      customerEmail: job.customer_email || '',
      paymentStatus: job.payment_status || 'unknown',
    }
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const jobId = searchParams.get('id');

    console.log(`[API/jobs] Received request. sessionId: ${sessionId}, jobId: ${jobId}`);

    if (sessionId) {
      // Handle session-based lookup
      const result = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!,
        [
          Query.equal('stripe_session_id', sessionId),
          Query.orderDesc('$createdAt'),
          Query.limit(1)
        ]
      );

      console.log(`[API/jobs] Session lookup result documents length: ${result.documents.length}`);

      if (result.documents.length === 0) {
        return NextResponse.json(
          { error: 'No job found with the provided session ID' },
          { status: 404 }
        );
      }

      // Return the most recent matching job
      const job = result.documents[0];
      console.log(`[API/jobs] Found job by session: ${job.$id}`);
      return NextResponse.json(formatJobResponse(job));
    } 
    
    if (jobId) {
      // Handle direct job ID lookup
      try {
        const job = await databases.getDocument(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
          process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!,
          jobId
        );
        console.log(`[API/jobs] Found job by ID: ${job.$id}`);
        return NextResponse.json(formatJobResponse(job));
      } catch (error) {
        console.error(`[API/jobs] Error finding job by ID ${jobId}:`, error);
        return NextResponse.json(
          { error: 'No job found with the provided ID' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Either sessionId or id query parameter is required' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('[API/jobs] Error in jobs API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred while processing your request',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}