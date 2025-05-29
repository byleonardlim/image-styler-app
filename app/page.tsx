'use client';

import { useState } from 'react';
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
    <div className="flex flex-col items-center min-h-screen p-24">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-4xl md:text-5xl">
          Image Generator
        </h2>
        <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
          Generate images.
        </p>
      </div>

      <div className="w-full max-w-sm pt-6 pb-8 space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label htmlFor="image" className="text-sm text-gray-500">
              Upload Image
            </label>
            <input
              type="file"
              id="image"
              accept="image/*"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-500">
              Select Style
            </label>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="ghibli"
                  name="style"
                  value="ghibli"
                  checked={style === 'ghibli'}
                  onChange={(e) => setStyle(e.target.value)}
                  disabled={isLoading}
                  className="mr-2"
                />
                <label htmlFor="ghibli" className="text-sm text-gray-700">Studio Ghibli Style</label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="family-guy"
                  name="style"
                  value="family-guy"
                  checked={style === 'family-guy'}
                  onChange={(e) => setStyle(e.target.value)}
                  disabled={isLoading}
                  className="mr-2"
                />
                <label htmlFor="family-guy" className="text-sm text-gray-700">Family Guy Style</label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            Generate
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-100 border border-red-400 rounded-lg">
          {error}
        </div>
      )}

      <div className="w-[512px] h-[512px] space-y-2">
        {isLoading ? (
          <div className="h-[512px] w-[512px] animate-pulse bg-gray-200 rounded-lg" />
        ) : imageSrc ? (
          <div className="relative w-[512px] h-[512px]">
            <img
              src={imageSrc}
              alt="Generated image"
              className="w-full h-full object-contain"
            />
            <button
              onClick={() => {
                URL.revokeObjectURL(imageSrc);
                setImageSrc(null);
                setImageFile(null);
              }}
              className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-100"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        ) : (
          <div className="h-[512px] w-[512px] bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Upload an image to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
