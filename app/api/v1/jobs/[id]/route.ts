import { NextResponse } from 'next/server';
import { databases } from '@/lib/appwrite';
import { JobResponse, JobStatus } from '@/types/job';

function formatJobResponse(job: any): JobResponse {
  // Get generated image URLs, falling back to empty array
  const generatedImageUrls = job.generated_image_urls || [];
  
  return {
    id: job.$id,
    status: (job.job_status || 'pending') as JobStatus,
    progress: job.progress || 0,
    resultUrl: job.result_url || null,
    // Only include imageUrls if we have generated images
    imageUrls: generatedImageUrls.length > 0 ? generatedImageUrls : undefined,
    error: job.error_message || null,
    createdAt: job.$createdAt,
    updatedAt: job.$updatedAt,
    metadata: {
      style: job.selected_style_name || 'Unknown',
      imageCount: generatedImageUrls.length,
      customerEmail: job.customer_email || '',
      paymentStatus: job.payment_status || 'unknown',
      // Include the raw generated_image_urls in metadata for reference
      generated_image_urls: generatedImageUrls.length > 0 ? generatedImageUrls : undefined
    }
  };
}

// This tells Next.js which paths to pre-render
export async function generateStaticParams() {
  return [];
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Await the params if it's a Promise (for future compatibility)
    const resolvedParams = await Promise.resolve(params);
    const { id: jobId } = resolvedParams;

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
