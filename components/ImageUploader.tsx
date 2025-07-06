'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2, X } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ImageUploaderProps {
  onImagesChange: (images: File[], previews: string[], fileIds: string[]) => void;
  onError: (error: string | null) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  style?: string | null;
  totalPrice: number;
}

import { useToast } from '@/components/ui/toast';

export default function ImageUploader({ 
  onImagesChange, 
  onError, 
  isLoading, 
  setIsLoading, 
  style, 
  totalPrice 
}: ImageUploaderProps) {
  const { showToast } = useToast();
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Record<number, boolean>>({});
  const [urlMapping, setUrlMapping] = useState<Record<string, string>>({});
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validImages = acceptedFiles.filter(file => 
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    );

    if (images.length + validImages.length > 10) {
      showToast('Maximum 10 images allowed', { type: 'destructive' });
      return;
    }

    if (validImages.length > 0) {
      handleNewImages(validImages);
    }
  }, [images.length, onError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxFiles: 10,
    multiple: true
  });

  const handleNewImages = async (newImages: File[]) => {
    try {
      setIsLoading(true);
      onError(null);

      // Create preview URLs immediately
      const previews = newImages.map(file => URL.createObjectURL(file));
      
      // Update state with previews first for immediate UI update
      setImages(prev => [...prev, ...newImages]);
      setImagePreviews(prev => [...prev, ...previews]);

      // Upload each file to Appwrite
      const uploadPromises = newImages.map(async (file, index) => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          
          const xhr = new XMLHttpRequest();
          
          // Create a promise that resolves when upload is complete
          const uploadPromise = new Promise((resolve, reject) => {
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                // Set upload in progress
                setUploadProgress(prev => ({
                  ...prev,
                  [images.length + index]: true
                }));
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
              } else {
                reject(new Error(xhr.statusText));
              }
            };

            xhr.onerror = () => {
              reject(new Error('Network error'));
            };
          });
          
          // Start the upload
          xhr.open('POST', '/api/upload', true);
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send(formData);
          
          const result = await uploadPromise as {
            fileId: string;
            fileUrl?: string;
            [key: string]: any;
          };
          
          // Ensure the file URL is properly formatted
          const fileUrl = result.fileUrl || 
            `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID}/files/${result.fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
          
          // Clear the progress when done
          setUploadProgress(prev => {
            const newProgress = {...prev};
            delete newProgress[images.length + index];
            return newProgress;
          });
          
          return {
            success: true,
            fileId: result.fileId,
            fileUrl,
            index: images.length + index
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Upload failed';
          showToast(`Failed to upload ${file.name}: ${errorMessage}`, { type: 'destructive' });
          return {
            success: false,
            error: errorMessage,
            index: images.length + index
          };
        }
      });

      const results = await Promise.all(uploadPromises);
      
      // Process results
      const newFileIds: string[] = [];
      const newUploadedImageUrls: string[] = [];
      const newUrlMapping: Record<string, string> = {};
      
      results.forEach((result) => {
        if (result.success && result.fileId && result.fileUrl) {
          newFileIds.push(result.fileId);
          newUploadedImageUrls.push(result.fileUrl);
          newUrlMapping[result.fileId] = result.fileUrl;
        } else if (!result.success) {
          // Remove failed uploads from previews
          const index = result.index ?? -1;
          if (index >= 0) {
            setImagePreviews(prev => prev.filter((_, idx) => idx !== index));
            setImages(prev => prev.filter((_, idx) => idx !== index));
          }
          showToast(`Failed to upload some images: ${result.error || 'Unknown error'}`, { type: 'destructive' });
        }
      });

      const updatedFileIds = [...fileIds, ...newFileIds];
      const updatedImages = [...images, ...newImages];
      const updatedPreviews = [...imagePreviews, ...previews];
      
      setFileIds(updatedFileIds);
      setUploadedImageUrls(prev => [...prev, ...newUploadedImageUrls]);
      setUrlMapping(prev => ({ ...prev, ...newUrlMapping }));
      
      // Notify parent component of the changes
      onImagesChange(updatedImages, updatedPreviews, updatedFileIds);

    } catch (error) {
      console.error('Error handling image uploads:', error);
      showToast('An error occurred while processing your images', { type: 'destructive' });
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

      // Notify parent component of the changes
      onImagesChange(newImages, newPreviews, newFileIds);
      
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete image', { type: 'destructive' });
    } finally {
      // Remove from deleting set
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileIdToDelete);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-2">
      <div 
        {...getRootProps()} 
        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <input {...getInputProps()} id="dropzone-file" />
        <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
          {isDragActive ? (
            <>
              <Upload className={`w-8 h-8 mb-4 text-blue-500`} />
              <p className="text-blue-600 font-medium">Drop the images here...</p>
            </>
          ) : (
            <>
              <Upload className={`w-8 h-8 mb-4 text-gray-500`} />
              <p className="mb-2 text-sm text-gray-600">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                PNG, JPG, WEBP (MAX. 10 images, 5MB each)
              </p>
            </>
          )}
        </div>
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
              {uploadProgress[index] !== undefined ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 p-0 bg-background/80"
                  disabled
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                </Button>
              ) : (
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
              )}
            </div>
          )})}
        </div>
      )}
      <div className="mt-4">
        <p className="text-xs text-muted-foreground">
          First 5 photos: $4 each • Additional photos: $3 each
        </p>
      </div>
    </div>
  );
}
