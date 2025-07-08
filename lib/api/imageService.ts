import { getFileViewUrl, appwriteBucketId } from '@/lib/appwrite';

const API_ENDPOINTS = {
  UPLOAD: '/api/upload',
  DELETE: '/api/delete',
} as const;

const generateFileUrl = (fileId: string): string => {
  return getFileViewUrl(appwriteBucketId, fileId);
};

export const uploadImage = async (file: File): Promise<{ fileId: string; fileUrl: string; previewUrl: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(API_ENDPOINTS.UPLOAD, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Upload failed');
  }

  const result = await response.json();
  
  if (!result.fileId || !result.fileUrl || !result.previewUrl) {
    throw new Error('Invalid response from server: missing fileId, fileUrl, or previewUrl');
  }
  
  return {
    fileId: result.fileId,
    fileUrl: result.fileUrl,
    previewUrl: result.previewUrl,
  };
};

export const deleteImage = async (fileId: string): Promise<boolean> => {
  const response = await fetch(API_ENDPOINTS.DELETE, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete file from storage');
  }

  return true;
};
