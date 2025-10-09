
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { usePollJobStatus } from '@/hooks/usePollJobStatus';
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { ErrorBoundary } from '@/components/ErrorBoundary';

const MAX_JOB_ID_RETRIES = 10; // Increased retries
const JOB_ID_RETRY_DELAY = 3000; // 3 seconds delay

function JobRedirector({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobIdRetryCount, setJobIdRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { job, isLoading: isJobLoading } = usePollJobStatus(jobId);

  useEffect(() => {
    if (!sessionId) return;

    let isMounted = true;
    let retryTimeout: NodeJS.Timeout;

    const fetchJobId = async () => {
      if (jobIdRetryCount >= MAX_JOB_ID_RETRIES) {
        const errorMsg = 'We\'re experiencing high demand. Your job is being processed, but it\'s taking longer than expected. You\'ll receive an email when it\'s ready.';
        if (isMounted) {
          setError(errorMsg);
        }
        console.error('Max retries reached for job ID lookup');
        return;
      }

      try {
        console.log(`[JobRedirector] Fetching job for session ID: ${sessionId} (attempt ${jobIdRetryCount + 1}/${MAX_JOB_ID_RETRIES})`);
        const response = await fetch(`/api/jobs?sessionId=${encodeURIComponent(sessionId)}`);
        // Treat 404 as "not found yet" and retry, since job creation can be eventually consistent
        if (response.status === 404) {
          console.log(`[JobRedirector] Job not found yet for session: ${sessionId}, retrying...`);
          if (isMounted) {
            setJobIdRetryCount(prev => prev + 1);
            retryTimeout = setTimeout(fetchJobId, JOB_ID_RETRY_DELAY);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data?.id) {
          console.log(`[JobRedirector] Found job ID: ${data.id} for session: ${sessionId}`);
          if (isMounted) {
            setJobId(data.id);
          }
        } else if (data?.error) {
          // Handle API error response
          throw new Error(data.error);
        } else {
          // No job found yet, retry after delay
          console.log(`[JobRedirector] Job not found yet for session: ${sessionId}, retrying...`);
          if (isMounted) {
            setJobIdRetryCount(prev => prev + 1);
            retryTimeout = setTimeout(fetchJobId, JOB_ID_RETRY_DELAY);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error('[JobRedirector] Error fetching job ID:', errorMessage);
        
        if (isMounted) {
          // Only update state if component is still mounted
          setJobIdRetryCount(prev => prev + 1);
          
          // Don't show transient network errors to the user, just retry
          if (jobIdRetryCount < MAX_JOB_ID_RETRIES - 1) {
            retryTimeout = setTimeout(fetchJobId, JOB_ID_RETRY_DELAY);
          } else {
            setError('We\'re experiencing high demand. Your job is being processed, but it\'s taking longer than expected. You\'ll receive an email when it\'s ready.');
          }
        }
      }
    };

    // Initial fetch
    fetchJobId();

    // Cleanup function
    return () => {
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [sessionId, jobIdRetryCount]);

  useEffect(() => {
    if (job && job.id) {
      router.push(`/jobs/${job.id}`);
    }
  }, [job, router]);

  // Show error message if we have one
  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-yellow-500 mb-4">
          <AlertCircle className="w-12 h-12 mx-auto" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Processing Your Order</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <p className="text-sm text-gray-500">You can safely close this page. We'll email you when your images are ready.</p>
      </div>
    );
  }

  // Show loading state while we're looking up the job
  if (!jobId || isJobLoading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Processing Your Order</h2>
        <p className="text-gray-600">Preparing your job... {jobIdRetryCount > 0 && `(Attempt ${jobIdRetryCount}/${MAX_JOB_ID_RETRIES})`}</p>
        <p className="text-sm text-gray-500 mt-4">This may take a moment. Please don't close this page.</p>
      </div>
    );
  }

  // This should be handled by the usePollJobStatus hook, but just in case
  return (
    <div className="text-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-600">Redirecting to your job...</p>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <div className="mb-6">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">Preparing your job...</p>
        <p className="text-sm text-gray-500">You'll be redirected to your job status page shortly.</p>
      </div>
    </div>
  );
}

function ErrorView({ error }: { error: Error }) {
  const router = useRouter();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <div className="text-red-500 mb-4">
          <AlertCircle className="w-16 h-16 mx-auto" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-6">{error.message}</p>
        <div className="flex justify-center space-x-4">
          <Button
            onClick={() => window.location.reload()}
            variant="default"
          >
            Try Again
          </Button>
          <Button
            onClick={() => router.push('/')}
            variant="outline"
          >
            Return Home
          </Button>
        </div>
      </div>
    </div>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Clear the checkout data from localStorage when the component mounts
    try {
      localStorage.removeItem('checkoutData');
      console.log('Cleared checkout data from localStorage');
    } catch (error) {
      console.error('Failed to clear checkout data from localStorage:', error);
    }
  }, []);

  if (!sessionId) {
    throw new Error('No session ID found in URL');
  }

  return <JobRedirector sessionId={sessionId} />;
}

export default function SuccessPage() {
  return (
    <ErrorBoundary fallback={({ error }) => <ErrorView error={error} />}>
      <Suspense fallback={<LoadingView />}>
        <SuccessContent />
      </Suspense>
    </ErrorBoundary>
  );
}
