const API_ENDPOINTS = {
  UPLOAD: '/api/upload',
  DELETE: '/api/delete',
} as const;

const generateFileUrl = (fileId: string): string => {
  return `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID}/files/${fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
};

export const uploadImage = async (file: File, onProgress?: (progress: boolean) => void): Promise<{ fileId: string; fileUrl: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(true);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const result = JSON.parse(xhr.responseText);
        // Ensure we have both fileId and fileUrl from the server
        if (!result.fileId) {
          reject(new Error('No file ID received from server'));
          return;
        }
        
        // Generate the URL if not provided by the server
        const fileUrl = result.fileUrl || generateFileUrl(result.fileId);
        if (!fileUrl) {
          reject(new Error('Failed to generate file URL'));
          return;
        }
        
        resolve({
          fileId: result.fileId,
          fileUrl: fileUrl
        });
      } else {
        reject(new Error(xhr.statusText || 'Upload failed'));
      }
    };
    
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.open('POST', API_ENDPOINTS.UPLOAD, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send(formData);
  });
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
