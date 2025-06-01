'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X } from 'lucide-react';

export default function Page() {
  const [style, setStyle] = useState('ghibli');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsLoading(true);
    setImageSrc(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('style', style);
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Create a blob from the response
        const blob = await response.blob();
        // Create a URL for the blob
        const imageUrl = URL.createObjectURL(blob);
        setImageSrc(imageUrl);
        return;
      }

      setError(await response.text());
    } catch (err) {
      setError('Failed to generate image');
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
              <Label htmlFor="image">Upload Image</Label>
              <Input
                type="file"
                id="image"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => setImageSrc(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
                disabled={isLoading}
              />
              {imageSrc && (
                <div className="mt-2">
                  <img
                    src={imageSrc}
                    alt="Preview"
                    className="max-h-48 w-auto rounded-lg object-contain"
                  />
                </div>
              )}
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
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              Generate
            </Button>
          </div>
        </form>
      </Card>

      {error && (
        <div className="bg-destructive text-destructive-foreground p-4 rounded-md">
          {error}
        </div>
      )}

      <Card className="w-[512px] h-[512px]">
        {isLoading ? (
          <div className="h-full animate-pulse bg-muted rounded-lg" />
        ) : imageSrc ? (
          <div className="relative h-full">
            <img
              src={imageSrc}
              alt="Generated image"
              className="w-full h-full object-contain"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => {
                setImageSrc(null);
                setImageFile(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="h-full w-full bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">Upload an image to see the result</p>
          </div>
        )}
      </Card>
    </div>
  );
}
