"use client";

import { useState, useEffect, useCallback } from 'react';

// Constants
const POLL_INTERVAL = 5 * 1000; // 5 seconds
const MAX_ATTEMPTS = 360; // 30 minutes total

// Types
import { JobResponse, JobStatus } from '@/types/job';

interface UsePollJobStatusReturn {
  job: JobResponse | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook to poll for job status updates.
 * @param jobId The ID of the job to poll.
 */
export function usePollJobStatus(jobId: string | null): UsePollJobStatusReturn {
  const [job, setJob] = useState<JobResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobStatus = useCallback(async (): Promise<Job | null> => {
    if (!jobId) {
      return null;
    }

    const response = await fetch(`/api/v1/jobs/${jobId}`);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Job ${jobId} not found, will retry...`);
        return null;
      }
      const errorData = await response.json().catch(() => ({ error: 'An unexpected error occurred' }));
      throw new Error(errorData.error || `Failed to fetch job status: ${response.status}`);
    }

    return await response.json();
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setIsLoading(false);
      return;
    }

    let attempt = 0;
    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const poll = async () => {
      if (!isMounted) return;

      if (attempt >= MAX_ATTEMPTS) {
        setError("Job processing is taking longer than expected. We'll notify you by email when it's ready.");
        setIsLoading(false);
        return;
      }

      try {
        const jobData = await fetchJobStatus();

        if (!isMounted) return;

        if (jobData) {
          setJob(jobData);

          const isJobFinished = (jobData.status === 'completed' && Array.isArray(jobData.imageUrls) && jobData.imageUrls.length > 0) || jobData.status === 'failed';

          if (isJobFinished) {
            setIsLoading(false);
            if (jobData.status === 'failed') {
              setError(jobData.error || 'Job processing failed.');
            }
            return; // Stop polling
          }
        }
        
        attempt++;
        timeoutId = setTimeout(poll, POLL_INTERVAL);

      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
          setError(errorMessage);
          setIsLoading(false);
        }
      }
    };

    setIsLoading(true);
    poll();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [jobId, fetchJobStatus]);

  const isEffectivelyLoading = isLoading && !error;

  return { job, isLoading: isEffectivelyLoading, error };
}