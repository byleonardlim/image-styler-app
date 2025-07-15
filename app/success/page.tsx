
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
  const { job, isLoading, error } = usePollJobStatus(jobId);

  useEffect(() => {
    if (!sessionId) return;

    const fetchJobId = async () => {
      if (jobIdRetryCount >= MAX_JOB_ID_RETRIES) {
        throw new Error('Failed to retrieve job ID after multiple attempts. Please try again later or contact support.');
      }

      try {
        const response = await fetch(`/api/jobs?sessionId=${encodeURIComponent(sessionId)}`);
        if (response.ok) {
          const data = await response.json();
          if (data?.id) {
            setJobId(data.id);
          } else {
            // If job ID is not immediately available, retry fetching the session ID
            setJobIdRetryCount(prev => prev + 1);
            setTimeout(fetchJobId, JOB_ID_RETRY_DELAY); 
          }
        } else {
          throw new Error('Failed to retrieve job ID from session.');
        }
      } catch (err) {
        console.error('Error fetching job ID by session:', err);
        setJobIdRetryCount(prev => prev + 1);
        setTimeout(fetchJobId, JOB_ID_RETRY_DELAY); 
      }
    };

    fetchJobId();
  }, [sessionId, jobIdRetryCount]);

  useEffect(() => {
    if (job && job.id) {
      router.push(`/jobs/${job.id}`);
    }
  }, [job, router]);

  if (error) {
    throw new Error(error); // Propagate error to ErrorBoundary
  }

  return (
    <div className="text-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-600">Preparing your job... {jobIdRetryCount > 0 && `(Attempt ${jobIdRetryCount}/${MAX_JOB_ID_RETRIES})`}</p>
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
