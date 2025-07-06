"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";

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
        <Button
          onClick={() => router.push('/')}
          variant="default"
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}
