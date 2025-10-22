"use client";

import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Download, Loader2 } from "lucide-react";
import { usePollJobStatus } from '@/hooks/usePollJobStatus';
import React from 'react';
import JSZip from 'jszip';
import { getOrCreateAnonymousUserId } from '@/lib/appwriteClient';

interface JobStatusPageProps {
  params: Promise<{ id: string }>;
}

export default function JobStatusPage({ params }: JobStatusPageProps) {
  const router = useRouter();
  const { id: jobId } = React.use(params);
  const [ready, setReady] = React.useState(false);
  const [claimError, setClaimError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const match = hash && hash.match(/[#&]?claim=([^&]+)/);
        if (match && match[1]) {
          const claimToken = decodeURIComponent(match[1]);
          const appwriteUserId = await getOrCreateAnonymousUserId();
          const res = await fetch(`/api/jobs/${jobId}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ claimToken, appwriteUserId })
          });
          if (!res.ok) {
            const t = await res.json().catch(() => ({}));
            throw new Error(t?.error || 'Failed to claim access');
          }
          // Remove fragment from URL
          if (typeof window !== 'undefined') {
            history.replaceState(null, '', window.location.pathname);
          }
        }
      } catch (e: any) {
        if (!cancelled) setClaimError(e?.message || 'Claim failed');
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    if (jobId) run(); else setReady(true);
    return () => { cancelled = true; };
  }, [jobId]);

  const { job, isLoading, error } = usePollJobStatus(ready ? jobId : null);

  const handleBackToHome = () => {
    router.push('/');
  };

  const generatedImageUrls = job?.processedImages || [];
  const hasMultipleImages = generatedImageUrls.length > 1;
  const isJobCompleted = job?.status === 'completed';

  const markDownloaded = async () => {
    try {
      await fetch(`/api/jobs/${jobId}/downloaded`, { method: 'POST' });
    } catch (err) {
      console.warn('Failed to flag is_downloaded:', err);
    }
  };

  function CanvasPreview({ src, alt }: { src: string; alt: string }) {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const imgRef = React.useRef<HTMLImageElement | null>(null);

    const draw = React.useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const img = imgRef.current;
      if (!canvas || !container || !img || !img.naturalWidth || !img.naturalHeight) return;
      const dpr = window.devicePixelRatio || 1;
      const maxW = container.clientWidth || img.naturalWidth;
      const aspect = img.naturalWidth / img.naturalHeight;
      const width = Math.max(1, Math.round(maxW));
      const height = Math.max(1, Math.round(width / aspect));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
    }, []);

    React.useEffect(() => {
      const image = new Image();
      imgRef.current = image;
      image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.loading = 'eager';
      image.onload = () => draw();
      image.src = src;
      const onResize = () => draw();
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
      };
    }, [src, draw]);

    return (
      <div
        ref={containerRef}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        className="w-full"
        style={{ WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
        aria-label={alt}
        role="img"
      >
        <canvas ref={canvasRef} className="block w-full" />
      </div>
    );
  }

  if (!ready || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <div className="mb-6">
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Processing Your Images</h1>
          <p className="text-gray-600 mb-4">Generating your styled images. This may take a few moments...</p>
          {claimError && (
            <p className="text-sm text-red-500">{claimError}</p>
          )}
          {job?.progress !== undefined && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${job.progress}%` }}
              ></div>
            </div>
          )}
          <p className="text-sm text-gray-500">Feel free to leave the page and come back later to check on the progress.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <div className="text-red-500 mb-4">
            <AlertCircle className="h-12 w-12 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Processing Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex flex-col space-y-3">
          <Button
              onClick={() => window.location.reload()}
              variant="default"
            >
              Try Again
            </Button>
            <Button
              onClick={handleBackToHome}
              className="w-full"
            >
              Return Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!job || (job.status === 'completed' && generatedImageUrls.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <p className="text-gray-600">Job details not found or no images were generated.</p>
          <Button
            onClick={handleBackToHome}
            className="w-full mt-4"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className={`p-3 rounded-full ${isJobCompleted ? 'bg-green-100' : 'bg-blue-100'}`}>
              {isJobCompleted ? (
                <Check className="h-6 w-6 text-green-600" />
              ) : (
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
              )}
            </div>
            <div className="ml-4">
              <h1 className="text-2xl font-bold text-gray-800">
                {isJobCompleted ? 'Your image is ready' : 'Styling your image'}
              </h1>
              <p className="text-gray-600">
                {job.metadata?.style && `Selected style: ${job.metadata.style.charAt(0).toUpperCase() + job.metadata.style.slice(1)} • `}
                {isJobCompleted 
                  ? hasMultipleImages 
                    ? `${generatedImageUrls.length} images generated` 
                    : 'Completed'
                  : 'Generating...'}
              </p>
            </div>
          </div>
          {job.completedAt && (
            <div className="mt-4 text-sm text-gray-500">
              {isJobCompleted 
                ? `Completed on ${new Date(job.completedAt).toLocaleString()}`
                : `Started on ${new Date(job.createdAt || Date.now()).toLocaleString()}`}
            </div>
          )}
        </div>

        {/* Images Grid */}
        <div className="p-6">
          {generatedImageUrls.length > 0 ? (
            <>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                {hasMultipleImages ? 'Generated Images' : 'Generated Image'}
              </h2>
              <div className={`grid ${hasMultipleImages ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                {generatedImageUrls.map((url: string, index: number) => (
                <div key={index} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative aspect-auto bg-gray-100">
                    <CanvasPreview src={url} alt={`Generated image ${index + 1}`} />
                  </div>
                  <div className="bg-gray-50 flex space-x-4">
                  </div>
                </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No generated images available yet.</p>
              {job.status === 'processing' && (
                <p className="text-sm text-gray-400 mt-2">Your images are being generated. Please check back soon.</p>
              )}
              <Button
              onClick={() => window.location.reload()}
              variant="default"
            >
              Try Again
            </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              onClick={handleBackToHome}
              variant="outline"
              className="flex-1"
            >
              Back to Home
            </Button>
            {generatedImageUrls.length > 0 && (
              <Button
                onClick={async (e) => {
                  e.preventDefault();

                  const getExtensionFromMime = (mime: string) => {
                    if (!mime) return 'jpg';
                    if (mime.includes('jpeg')) return 'jpg';
                    if (mime.includes('png')) return 'png';
                    if (mime.includes('webp')) return 'webp';
                    if (mime.includes('gif')) return 'gif';
                    if (mime.includes('bmp')) return 'bmp';
                    if (mime.includes('tiff')) return 'tiff';
                    return 'jpg';
                  };

                  const getExtensionFromUrl = (url: string) => {
                    try {
                      const pathname = new URL(url).pathname.toLowerCase();
                      const match = pathname.match(/\.([a-z0-9]+)$/);
                      return match ? match[1] : 'jpg';
                    } catch {
                      return 'jpg';
                    }
                  };

                  const triggerDownload = (href: string, filename: string, revokeAfter?: string) => {
                    const link = document.createElement('a');
                    link.href = href;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    if (revokeAfter) {
                      // Revoke the object URL shortly after the click to avoid breaking the download
                      setTimeout(() => URL.revokeObjectURL(revokeAfter), 1500);
                    }
                  };

                  const now = new Date();
                  const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');

                  const downloadSingle = async (url: string, index?: number) => {
                    try {
                      const response = await fetch(url);
                      if (!response.ok) throw new Error('Failed to fetch image');
                      const blob = await response.blob();
                      const ext = getExtensionFromMime(blob.type);
                      const blobUrl = URL.createObjectURL(blob);
                      const filename = `styllio-${timestamp}${typeof index === 'number' ? `-${index + 1}` : ''}.${ext}`;
                      triggerDownload(blobUrl, filename, blobUrl);
                    } catch (error) {
                      console.warn('Falling back to direct download due to:', error);
                      const ext = getExtensionFromUrl(url);
                      const filename = `styllio-${timestamp}${typeof index === 'number' ? `-${index + 1}` : ''}.${ext}`;
                      triggerDownload(url, filename);
                    }
                  };

                  if (generatedImageUrls.length > 1) {
                    // Create a ZIP archive with all images. Fallback: individually download failed ones.
                    const zip = new JSZip();
                    const failed: Array<{ url: string; index: number }> = [];

                    for (let i = 0; i < generatedImageUrls.length; i++) {
                      const url = generatedImageUrls[i];
                      try {
                        const res = await fetch(url);
                        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
                        const blob = await res.blob();
                        const ext = getExtensionFromMime(blob.type);
                        const filename = `styllio-${timestamp}-${i + 1}.${ext}`;
                        zip.file(filename, blob);
                      } catch (err) {
                        console.warn('Image fetch failed, will fallback to direct download:', err);
                        failed.push({ url, index: i });
                      }
                    }

                    try {
                      const zipBlob = await zip.generateAsync({ type: 'blob' });
                      const zipUrl = URL.createObjectURL(zipBlob);
                      const zipName = `styllio-${timestamp}.zip`;
                      triggerDownload(zipUrl, zipName, zipUrl);
                      await markDownloaded();
                    } catch (err) {
                      console.warn('ZIP generation failed, falling back to individual downloads:', err);
                      // Fall back to individual downloads for all
                      for (let i = 0; i < generatedImageUrls.length; i++) {
                        await downloadSingle(generatedImageUrls[i], i);
                        await new Promise((r) => setTimeout(r, 200));
                      }
                      await markDownloaded();
                      return;
                    }

                    // Individually download any failed images (if any)
                    for (const f of failed) {
                      await downloadSingle(f.url, f.index);
                      await new Promise((r) => setTimeout(r, 200));
                    }
                    await markDownloaded();
                  } else {
                    await downloadSingle(generatedImageUrls[0]);
                    await markDownloaded();
                  }
                }}
                className="flex-1 flex items-center justify-center"
              >
                <Download className="h-5 w-5 mr-2" />
                {hasMultipleImages ? 'Download All Images' : 'Download Image'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}