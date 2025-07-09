export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type JobMetadata = {
  style: string;
  imageCount: number;
  customerEmail: string;
  paymentStatus: string;
  original_image_urls?: string[];
  processed_images?: string[];
};

export type JobResponse = {
  id: string;
  status: JobStatus;
  progress: number;
  resultUrl: string | null;
  originalImageUrls?: string[];
  processedImages?: string[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  metadata: JobMetadata;
};

export type JobListResponse = {
  jobs: JobResponse[];
  total: number;
  page: number;
  pageSize: number;
};