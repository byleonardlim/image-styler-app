'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ImageUploader from '@/components/ImageUploader';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FloatingHeader } from "@/components/FloatingHeader";
import FAQSection from "@/components/FAQSection";

export default function Page() {
  // Style configuration
  const STYLES = [
    { 
      id: 'lunora', 
      name: 'Lunora',
      previewImage: '/images/previews/lunora-preview.png'
    },
    { 
      id: 'suburbia', 
      name: 'Suburbia',
      previewImage: '/images/previews/suburbia-preview.png'
    },
    { 
      id: 'magicelle', 
      name: 'Magicelle',
      previewImage: '/images/previews/magicelle-preview.png'
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
      <FloatingHeader 
        isScrolled={isScrolled} 
        onStylizeClick={() => {
          // Scroll to the form section
          document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' });
        }} 
      />

      <div className={`pt-24 space-y-12 transition-all duration-300 ${
        isScrolled ? 'mt-16' : 'mt-0'
      }`}>
      {/* Hero Section */}
      <section className="w-full bg-background py-16">
        <div className="space-y-4 max-w-4xl mx-auto px-4 min-h-[40vh] flex flex-col justify-center text-center">
          <h1 className="text-6xl sm:text-5xl font-medium font-plex-condensed text-foreground">Turning any photos into share-worthy images</h1>
          <p className="text-xl text-muted-foreground">No registration and data retention to generate high quality trending looks.</p>
        </div>
      </section>

      {/* Order Form */}
      <section id="order-form" className='w-full bg-muted/20 py-24'>
        <div className="max-w-2xl mx-auto">
          <Card className="w-full pt-6">
            <CardContent>
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
                <Label className="block mb-2">Choose your preferred style</Label>
                <div className="grid grid-cols-3 gap-4">
                  {STYLES.map((styleItem) => {
                    const isSelected = style !== null && style === styleItem.id;
                    
                    return (
                      <button
                        key={styleItem.id}
                        type="button"
                        onClick={() => setStyle(styleItem.id)}
                        className={`p-1
                          flex flex-col items-center rounded-lg border-2 transition-all
                          ${isSelected 
                            ? 'border-primary bg-primary/10' 
                            : 'border-muted hover:border-border bg-card'}
                          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        disabled={isLoading}
                      >
                        <div className="w-full aspect-square mb-2 overflow-hidden rounded-md">
                          <div className={`w-full h-full ${isSelected ? 'bg-blue-50' : 'bg-slate-50'} flex items-center justify-center`}>
                            {styleItem.previewImage && (
                              <img 
                                src={styleItem.previewImage} 
                                alt={`${styleItem.name} preview`}
                                className="w-full h-full object-cover object-left-top"
                                onError={(e) => {
                                  // Hide the image if it fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <span className="font-medium text-sm">{styleItem.name}</span>
                      </button>
                    );
                  })}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || images.length === 0 || !style}
                  className="w-full"
                >
                  Order Images - ${totalPrice.toFixed(2)}
                </Button>
              </div>
            </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQSection />
      </div>
    </React.Fragment>
  );
}
