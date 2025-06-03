"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FailurePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get error from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const errorMessage = urlParams.get('error');
    setError(errorMessage || 'Payment failed. Please try again.');
  }, []);

  return (
    <div className="container mx-auto py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Payment Failed</h1>
        <p className="text-red-500 mb-6">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
