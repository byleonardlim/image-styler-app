export interface ImageState {
  files: File[];
  previews: string[];
  fileIds: string[];
  urlMapping: Record<string, string>;
  uploadProgress: Record<number, boolean>;
  deletingIds: Set<string>;
}

export interface ImageUploaderProps {
  onImagesChange: (images: File[], previews: string[], fileIds: string[]) => void;
  onError: (error: string | null) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  style?: string | null;
  totalPrice: number;
}

export type ImageAction =
  | { type: 'ADD_IMAGES'; payload: { files: File[]; previews: string[] } }
  | { type: 'UPLOAD_START'; payload: { index: number; inProgress?: boolean } }
  | { type: 'UPLOAD_SUCCESS'; payload: { index: number; fileId: string; fileUrl: string } }
  | { type: 'UPLOAD_ERROR'; payload: { index: number; error: string } }
  | { type: 'REMOVE_IMAGE'; payload: { index: number } }
  | { type: 'DELETE_START'; payload: { fileId: string } }
  | { type: 'DELETE_SUCCESS'; payload: { fileId: string } }
  | { type: 'DELETE_ERROR'; payload: { fileId: string; error: string } }
  | { type: 'CLEANUP' };

export interface ImagePreviewProps {
  src: string;
  onRemove: () => void;
  isUploading: boolean;
  isDeleting: boolean;
}
