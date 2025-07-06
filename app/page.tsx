'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ImageUploader from '@/components/ImageUploader';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function Page() {
  const [style, setStyle] = useState('ghibli');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPrice, setTotalPrice] = useState(0);

  const handleImagesChange = (newImages: File[], newPreviews: string[], newFileIds: string[]) => {
    setImages(newImages);
    setImagePreviews(newPreviews);
    setFileIds(newFileIds);
    
    // Recalculate price
    const basePrice = Math.min(newImages.length, 5) * 4;
    const additionalPrice = Math.max(newImages.length - 5, 0) * 3;
    setTotalPrice(basePrice + additionalPrice);
  };



  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Store the checkout data in localStorage
      localStorage.setItem('checkoutData', JSON.stringify({
        images: imagePreviews,
        style,
        fileIds
      }));

      // Use the preview URLs for submission

      // Create checkout session with price data
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(totalPrice * 100), // Convert to cents and round to nearest integer
            product_data: {
              name: 'Image Styler Service',
              description: `${images.length} images with ${style} style`,
            },
          },
          style: style,
          imageUrls: imagePreviews, // Use the preview URLs for checkout
          customerEmail: 'user@example.com', // You might want to collect this from the user
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="w-full max-w-2xl p-6 space-y-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <ImageUploader
              onImagesChange={handleImagesChange}
              onError={setError}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              style={style}
              totalPrice={totalPrice}
            />

            <div>
              <Label className="block mb-2">Choose your preferred style</Label>
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <Button
                  type="button"
                  variant={style === 'Lunora' ? "default" : "outline"}
                  onClick={() => setStyle('Lunora')}
                  className="rounded-r-none"
                  disabled={isLoading}
                >
                  Lunora
                </Button>
                <Button
                  type="button"
                  variant={style === 'Suburbia' ? "default" : "outline"}
                  onClick={() => setStyle('Suburbia')}
                  className="rounded-l-none rounded-r-none -ml-px"
                  disabled={isLoading}
                >
                  Suburbia
                </Button>
                <Button
                  type="button"
                  variant={style === 'Magicelle' ? "default" : "outline"}
                  onClick={() => setStyle('Magicelle')}
                  className="rounded-l-none -ml-px"
                  disabled={isLoading}
                >
                  Magicelle
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              Order (${totalPrice.toFixed(2)} USD)
            </Button>
          </div>
        </form>
      </Card>

      {error && (
        <div className="bg-destructive text-destructive-foreground p-4 rounded-md">
          {error}
        </div>
      )}
    </div>
  );
}
