'use client';

import { useState, useEffect, useCallback } from 'react';
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
    <div className="container mx-auto py-8 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Transform Your Photos with AI Magic</h1>
        <p className="text-xl text-muted-foreground">Turn your ordinary photos into stunning works of art with our AI-powered style transfer technology</p>
        <div className="pt-4 flex justify-center gap-4">
          <Button variant="outline" className="rounded-full">How It Works</Button>
          <Button className="rounded-full">Order Now</Button>
        </div>
      </div>

      {/* Order Form */}
      <Card className="w-full max-w-2xl p-6 space-y-6 mx-auto">
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
                  const isSelected = style === styleItem.id;
                  
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



      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto space-y-6 pt-12">
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
      </div>
    </div>
  );
}
