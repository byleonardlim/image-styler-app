"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Fetch the checkout data from localStorage
    const checkoutData = localStorage.getItem('checkoutData');
    if (checkoutData) {
      const data = JSON.parse(checkoutData);
      // Clear the checkout data from localStorage
      localStorage.removeItem('checkoutData');
      
      // Redirect to the image generation page with the data
      router.push('/generate?style=' + data.style);
    }
  }, [router]);

  return (
    <div className="container mx-auto py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">Thank you for your purchase. Redirecting you to the image generation page...</p>
      </div>
    </div>
  );
}
