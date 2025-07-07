import { NextResponse } from 'next/server';
import { databases } from '@/lib/appwrite';
import { Query } from 'node-appwrite';
import { JobResponse, JobStatus } from '@/types/job';

function formatJobResponse(job: any): JobResponse {
  // Extract image URLs from the job document
  const imageUrls = job.image_urls || [];
  const generatedImageUrls = job.generated_image_urls || [];
  
  return {
    id: job.$id,
    status: (job.job_status || 'pending') as JobStatus,
    progress: job.progress || 0,
    resultUrl: job.result_url || null,
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    error: job.error_message || null,
    createdAt: job.$createdAt,
    updatedAt: job.$updatedAt,
    metadata: {
      style: job.selected_style_name || 'Unknown',
      imageCount: imageUrls.length || 0,
      customerEmail: job.customer_email || '',
      paymentStatus: job.payment_status || 'unknown',
      image_urls: imageUrls,
      generated_image_urls: generatedImageUrls
    }
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const jobId = searchParams.get('id');

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

      if (result.documents.length === 0) {
        return NextResponse.json(
          { error: 'No job found with the provided session ID' },
          { status: 404 }
        );
      }

      // Return the most recent matching job
      const job = result.documents[0];
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
        return NextResponse.json(formatJobResponse(job));
      } catch (error) {
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
    console.error('Error in jobs API:', error);
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
