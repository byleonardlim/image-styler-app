"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<{
    style: string;
    imageUrls: string[];
  } | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setError('No session ID found in URL');
      setIsLoading(false);
      return;
    }

    // Fetch the session details from your API
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/checkout/session?session_id=${sessionId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch session details');
        }
        
        const session = await response.json();
        
        if (session.metadata?.selectedStyle && session.metadata?.imageUrls) {
          const imageUrls = JSON.parse(session.metadata.imageUrls);
          setOrderDetails({
            style: session.metadata.selectedStyle,
            imageUrls: Array.isArray(imageUrls) ? imageUrls : [imageUrls]
          });
          
          // Store in localStorage for the generate page
          localStorage.setItem('generationData', JSON.stringify({
            style: session.metadata.selectedStyle,
            imageUrls: imageUrls
          }));
          
          // Redirect to the generate page with the style parameter
          router.push(`/generate?style=${encodeURIComponent(session.metadata.selectedStyle)}`);
        } else {
          throw new Error('Missing style or image information in session');
        }
      } catch (err) {
        console.error('Error fetching session:', err);
        setError('Failed to process your order. Please contact support.');
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [router, searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <div className="mb-6">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">Processing your order. Please wait while we prepare your images...</p>
          <p className="text-sm text-gray-500">This may take a moment. Please do not close this page.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <div className="text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Error Processing Order</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex flex-col space-y-3">
            <button
              onClick={() => router.push('/contact')}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Contact Support
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
