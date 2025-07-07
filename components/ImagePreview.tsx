import React, { memo, useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ImagePreviewProps } from '@/types/image';

export const ImagePreview = memo(({ 
  src, 
  onRemove, 
  isUploading, 
  isDeleting 
}: ImagePreviewProps) => {
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [isBlobUrl, setIsBlobUrl] = useState<boolean>(src.startsWith('blob:'));

  // Update the image source when the src prop changes
  useEffect(() => {
    // Always prefer the non-blob URL if available
    if (!isBlobUrl || !src.startsWith('blob:')) {
      setImageSrc(src);
    }
  }, [src, isBlobUrl]);

  const handleImageLoad = () => {
    // If this was a blob URL and we've loaded the image, clean it up
    if (isBlobUrl && imageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(imageSrc);
      setIsBlobUrl(false);
    }
  };

  // Clean up any blob URLs when the component unmounts
  useEffect(() => {
    return () => {
      if (isBlobUrl && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [isBlobUrl, imageSrc]);

  return (
    <div className="relative group">
      <img
        src={imageSrc}
        alt="Preview"
        className="w-full h-32 rounded-lg object-cover transition-opacity group-hover:opacity-90"
        onLoad={handleImageLoad}
      />
      <Button
        type="button"
        variant={isUploading ? "outline" : "destructive"}
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          !isUploading && onRemove();
        }}
        disabled={isUploading || isDeleting}
        className={`absolute top-2 right-2 h-8 w-8 p-0 transition-opacity ${
          (isUploading || isDeleting) ? 'opacity-75' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {isUploading || isDeleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <X className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
});

ImagePreview.displayName = 'ImagePreview';
