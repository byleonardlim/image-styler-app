'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { X } from 'lucide-react';

export default function Page() {
  const [style, setStyle] = useState('ghibli');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPrice, setTotalPrice] = useState(0);

  useEffect(() => {
    const calculateTotal = () => {
      if (images.length <= 5) {
        return images.length * 4; // First 5 images at $4 each
      } else {
        return (5 * 4) + ((images.length - 5) * 3); // First 5 at $4, rest at $3
      }
    };
    setTotalPrice(calculateTotal());
  }, [images]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages = Array.from(files);
    const validImages = newImages.filter(file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));

    if (images.length + validImages.length > 10) {
      setError('Maximum 10 images allowed');
      return;
    }

    // Create previews
    const newPreviews = validImages.map(file => {
      return URL.createObjectURL(file);
    });

    setImages([...images, ...validImages]);
    setImagePreviews([...imagePreviews, ...newPreviews]);

    // Calculate price
    const basePrice = Math.min(images.length + validImages.length, 5) * 4;
    const additionalPrice = Math.max(images.length + validImages.length - 5, 0) * 3;
    setTotalPrice(basePrice + additionalPrice);
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    const newPreviews = [...imagePreviews];
    
    newImages.splice(index, 1);
    newPreviews.splice(index, 1);

    setImages(newImages);
    setImagePreviews(newPreviews);

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
        images,
        style
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
              description: `${images.length} images with ${style} style`,
            },
          },
          style: style,
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
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-4xl md:text-5xl">
            Image Generator
          </h2>
          <p className="max-w-[600px] text-muted-foreground text-center">
            Generate images.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Upload Images (Max 10)</Label>
              <Input
                type="file"
                id="images"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImageUpload}
                disabled={isLoading}
              />
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={preview} className="relative">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="max-h-32 w-full rounded-lg object-cover"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Price: ${totalPrice.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  First 5 photos: $4 each<br />
                  Additional photos: $3 each
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Style</Label>
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <Button
                  type="button"
                  variant={style === 'ghibli' ? "default" : "outline"}
                  onClick={() => setStyle('ghibli')}
                  className="rounded-r-none"
                  disabled={isLoading}
                >
                  Studio Ghibli Style
                </Button>
                <Button
                  type="button"
                  variant={style === 'family-guy' ? "default" : "outline"}
                  onClick={() => setStyle('family-guy')}
                  className="rounded-l-none -ml-px"
                  disabled={isLoading}
                >
                  Family Guy Style
                </Button>
                <Button
                  type="button"
                  variant={style === 'disney' ? "default" : "outline"}
                  onClick={() => setStyle('disney')}
                  className="rounded-l-none -ml-px"
                  disabled={isLoading}
                >
                  Disney Style
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
