"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Download } from "lucide-react";

// Polling interval in milliseconds (1 minute)
const POLL_INTERVAL = 60 * 1000;
// Maximum number of polling attempts (1 minute * 30 = 30 minutes total)
const MAX_ATTEMPTS = 30;

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface JobData {
  id: string;
  status: JobStatus;
  progress?: number;
  resultUrl?: string | null;
  imageUrls?: string[];
  image_urls?: string[];
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  metadata?: {
    style?: string;
    imageCount?: number;
    customerEmail?: string;
    paymentStatus?: string;
    image_urls?: string[];
  };
}

interface JobStatusPageProps {
  params: Promise<{ id: string }>;
}

export default function JobStatusPage({ params }: JobStatusPageProps) {
  const router = useRouter();

  const handleBackToHome = () => {
    router.push('/');
  };

  // Use React.use() to unwrap the params promise
  const { id: jobId } = use(params);
  
  const [job, setJob] = useState<JobData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Fetch job status
  const fetchJobStatus = async (): Promise<JobData | null> => {
    try {
      const response = await fetch(`/api/v1/jobs/${jobId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch job status');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching job status:', error);
      return null;
    }
  };

  // Poll for job updates
  useEffect(() => {
    if (!jobId) return;

    const poll = async (isManualRefresh = false) => {
      // Don't start a new poll if we're already loading (unless it's a manual refresh)
      if (isLoading && !isManualRefresh) return;
      
      // If not a manual refresh, check max attempts
      if (!isManualRefresh && attempt >= MAX_ATTEMPTS) {
        setError('Job processing is taking longer than expected. We will notify you by email when it\'s ready.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const jobData = await fetchJobStatus();
      
      if (!jobData) {
        if (!isManualRefresh) {
          // Only schedule next poll if not a manual refresh
          setTimeout(() => setAttempt(prev => prev + 1), POLL_INTERVAL);
        }
        setIsLoading(false);
        return;
      }

      setJob(jobData);
      
      if (jobData.status === 'completed' && jobData.resultUrl) {
        setIsLoading(false);
        // Stop polling when job is completed
        return;
      } else if (jobData.status === 'failed') {
        setError(jobData.error || 'Job processing failed');
        setIsLoading(false);
        // Stop polling on failure
        return;
      } else if (!isManualRefresh) {
        // Only schedule next poll if not a manual refresh and job is still processing
        setTimeout(() => setAttempt(prev => prev + 1), POLL_INTERVAL);
      }
      
      setIsLoading(false);
    };

    const timer = setTimeout(poll, POLL_INTERVAL);
    return () => clearTimeout(timer);
  }, [jobId, attempt]);

  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      const jobData = await fetchJobStatus();
      if (jobData) {
        setJob(jobData);
        
        // If job is already completed or failed, don't show loading
        if (['completed', 'failed'].includes(jobData.status)) {
          setIsLoading(false);
          if (jobData.status === 'failed') {
            setError(jobData.error || 'Job processing failed');
          }
        }
      } else {
        setError('Failed to load job details');
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [jobId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <div className="mb-6">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Processing Your Images</h1>
          <p className="text-gray-600 mb-4">Generating your styled images. This may take a few moments...</p>
          {job?.progress !== undefined && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${job.progress}%` }}
              ></div>
            </div>
          )}
          <p className="text-sm text-gray-500">Please keep this page open while we process your images.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <div className="text-red-500 mb-4">
            <AlertCircle className="h-12 w-12 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Processing Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex flex-col space-y-3">
            <Button
              onClick={handleBackToHome}
              className="w-full"
            >
              Return Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <p className="text-gray-600">Job details not found.</p>
          <Button
            onClick={handleBackToHome}
            className="w-full"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // Get generated image URLs from the API response
  const generatedImageUrls = job.imageUrls || job.metadata?.image_urls || [];
  const hasMultipleImages = generatedImageUrls.length > 1;
  
  console.log('Generated image URLs:', generatedImageUrls);
  
  // Log the first URL's content type if available
  if (generatedImageUrls.length > 0) {
    console.log('Checking first generated image URL:', generatedImageUrls[0]);
    fetch(generatedImageUrls[0], { method: 'HEAD' })
      .then(response => {
        console.log('Generated image status:', response.status);
        console.log('Content type:', response.headers.get('content-type'));
      })
      .catch(err => {
        console.error('Error checking generated image:', err);
      });
  } else {
    console.log('No generated images found in job data');
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-full">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <h1 className="text-2xl font-bold text-gray-800">Processing Complete!</h1>
              <p className="text-gray-600">
                {job.metadata?.style && `Style: ${job.metadata.style} • `}
                {hasMultipleImages ? `${generatedImageUrls.length} images generated` : 'Your image is ready'}
              </p>
            </div>
          </div>
          {job.completedAt && (
            <div className="mt-4 text-sm text-gray-500">
              Completed on {new Date(job.completedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Images Grid */}
        <div className="p-6">
          {generatedImageUrls.length > 0 ? (
            <>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                {hasMultipleImages ? 'Generated Images' : 'Generated Image'}
              </h2>
              <div className={`grid ${hasMultipleImages ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                {generatedImageUrls.map((url: string, index: number) => (
                <div key={index} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative aspect-square bg-gray-100">
                    <img 
                      src={url} 
                      alt={`Generated image ${index + 1}`} 
                      className="w-full h-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        // Hide the image if it fails to load
                        const container = (e.target as HTMLElement).parentElement;
                        if (container) {
                          container.style.display = 'none';
                        }
                      }}
                    />
                  </div>
                  <div className="p-3 bg-gray-50">
                    <Button
                      onClick={async (e) => {
                        e.preventDefault();
                        try {
                          const response = await fetch(url);
                          if (!response.ok) throw new Error('Failed to fetch image');
                          
                          const blob = await response.blob();
                          const blobUrl = window.URL.createObjectURL(blob);
                          
                          const link = document.createElement('a');
                          link.href = blobUrl;
                          link.download = `styled-image-${index + 1}.jpg`;
                          document.body.appendChild(link);
                          link.click();
                          
                          // Cleanup
                          window.URL.revokeObjectURL(blobUrl);
                          document.body.removeChild(link);
                        } catch (error) {
                          console.error('Error downloading image:', error);
                          // Fallback to direct download if blob approach fails
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `styled-image-${index + 1}.jpg`;
                          link.click();
                        }
                      }}
                      className="w-full flex items-center justify-center"
                    >
                      <Download className="h-5 w-5 mr-2" />
                      {hasMultipleImages ? `Download Image ${index + 1}` : 'Download Image'}
                    </Button>
                  </div>
                </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No generated images available yet.</p>
              {job.status === 'processing' && (
                <p className="text-sm text-gray-400 mt-2">Your images are being generated. Please check back soon.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-center space-x-4">
            <Button
              onClick={() => window.location.reload()}
              variant="default"
            >
              Try Again
            </Button>
            <Button
              onClick={handleBackToHome}
              variant="outline"
            >
              Return Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
