'use client';

import React, { useCallback, useEffect, useReducer, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { ImageState, ImageUploaderProps, ImageAction } from '@/types/image';
import { uploadImage, deleteImage } from '@/lib/api/imageService';
import { ImagePreview } from './ImagePreview';
import { IMAGE_PRICING } from '@/config/pricing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MAX_IMAGES = 10;
const ACCEPTED_FILE_TYPES = {
  'image/jpeg': ['.jpeg', '.jpg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
} as const;

const initialState: ImageState = {
  files: [],
  previews: [],
  fileIds: [],
  urlMapping: {},
  uploadProgress: {},
  deletingIds: new Set(),
};

function imageReducer(state: ImageState, action: ImageAction): ImageState {
  switch (action.type) {
    case 'ADD_IMAGES':
      return {
        ...state,
        files: [...state.files, ...action.payload.files],
        previews: [...state.previews, ...action.payload.previews],
        // Extend fileIds with placeholders to preserve index alignment for upcoming uploads
        fileIds: [
          ...state.fileIds,
          ...new Array(action.payload.files.length).fill('')
        ],
      };

    case 'UPLOAD_START':
      return {
        ...state,
        uploadProgress: {
          ...state.uploadProgress,
          [action.payload.index]: action.payload.inProgress !== undefined 
            ? action.payload.inProgress 
            : true,
        },
      };

    case 'UPLOAD_SUCCESS':
      const { [action.payload.index]: _removed, ...remainingProgressSuccess } = state.uploadProgress;
      // Place fileId at the exact index to keep arrays aligned with previews
      const updatedFileIdsOnSuccess = [...state.fileIds];
      updatedFileIdsOnSuccess[action.payload.index] = action.payload.fileId;
      return {
        ...state,
        fileIds: updatedFileIdsOnSuccess,
        urlMapping: {
          ...state.urlMapping,
          [action.payload.fileId]: action.payload.fileUrl,
        },
        previews: state.previews.map((preview, idx) =>
          idx === action.payload.index ? action.payload.fileUrl : preview
        ),
        uploadProgress: remainingProgressSuccess,
      };

    case 'UPLOAD_ERROR':
      const newFiles = [...state.files];
      const newPreviews = [...state.previews];
      const newFileIdsOnError = [...state.fileIds];
      newFiles.splice(action.payload.index, 1);
      newPreviews.splice(action.payload.index, 1);
      newFileIdsOnError.splice(action.payload.index, 1);
      const { [action.payload.index]: _removedError, ...remainingProgressError } = state.uploadProgress;

      return {
        ...state,
        files: newFiles,
        previews: newPreviews,
        fileIds: newFileIdsOnError,
        uploadProgress: remainingProgressError,
      };

    case 'REMOVE_IMAGE':
      const updatedFiles = [...state.files];
      const updatedPreviews = [...state.previews];
      const updatedFileIds = [...state.fileIds];
      const removedFileId = updatedFileIds[action.payload.index];
      
      updatedFiles.splice(action.payload.index, 1);
      updatedPreviews.splice(action.payload.index, 1);
      updatedFileIds.splice(action.payload.index, 1);

      const updatedMapping = { ...state.urlMapping };
      if (removedFileId) {
        delete updatedMapping[removedFileId];
      }

      return {
        ...state,
        files: updatedFiles,
        previews: updatedPreviews,
        fileIds: updatedFileIds,
        urlMapping: updatedMapping,
        deletingIds: new Set([...state.deletingIds].filter(id => id !== removedFileId)),
      };

    case 'DELETE_START':
      return {
        ...state,
        deletingIds: new Set(state.deletingIds).add(action.payload.fileId),
      };

    case 'DELETE_SUCCESS':
      const fileIdToDelete = action.payload.fileId;
      const indexToDelete = state.fileIds.indexOf(fileIdToDelete);

      if (indexToDelete === -1) return state; // File not found in state

      const newFilesAfterDelete = [...state.files];
      const newPreviewsAfterDelete = [...state.previews];
      const newFileIdsAfterDelete = [...state.fileIds];
      const newUrlMappingAfterDelete = { ...state.urlMapping };

      newFilesAfterDelete.splice(indexToDelete, 1);
      newPreviewsAfterDelete.splice(indexToDelete, 1);
      newFileIdsAfterDelete.splice(indexToDelete, 1);
      delete newUrlMappingAfterDelete[fileIdToDelete];

      return {
        ...state,
        files: newFilesAfterDelete,
        previews: newPreviewsAfterDelete,
        fileIds: newFileIdsAfterDelete,
        urlMapping: newUrlMappingAfterDelete,
        deletingIds: new Set([...state.deletingIds].filter(id => id !== fileIdToDelete)),
      };

    case 'DELETE_ERROR':
      return {
        ...state,
        deletingIds: new Set([...state.deletingIds].filter(id => id !== action.payload.fileId)),
      };

    case 'CLEANUP':
      return {
        ...state,
        uploadProgress: {},
        deletingIds: new Set(),
      };

    default:
      return state;
  }
}

export default function ImageUploader({ 
  onImagesChange, 
  onError, 
  isLoading, 
  setIsLoading, 
  style, 
  totalPrice 
}: ImageUploaderProps) {
  const { showToast } = useToast();
  const [state, dispatch] = useReducer(imageReducer, initialState);

  // Clean up blob URLs when they're no longer needed
  useEffect(() => {
    // Clean up function that will run when the component unmounts
    // or when the previews change
    const cleanup = () => {
      // Get current previews that are blob URLs
      const blobUrls = state.previews.filter(url => url.startsWith('blob:'));
      
      // Revoke each blob URL
      blobUrls.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Failed to revoke blob URL:', error);
        }
      });
    };

    return cleanup;
  }, [state.previews]);

  // Notify parent component of changes
  useEffect(() => {
    onImagesChange(
      state.files,
      state.previews,
      state.fileIds
    );
  }, [state.files, state.previews, state.fileIds, onImagesChange]);

  const handleNewImages = useCallback(async (newImages: File[]) => {
    onError(null);

    try {
      // Create preview URLs immediately for better UX
      const newPreviews = newImages.map(file => URL.createObjectURL(file));
      
      // Add new images to state
      dispatch({
        type: 'ADD_IMAGES',
        payload: {
          files: newImages,
          previews: newPreviews,
        },
      });

      // Upload each file in parallel
      const uploadPromises = newImages.map(async (file, index) => {
        const fileIndex = state.files.length + index;
        
        try {
          // Update upload progress
          dispatch({
            type: 'UPLOAD_START',
            payload: { index: fileIndex },
          });

          // Upload the file
          const { fileId, fileUrl } = await uploadImage(
            file
          );

          // Update state with successful upload
          dispatch({
            type: 'UPLOAD_SUCCESS',
            payload: {
              index: fileIndex,
              fileId,
              fileUrl,
            },
          });

          return { success: true, fileId, fileUrl };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Upload failed';
          showToast(`Failed to upload ${file.name}: ${errorMessage}`, { type: 'destructive' });
          
          dispatch({
            type: 'UPLOAD_ERROR',
            payload: { index: fileIndex, error: errorMessage },
          });
          
          return { success: false, error: errorMessage };
        }
      });

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error handling image uploads:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while processing your images';
      showToast(errorMessage, { type: 'destructive' });
      onError(errorMessage);
    } finally {
      // parent loading handled via effect syncing isAnyUploading
    }
  }, [state.files.length, onError, showToast]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validImages = acceptedFiles.filter(file => 
      Object.keys(ACCEPTED_FILE_TYPES).includes(file.type)
    );

    if (validImages.length === 0) {
      showToast('Please upload valid image files (JPEG, PNG, WebP)', { type: 'destructive' });
      return;
    }

    const availableSlots = Math.max(0, MAX_IMAGES - state.files.length);
    const toUpload = validImages.slice(0, availableSlots);
    const excess = validImages.length - toUpload.length;

    if (toUpload.length === 0) {
      showToast(`Maximum ${MAX_IMAGES} images allowed`, { type: 'destructive' });
      return;
    }

    if (excess > 0) {
      showToast(`Only ${toUpload.length} added. Limit of ${MAX_IMAGES} images reached.`, { type: 'destructive' });
    }

    handleNewImages(toUpload);
  }, [state.files.length, showToast, handleNewImages]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: MAX_IMAGES,
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDropRejected: () => {
      showToast('Some files were rejected. Only images up to 10MB are allowed.', { type: 'destructive' });
    },
  });

  const removeImage = useCallback(async (index: number) => {
    const fileIdToDelete = state.fileIds[index];
    const previewToDelete = state.previews[index];

    // If this image hasn't uploaded yet (no fileId), remove locally
    if (!fileIdToDelete) {
      if (previewToDelete && previewToDelete.startsWith('blob:')) {
        try { URL.revokeObjectURL(previewToDelete); } catch {}
      }
      dispatch({ type: 'REMOVE_IMAGE', payload: { index } });
      return;
    }

    dispatch({
      type: 'DELETE_START',
      payload: { fileId: fileIdToDelete },
    });

    try {
      await deleteImage(fileIdToDelete);
      dispatch({
        type: 'DELETE_SUCCESS',
        payload: { fileId: fileIdToDelete },
      });
      // Clean up blob URL if it exists
      if (previewToDelete && previewToDelete.startsWith('blob:')) {
        URL.revokeObjectURL(previewToDelete);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete image';
      showToast(errorMessage, { type: 'destructive' });
      dispatch({
        type: 'DELETE_ERROR',
        payload: { fileId: fileIdToDelete, error: errorMessage },
      });
    }
  }, [state.fileIds, state.previews, showToast]);

  // Derived state: any image uploading
  const isAnyUploading = Object.keys(state.uploadProgress).length > 0;
  const [showUploading, setShowUploading] = useState(false);
  const uploadingCount = Object.values(state.uploadProgress).filter(Boolean).length;
  // Sync parent loading with any uploading state
  useEffect(() => {
    setIsLoading(isAnyUploading);
  }, [isAnyUploading, setIsLoading]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (isAnyUploading) {
      t = setTimeout(() => setShowUploading(true), 150);
    } else {
      setShowUploading(false);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [isAnyUploading]);

  return (
    <div className="space-y-4">
      <Card className="border-blue-200/60 bg-green-50/50 dark:border-green-900/40 dark:bg-green-950/20 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base capitalize text-green-800 dark:text-green-200">Transparent, per-photo prices</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            All currency prices are in USD. Pay only for the photos you style.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">First {IMAGE_PRICING.BULK_THRESHOLD} photos</div>
              <div className="text-lg font-semibold">${IMAGE_PRICING.STANDARD_PRICE.toFixed(2)} each</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Additional photos</div>
              <div className="text-lg font-semibold">${IMAGE_PRICING.BULK_PRICE.toFixed(2)} each</div>
            </div>
          </div>
          {state.previews.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Selected: {state.previews.length} photo{state.previews.length === 1 ? '' : 's'}</span>
              <span className="font-medium text-green-600 dark:text-green-400">${(
                state.previews.length <= IMAGE_PRICING.BULK_THRESHOLD 
                  ? state.previews.length * IMAGE_PRICING.STANDARD_PRICE
                  : IMAGE_PRICING.BULK_THRESHOLD * IMAGE_PRICING.STANDARD_PRICE + 
                    (state.previews.length - IMAGE_PRICING.BULK_THRESHOLD) * IMAGE_PRICING.BULK_PRICE
              ).toFixed(2)}</span>
            </div>
          )}
        </CardContent>
      </Card>
      <div 
        {...getRootProps()} 
        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:bg-gray-800/70'
        }`}
        aria-label="Upload images"
      >
        <input 
          {...getInputProps()} 
          id="dropzone-file" 
          aria-label="File upload"
          disabled={false}
        />
        <div className="flex flex-col items-center justify-center p-6 text-center">
          {isDragActive ? (
            <div className="flex flex-col items-center space-y-2">
              <Upload className="h-10 w-10 text-blue-500" />
              <p className="text-blue-600 dark:text-blue-400 font-medium">Drop the images here</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">We'll handle the rest</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <Upload className="h-10 w-10 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-blue-600 dark:text-blue-400">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                PNG, JPG, WEBP (Max. {MAX_IMAGES} images, up to 10MB each)
              </p>
              {showUploading && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span>{`Uploading ${uploadingCount} image${uploadingCount === 1 ? '' : 's'}...`}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {state.previews.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {state.previews.map((preview, index) => {
              const fileId = state.fileIds[index];
              const isUploading = state.uploadProgress[index] !== undefined;
              const isDeleting = fileId ? state.deletingIds.has(fileId) : false;
              const imageUrl = fileId ? state.urlMapping[fileId] || preview : preview;
              
              return (
                <div key={`${preview}-${index}`} className="relative group">
                  <ImagePreview 
                    src={imageUrl}
                    onRemove={() => removeImage(index)}
                    isUploading={isUploading}
                    isDeleting={isDeleting}
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {state.previews.length} of {MAX_IMAGES} images selected
            </span>
            <span>
              {state.previews.length > 0 && `$${(
                state.previews.length <= IMAGE_PRICING.BULK_THRESHOLD 
                  ? state.previews.length * IMAGE_PRICING.STANDARD_PRICE
                  : IMAGE_PRICING.BULK_THRESHOLD * IMAGE_PRICING.STANDARD_PRICE + 
                    (state.previews.length - IMAGE_PRICING.BULK_THRESHOLD) * IMAGE_PRICING.BULK_PRICE
              ).toFixed(2)}`}
            </span>
          </div>
        </div>
      )}

      
    </div>
  );
}
