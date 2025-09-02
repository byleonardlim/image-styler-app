"use client";

import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Download, Loader2 } from "lucide-react";
import { usePollJobStatus } from '@/hooks/usePollJobStatus';
import React from 'react';

interface JobStatusPageProps {
  params: Promise<{ id: string }>;
}

export default function JobStatusPage({ params }: JobStatusPageProps) {
  const router = useRouter();
  const { id: jobId } = React.use(params);
  const { job, isLoading, error } = usePollJobStatus(jobId);

  const handleBackToHome = () => {
    router.push('/');
  };

  const generatedImageUrls = job?.processedImages || [];
  const hasMultipleImages = generatedImageUrls.length > 1;
  const isJobCompleted = job?.status === 'completed';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <div className="mb-6">
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto" />
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
          <p className="text-sm text-gray-500">Feel free to leave the page and come back later to check on the progress.</p>
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
              onClick={() => window.location.reload()}
              variant="default"
            >
              Try Again
            </Button>
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

  if (!job || (job.status === 'completed' && generatedImageUrls.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <p className="text-gray-600">Job details not found or no images were generated.</p>
          <Button
            onClick={handleBackToHome}
            className="w-full mt-4"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className={`p-3 rounded-full ${isJobCompleted ? 'bg-green-100' : 'bg-blue-100'}`}>
              {isJobCompleted ? (
                <Check className="h-6 w-6 text-green-600" />
              ) : (
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
              )}
            </div>
            <div className="ml-4">
              <h1 className="text-2xl font-bold text-gray-800">
                {isJobCompleted ? 'Your image is ready' : 'Styling your image'}
              </h1>
              <p className="text-gray-600">
                {job.metadata?.style && `Selected style: ${job.metadata.style.charAt(0).toUpperCase() + job.metadata.style.slice(1)} • `}
                {isJobCompleted 
                  ? hasMultipleImages 
                    ? `${generatedImageUrls.length} images generated` 
                    : 'Completed'
                  : 'Generating...'}
              </p>
            </div>
          </div>
          {job.completedAt && (
            <div className="mt-4 text-sm text-gray-500">
              {isJobCompleted 
                ? `Completed on ${new Date(job.completedAt).toLocaleString()}`
                : `Started on ${new Date(job.createdAt || Date.now()).toLocaleString()}`}
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
                  <div className="relative aspect-auto bg-gray-100">
                    <img 
                      src={url} 
                      alt={`Generated image ${index + 1}`} 
                      className="w-full h-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="bg-gray-50 flex space-x-4">
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
              <Button
              onClick={() => window.location.reload()}
              variant="default"
            >
              Try Again
            </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              onClick={handleBackToHome}
              variant="outline"
              className="flex-1"
            >
              Back to Home
            </Button>
            {generatedImageUrls.length > 0 && (
              <Button
                onClick={async (e) => {
                  e.preventDefault();
                  const link = document.createElement('a');
                  
                  try {
                    // First try to download via fetch to handle CORS if needed
                    const response = await fetch(generatedImageUrls[0]);
                    if (!response.ok) throw new Error('Failed to fetch image');
                    
                    const blob = await response.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    link.href = blobUrl;
                    window.URL.revokeObjectURL(blobUrl); // Clean up after setting href
                  } catch (error) {
                    console.warn('Falling back to direct download due to:', error);
                    link.href = generatedImageUrls[0]; // Fallback to direct URL
                  }
                  
                  // Set up and trigger download
                  const now = new Date();
                  const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');
                  link.download = `styllio-${timestamp}.jpg`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex-1 flex items-center justify-center"
              >
                <Download className="h-5 w-5 mr-2" />
                {hasMultipleImages ? 'Download All Images' : 'Download Image'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}