"use client";
import React, { memo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ImagePreviewProps } from '@/types/image';
import gsap from 'gsap';

export const ImagePreview = memo(({ 
  src, 
  onRemove, 
  isUploading, 
  isDeleting 
}: ImagePreviewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isBlobUrl, setIsBlobUrl] = useState<boolean>(src.startsWith('blob:'));

  // Update isBlobUrl when src changes
  useEffect(() => {
    setIsBlobUrl(src.startsWith('blob:'));
  }, [src]);

  const handleImageLoad = () => {
    // If this was a blob URL and we've loaded the image, clean it up
    if (isBlobUrl && src.startsWith('blob:')) {
      URL.revokeObjectURL(src);
      setIsBlobUrl(false);
    }
  };

  // Clean up any blob URLs when the component unmounts
  useEffect(() => {
    return () => {
      if (isBlobUrl && src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
    };
  }, [isBlobUrl, src]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(containerRef.current, {
        y: 12,
        opacity: 0,
        duration: 0.35,
        ease: 'power2.out',
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="relative group">
      <img
        src={src}
        alt="Preview"
        className="w-full h-32 rounded-lg object-cover transition-opacity group-hover:opacity-90"
        onLoad={handleImageLoad}
      />
      {!isUploading && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          disabled={isDeleting}
          className={`absolute top-2 right-2 h-8 w-8 p-0 transition-opacity ${
            isDeleting ? 'opacity-75' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
});

ImagePreview.displayName = 'ImagePreview';
