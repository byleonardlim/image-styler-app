'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ImageUploader from '@/components/ImageUploader';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function Page() {
  // Style configuration
  const STYLES = [
    { 
      id: 'lunora', 
      name: 'Lunora',
      previewImage: '/previews/lunora-preview.jpg' // TODO: Update path to actual image
    },
    { 
      id: 'suburbia', 
      name: 'Suburbia',
      previewImage: '/previews/suburbia-preview.jpg' // TODO: Update path to actual image
    },
    { 
      id: 'magicelle', 
      name: 'Magicelle',
      previewImage: '/previews/magicelle-preview.jpg' // TODO: Update path to actual image
    },
    // Add new styles here
  ] as const;

  type StyleId = typeof STYLES[number]['id'] | null;
  const [style, setStyle] = useState<StyleId>(null);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // Keeping this as it might be used by other components
  const [totalPrice, setTotalPrice] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 10);
    };

    // Set initial state
    handleScroll();
    
    // Add event listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Cleanup
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    
    // No need for validation here as the button is disabled when conditions aren't met
    setIsLoading(true);

    try {
      // Generate Appwrite URLs from fileIds
      const appwriteUrls = fileIds.map(fileId => 
        `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID}/files/${fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`
      );

      // Store the checkout data in localStorage
      localStorage.setItem('checkoutData', JSON.stringify({
        images: appwriteUrls, // Store Appwrite URLs instead of blob URLs
        style: style as string, // Safe to cast here since we've validated the style exists
        fileIds
      }));

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
              description: `${images.length} images with ${style || 'selected'} style`,
            },
          },
          style: style,
          imageUrls: appwriteUrls, // Use Appwrite URLs instead of blob URLs
          fileIds: fileIds // Also pass fileIds for reference
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
    <React.Fragment>
      {/* Floating Header */}
      <div className={`fixed top-0 left-0 right-0 z-50 p-4 transition-all duration-300 ${isScrolled ? 'bg-white/65 backdrop-blur-lg shadow-lg rounded-full border border-gray-200/50 mx-8 mt-8' : 'bg-transparent'}`}>
        <div className="w-full flex items-center justify-between">
          <h1 className="text-2xl font-bold px-8">Styllio</h1>
          <div className="flex items-center space-x-2">
            <Button className="rounded-full">
              Stylize your image - from <span className="text-sm text-gray-500 line-through">$4</span> $3
            </Button>
          </div>
        </div>
      </div>

      <div className={`pt-24 space-y-12 transition-all duration-300 ${
        isScrolled ? 'mt-16' : 'mt-0'
      }`}>
      {/* Hero Section */}
      <section className="w-full bg-white py-16">
        <div className="space-y-4 max-w-4xl mx-auto px-4 min-h-[50vh] flex flex-col justify-center">
          <h1 className="text-4xl tracking-tight sm:text-5xl font-plex-condensed">Turn Any Photo into Share‑Worthy Art in Seconds</h1>
          <p className="text-xl text-muted-foreground">Upload your image and instantly restyle it into trending looks, just pick a style and go. No registration required!</p>
        </div>
      </section>

      {/* Order Form */}
      <section className='w-full bg-gray-50 py-16'>
        <div className="max-w-2xl mx-auto px-4">
          <Card className="w-full p-6 space-y-6">
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
                <div className="grid grid-cols-3 gap-4">
                  {STYLES.map((styleItem) => {
                    const isSelected = style !== null && style === styleItem.id;
                    
                    return (
                      <button
                        key={styleItem.id}
                        type="button"
                        onClick={() => setStyle(styleItem.id)}
                        className={`
                          flex flex-col items-center p-3 rounded-lg border-2 transition-all
                          ${isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300 bg-white'}
                          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        disabled={isLoading}
                      >
                        <div className="w-full aspect-square mb-2 overflow-hidden rounded-md">
                          <img 
                            src={styleItem.previewImage} 
                            alt={`${styleItem.name} preview`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to a solid color if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = `data:image/svg+xml,${encodeURIComponent(
                                `<svg width="100" height="100" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                                  <rect width="100" height="100" fill="%23${isSelected ? 'e0f2fe' : 'f3f4f6'}" />
                                  <text x="50%" y="50%" font-family="sans-serif" font-size="14" text-anchor="middle" dominant-baseline="middle" fill="%264a6b">
                                    ${styleItem.name} Preview
                                  </text>
                                </svg>`
                              )}`;
                            }}
                          />
                        </div>
                        <span className="font-medium text-sm">{styleItem.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || images.length === 0 || !style}
                className="w-full"
              >
                Order (${totalPrice.toFixed(2)} USD)
              </Button>
            </div>
          </form>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-3xl mx-auto space-y-6 pt-12 pb-12">
        <h2 className="text-3xl font-bold text-center">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div className="border-b pb-4">
            <h3 className="text-lg font-medium">How does the AI style transfer work?</h3>
            <p className="text-muted-foreground mt-2">Our AI analyzes the content of your photo and applies the selected artistic style while preserving the original composition and details.</p>
          </div>
          <div className="border-b pb-4">
            <h3 className="text-lg font-medium">What image formats do you accept?</h3>
            <p className="text-muted-foreground mt-2">We accept JPG, PNG, and WebP formats. Maximum file size is 10MB per image.</p>
          </div>
          <div className="border-b pb-4">
            <h3 className="text-lg font-medium">How long does processing take?</h3>
            <p className="text-muted-foreground mt-2">Processing typically takes 2-5 minutes per image, depending on server load and image complexity.</p>
          </div>
          <div>
            <h3 className="text-lg font-medium">Can I request a refund?</h3>
            <p className="text-muted-foreground mt-2">Yes, we offer a 100% satisfaction guarantee. If you're not happy with the results, contact us within 7 days for a full refund.</p>
          </div>
        </div>
      </section>
    </div>
    </React.Fragment>
  );
}
