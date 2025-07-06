'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2, X, Image as ImageIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function Page() {
  const [style, setStyle] = useState('ghibli');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [totalPrice, setTotalPrice] = useState(0);
  const [urlMapping, setUrlMapping] = useState<Record<string, string>>({});

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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // Reset the input value to allow re-uploading the same file
    event.target.value = '';

    const newImages = Array.from(files);
    const validImages = newImages.filter(file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));

    if (images.length + validImages.length > 10) {
      setError('Maximum 10 images allowed');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create preview URLs immediately
      const previews = validImages.map(file => URL.createObjectURL(file));
      
      // Update state with previews first for immediate UI update
      setImages(prev => [...prev, ...validImages]);
      setImagePreviews(prev => [...prev, ...previews]);

      // Upload each file to Appwrite
      const uploadPromises = validImages.map(async (file, index) => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
            },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to upload ${file.name}`);
          }

          const result = await response.json();
          
          // Ensure the file URL is properly formatted
          const fileUrl = result.fileUrl || 
            `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID}/files/${result.fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
          
          return {
            success: true,
            fileId: result.fileId,
            fileUrl,
            index
          };
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed',
            index
          };
        }
      });

      const uploadResults = await Promise.all(uploadPromises);
      
      // Process upload results
      const newFileIds: string[] = [];
      const serverFileUrls: string[] = [];
      
      uploadResults.forEach((result, i) => {
        if (result.success) {
          newFileIds[result.index] = result.fileId;
          serverFileUrls[result.index] = result.fileUrl;
          console.log(`Upload successful for image ${i}:`, result.fileUrl);
        } else {
          console.error(`Upload failed for image ${i}:`, result.error);
        }
      });

      // Update URL mapping with new server URLs
      setUrlMapping(prev => {
        const newMapping = { ...prev };
        serverFileUrls.forEach((url, i) => {
          if (url) {
            const previewUrl = previews[i];
            if (previewUrl) {
              newMapping[previewUrl] = url;
              // Revoke the blob URL since we have the server URL now
              URL.revokeObjectURL(previewUrl);
            }
          }
        });
        return newMapping;
      });
      
      // Update server URLs for submission
      setUploadedImageUrls(prev => {
        const newUrls = serverFileUrls.filter(url => url);
        return [...prev, ...newUrls];
      });
      
      // Only keep successful uploads
      const successfulFileIds = newFileIds.filter(Boolean);
      setFileIds(prev => [...prev, ...successfulFileIds]);

      // Calculate price based on total number of images
      const totalImages = images.length + validImages.length;
      const basePrice = Math.min(totalImages, 5) * 4;
      const additionalPrice = Math.max(totalImages - 5, 0) * 3;
      setTotalPrice(basePrice + additionalPrice);
    } catch (err) {
      console.error('Error in handleImageUpload:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload images');
    } finally {
      setIsLoading(false);
    }
  };

  const removeImage = async (index: number) => {
    const fileIdToDelete = fileIds[index];
    const previewToDelete = imagePreviews[index];
    
    if (!fileIdToDelete || !previewToDelete) return;

    try {
      // Add to deleting set
      setDeletingIds(prev => new Set(prev).add(fileIdToDelete));
      
      // Delete the file from storage
      const response = await fetch('/api/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId: fileIdToDelete }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete file from storage');
      }

      // Clean up blob URL if it exists
      if (previewToDelete.startsWith('blob:')) {
        URL.revokeObjectURL(previewToDelete);
      }

      // Update local state
      const newImages = [...images];
      const newPreviews = [...imagePreviews];
      const newFileIds = [...fileIds];
      
      newImages.splice(index, 1);
      newPreviews.splice(index, 1);
      newFileIds.splice(index, 1);

      setImages(newImages);
      setImagePreviews(newPreviews);
      setFileIds(newFileIds);
      
      // Clean up URL mapping
      setUrlMapping(prev => {
        const newMapping = { ...prev };
        delete newMapping[previewToDelete];
        return newMapping;
      });

      // Recalculate price
      const basePrice = Math.min(newImages.length, 5) * 4;
      const additionalPrice = Math.max(newImages.length - 5, 0) * 3;
      setTotalPrice(basePrice + additionalPrice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    } finally {
      // Remove from deleting set
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileIdToDelete);
        return newSet;
      });
    }
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

      // Ensure we have all the uploaded URLs
      const urlsToSubmit = uploadedImageUrls.length === images.length 
        ? uploadedImageUrls 
        : imagePreviews; // Fallback to preview URLs if upload URLs are missing

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
          imageUrls: urlsToSubmit, // Use the uploaded Appwrite URLs or fallback to preview URLs
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
              <div className="relative">
                <label
                  htmlFor="images"
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                    {isLoading ? (
                      <>
                        <div className="w-8 h-8 mb-2 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-muted-foreground">Uploading files...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                        <p className="mb-1 text-sm text-muted-foreground">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPEG, PNG, or WebP (max 10 images)
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    id="images"
                    name="images"
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleImageUpload}
                    disabled={isLoading}
                  />
                </label>
              </div>
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                  {imagePreviews.map((preview, index) => {
                    // Use the server URL if available, otherwise use the blob URL
                    const imageUrl = urlMapping[preview] || preview;
                    return (
                    <div key={preview} className="relative">
                      <img
                        src={imageUrl}
                        alt={`Preview ${index + 1}`}
                        className="max-h-32 w-full rounded-lg object-cover"
                        onLoad={() => {
                          // Clean up blob URL if we have a server URL
                          if (urlMapping[preview] && preview.startsWith('blob:')) {
                            URL.revokeObjectURL(preview);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(index);
                        }}
                        disabled={deletingIds.has(fileIds[index])}
                        className={`absolute top-2 right-2 h-8 w-8 p-0 ${deletingIds.has(fileIds[index]) ? 'opacity-50' : ''}`}
                      >
                        {deletingIds.has(fileIds[index]) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )})}
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
                  className="rounded-l-none -ml-px"
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
