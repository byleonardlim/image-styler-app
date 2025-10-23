'use client';

import React, { useState, useLayoutEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import ImageUploader from '@/components/ImageUploader';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FloatingHeader } from "@/components/FloatingHeader";
import FAQSection from "@/components/FAQSection";
// gsap will be dynamically imported in effects to avoid SSR issues
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import { IMAGE_PRICING } from '@/config/pricing';
import { getOrCreateAnonymousUserId } from '@/lib/appwriteClient';

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
  const rootRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setIsScrolled(scrollPosition > 10);
    };

    // Set initial state before first paint
    handleScroll();

    // Add event listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useLayoutEffect(() => {
    let ctx: any;
    (async () => {
      const mod = await import('gsap');
      const gsap = mod.default || mod;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        // Set initial states before paint to avoid flicker
        gsap.set('.hero-animate > *', { y: 24, opacity: 0 });
        gsap.to('.hero-animate > *', {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power2.out'
        });

        // Order form reveal
        gsap.set('#order-form .card-reveal', { y: 24, opacity: 0 });
        gsap.to('#order-form .card-reveal', {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#order-form',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        });

        // FAQ reveal
        gsap.set('#faq .faq-reveal', { y: 24, opacity: 0 });
        gsap.to('#faq .faq-reveal', {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#faq',
            start: 'top 85%',
            toggleActions: 'play none none reverse'
          }
        });
      }, rootRef);
    })();

    return () => ctx?.revert?.();
  }, []);

  const handleImagesChange = (newImages: File[], newPreviews: string[], newFileIds: string[]) => {
    setImages(newImages);
    setImagePreviews(newPreviews);
    setFileIds(newFileIds);
    
    // Recalculate price
    const count = newImages.length;
    const baseCount = Math.min(count, IMAGE_PRICING.BULK_THRESHOLD);
    const extraCount = Math.max(count - IMAGE_PRICING.BULK_THRESHOLD, 0);
    const total = baseCount * IMAGE_PRICING.STANDARD_PRICE + extraCount * IMAGE_PRICING.BULK_PRICE;
    setTotalPrice(total);
  };



  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // No need for validation here as the button is disabled when conditions aren't met
    setIsLoading(true);

    try {
      // Use server-side proxy URLs from our domain to avoid CORS
      const appwriteUrls = fileIds.map(fileId => `/api/files/${fileId}`);

      // Store the checkout data in localStorage
      localStorage.setItem('checkoutData', JSON.stringify({
        images: appwriteUrls, // Store Appwrite URLs instead of blob URLs
        style: style as string, // Safe to cast here since we've validated the style exists
        fileIds
      }));

      // Create checkout session with price data
      const appwriteUserId = await getOrCreateAnonymousUserId();
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
          fileIds: fileIds, // Also pass fileIds for reference
          appwriteUserId
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
        onStylizeClick={async () => {
          const mod = await import('gsap');
          const gsap = mod.default || mod;
          const { ScrollToPlugin } = await import('gsap/ScrollToPlugin');
          gsap.registerPlugin(ScrollToPlugin);
          gsap.to(window, {
            duration: 0.8,
            ease: 'power2.out',
            scrollTo: { y: '#order-form', offsetY: 80 }
          });
        }} 
      />

      <div ref={rootRef} className={`pt-24 space-y-12 transition-all duration-300 ${
        isScrolled ? 'mt-16' : 'mt-0'
      }`}>
      {/* Hero Section */}
      <section className="w-full bg-background py-16">
        <div className="hero-animate space-y-4 max-w-4xl mx-auto px-4 min-h-[40vh] flex flex-col justify-center text-center">
          <h1 className="text-6xl sm:text-5xl font-medium font-plex-condensed text-foreground">Turning any photos into share-worthy images</h1>
          <p className="text-xl text-muted-foreground">Generate high quality trending looks without registration and data retention.</p>
          <div className="pt-4">
            <BeforeAfterSlider
              className="mx-auto"
              beforeSrc="/images/beforeafter/before_generated.png"
              afterSrc="/images/beforeafter/after_generated.png"
              alt="Example style transformation"
            />
          </div>
        </div>
      </section>

      {/* Order Form */}
      <section id="order-form" className='w-full bg-muted/20 py-16'>
        <div className="max-w-2xl mx-auto px-4">
          <Card className="w-full">
            <CardContent className="card-reveal p-4 lg:p-6">
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
                          <div className={`relative w-full h-full ${isSelected ? 'bg-blue-50' : 'bg-slate-50'} flex items-center justify-center`}>
                            {styleItem.previewImage && (
                              <Image
                                src={styleItem.previewImage}
                                alt={`${styleItem.name} preview`}
                                fill
                                sizes="(max-width: 640px) 33vw, (max-width: 1024px) 33vw, 200px"
                                className="object-cover object-left-top"
                                onError={(e) => {
                                  const target = e.currentTarget as HTMLImageElement;
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
      <div id="faq">
        <div className="faq-reveal p-6">
          <FAQSection />
        </div>
      </div>
      </div>
    </React.Fragment>
  );
}
