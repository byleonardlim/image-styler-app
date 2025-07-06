'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { useJobBySession } from '@/hooks/useJob';
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { ErrorBoundary } from '@/components/ErrorBoundary';

function JobRedirector({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const job = useJobBySession(sessionId);
  
  if (job?.id) {
    router.push(`/jobs/${job.id}`);
    return null;
  }
  
  throw new Error('Job not found');
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

  if (!sessionId) {
    throw new Error('No session ID found in URL');
  }

  return (
    <Suspense fallback={<LoadingView />}>
      <JobRedirector sessionId={sessionId} />
    </Suspense>
  );
}

export default function SuccessPage() {
  return (
    <ErrorBoundary fallback={({ error }) => <ErrorView error={error} />}>
      <SuccessContent />
    </ErrorBoundary>
  );
}
