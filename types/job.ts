export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type JobMetadata = {
  style: string;
  imageCount: number;
  customerEmail: string;
  paymentStatus: string;
  image_urls?: string[];
  generated_image_urls?: string[];
};

export type JobResponse = {
  id: string;
  status: JobStatus;
  progress: number;
  resultUrl: string | null;
  imageUrls?: string[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: JobMetadata;
};

export type JobListResponse = {
  jobs: JobResponse[];
  total: number;
  page: number;
  pageSize: number;
};
