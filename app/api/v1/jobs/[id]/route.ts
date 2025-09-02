import { NextRequest, NextResponse } from 'next/server';
import { databases } from '@/lib/appwriteServer';
import { JobResponse, JobStatus } from '@/types/job';

function formatJobResponse(job: any): JobResponse {
  const originalImageUrls = Array.isArray(job.image_urls) ? job.image_urls : [];
  const generatedImageUrls = Array.isArray(job.generated_image_urls) ? job.generated_image_urls : [];
  
  return {
    id: job.$id,
    status: (job.job_status || 'pending') as JobStatus,
    progress: job.progress || 0,
    resultUrl: job.result_url || null,
    originalImageUrls: originalImageUrls,
    processedImages: generatedImageUrls,
    error: job.error_message || null,
    createdAt: job.$createdAt,
    updatedAt: job.$updatedAt,
    metadata: {
      style: job.selected_style_name || 'Unknown',
      imageCount: originalImageUrls.length,
      customerEmail: job.customer_email || '',
      paymentStatus: job.payment_status || 'unknown',
    }
  };
}



export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: jobId } = params;

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

    return NextResponse.json(formatJobResponse(job));
  } catch (error: unknown) {
    console.error('Error fetching job:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch job';
    
    return NextResponse.json(
      { 
        error: 'Job not found',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 404 }
    );
  }
}
